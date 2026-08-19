import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HeightField, TerrainStreamer } from './terrain.js';
import { Environment } from './environment.js';
import { SHIPS_BY_ID, resolveStats, loadShipModel, nudgeOrientation, resetOrientation, pickEnemyShips, WEAPONS } from './ships.js';
import { FlightModel, ASSIST } from './flight.js';
import { CombatSystem, Loadout } from './weapons.js';
import { CollectibleField, DroneSwarm, PICKUP } from './world.js';
import { Drifters } from './drifters.js';
import { Track, GateField, AIRacer, RACER_ROSTER, NODE_SPACING, GATE_RADIUS } from './race.js';
import { Input } from './input.js';
import { TouchControls, IS_TOUCH, STEER } from './touch.js';
import { HUD } from './hud.js';
import { HangarStage } from './hangar.js';
import {
  SHIP_RADIUS, CAM_BACK, CAM_UP, CAM_BACK_FAR, CAM_UP_FAR, CAM_LOOK_AHEAD,
  CAM_GROUND_CLEAR, FOV_BASE, FOV_SPEED, FOV_BOOST, MUZZLE_FWD, FX_SCALE,
} from './scale.js';
import { Audio } from './audio.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const FWD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const DEAD_ZONE = 0.07;
const HUD_FADE_SECONDS = 60;
const _aim = new THREE.Vector3();
const _touchAxes = { x: 0, y: 0 };
const _proj = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Renderer / scene bootstrap
// ---------------------------------------------------------------------------
const __q = new URLSearchParams(location.search);
if (__q.has('card')) {
  const { runCard } = await import('./sharecard.js');
  await runCard();
  throw new Error('share card');   // stop the game from booting
}

if (__q.has('grid')) {
  const { runGrid } = await import('./devgrid.js');
  await runGrid();
  throw new Error('dev grid');   // stop the game from booting
}

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({
  antialias: true, powerPreference: 'high-performance', stencil: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Cheap procedural IBL so the GLB hulls read as metal instead of black.
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.65;
const camera = new THREE.PerspectiveCamera(FOV_BASE, innerWidth / innerHeight, 2, 60000);
scene.add(camera);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  hangar?.resize(innerWidth, innerHeight);
});

const hud = new HUD(document.getElementById('ui'));
let hangar = null;
const input = new Input(renderer.domElement);
const touch = new TouchControls(document.getElementById('ui'));
const audio = new Audio();

const WORLD_SEED = 20250817;
const hf = new HeightField(WORLD_SEED);

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
class Player {
  constructor(ship, model, assist) {
    this.ship = ship;
    this.stats = resolveStats(ship);
    this.flight = new FlightModel(this.stats, { assist });
    this.loadout = new Loadout(ship, this.stats);
    this.model = model;
    this.hp = this.stats.hullMax;
    this.alive = true;
    this.radius = SHIP_RADIUS;
    this.isPlayer = true;
    this.shield = 0;
    this.invuln = 0;
    this.dmgReduction = 0;
    this.abilityCd = 0;
    this.abilityT = 0;
    this.score = 0;
    this.kills = 0;
    this.pickups = 0;

    // engine glow + trail
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(ship.accent), transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    this.thruster = new THREE.Mesh(new THREE.ConeGeometry(19, 110, 8), glowMat);
    this.thruster.rotation.x = Math.PI / 2;   // taper points aft (+Z)
    this.thruster.position.z = 120;
    model.add(this.thruster);
    this.glowMat = glowMat;
  }

  get position() { return this.flight.position; }
  get velocity() { return this.flight.velocity; }

  applyDamage(dmg) {
    if (this.invuln > 0) return;
    dmg *= 1 - this.dmgReduction;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed; dmg -= absorbed;
    }
    if (dmg <= 0) return;
    this.hp -= dmg;
    hud.flashDamage(Math.min(1, dmg / 45));
    audio.hurt();
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  heal(v) { this.hp = Math.min(this.stats.hullMax, this.hp + v); }
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------
class Game {
  constructor() {
    this.state = 'menu';
    this.camMode = 0;
    this.shake = 0;
    this.camPos = new THREE.Vector3();
    this.camQuat = new THREE.Quaternion();
    this.fov = FOV_BASE;
    this.acc = 0;
    this.stick = { x: 0, y: 0 };
    this.lock = null;
    this.lockStrength = 0;
        this.targets = [];
    this.time = 0;
    this.frameTimes = [];
  }

  async start(cfg) {
    this.cfg = cfg;
    this.mode = cfg.mode;
    this.goal = cfg.mode === 'chill' ? 0 : (cfg.goal || 0);
    this.goalMet = false;
    this.crashing = false;
    this.wreck = null;
    this.stick.x = 0; this.stick.y = 0;
    this.lock = null; this.lockStrength = 0; this.manualLock = false;
    const ship = SHIPS_BY_ID[cfg.ship];

    hud.showLoading(`LOADING ${ship.name}`);
    let model;
    try {
      model = await loadShipModel(ship, (e) => {
        if (e.total) hud.setProgress(e.loaded / e.total);
      });
    } catch (err) {
      console.error('model load failed', err);
      model = new THREE.Mesh(
        new THREE.ConeGeometry(60, 240, 5),
        new THREE.MeshLambertMaterial({ color: 0x8899cc, flatShading: true }),
      );
      model.rotation.x = -Math.PI / 2;
    }
    // Opposition flies real hulls from the same library, never the player's own.
    const enemyDefs = pickEnemyShips(ship.id, this.mode === 'race' ? 5 : 3, this.mode === 'race' ? 1 : 0);
    hud.showLoading('WARMING UP THE OPPOSITION');
    const enemyHulls = [];
    for (let i = 0; i < enemyDefs.length; i++) {
      hud.setProgress(i / enemyDefs.length);
      try {
        const m = await loadShipModel(enemyDefs[i]);
        m.userData.accent = new THREE.Color(enemyDefs[i].accent).getHex();
        enemyHulls.push(m);
      } catch (e) {
        console.warn('enemy hull failed', enemyDefs[i].id, e);
      }
    }
    hud.setProgress(1);

    this.teardown();
    this.env = new Environment(scene, this.mode === 'race' ? 'dusk' : 'noon', WORLD_SEED, renderer);
    this.terrain = new TerrainStreamer(scene, hf, { radius: 6, budgetPerFrame: 3 });
    this.combat = new CombatSystem(scene);
    this.combat.prewarm(renderer, camera);

    this.playerModel = model;
    scene.add(model);
    this.player = new Player(ship, model, cfg.assist === 'standard' ? ASSIST.STANDARD : ASSIST.ASSISTED);
    this.targets = [this.player];

    if (this.mode === 'free') this._setupFree(enemyHulls);
    else if (this.mode === 'chill') this._setupChill(enemyHulls);
    else this._setupRace(enemyHulls, enemyDefs);

    // Pooled hostiles report their own kills when they retire; this only
    // covers targets the combat system owns outright (race rivals).
    this.combat.onKill = (t, owner) => {
      if (owner !== this.player || t === this.player || t.pooled) return;
      this.player.score += t.score ?? 100;
      this.player.kills++;
      hud.pop(`+${t.score ?? 100}`, '#ff4fd8');
      audio.boom();
    };

    // pre-warm terrain around spawn so we don't launch into the void
    for (let i = 0; i < 26; i++) this.terrain.update(this.player.position.x, this.player.position.z);

    hud.hideLoading();
    hud.hideMenu();
    hangar.setInteractive(false);
    this.state = 'play';
    this.time = 0;
    audio.ensure();
    input.requestLock();
    if (IS_TOUCH) {
      // Zero the tilt to however the handset is being held at the moment of
      // launch, so "level" is wherever the player is comfortable.
      touch.recentre();
      touch.throttleSet = null;
      touch.setVisible(true);
    }
  }

  _setupFree(hulls = []) {
    const p = this.player;
    p.flight.position.set(0, Math.max(hf.height(0, 0), 0) + 1200, 0);
    p.flight.velocity.set(0, 0, -260);
    this.field = new CollectibleField(scene, hf, WORLD_SEED + 5);
    this.drones = new DroneSwarm(scene, hf, this.combat, { max: 5, hulls });
    this.drones.prewarm(renderer, camera, scene);
    this.drones.onKill = (d) => {
      this.player.score += d.score ?? 200;
      this.player.kills++;
      hud.pop(`+${d.score ?? 200}`, '#ff4fd8');
      audio.boom();
    };
    this.runTime = 0;
    this.combo = 0;
    this.comboT = 0;
    hud.toast('COLLECT THE SHARDS', '#5ef2ff');
  }

  _setupChill(hulls = []) {
    const p = this.player;
    p.flight.position.set(0, Math.max(hf.height(0, 0), 0) + 1400, 0);
    p.flight.velocity.set(0, 0, -280);
    this.drifters = new Drifters(scene, hf, this.combat, { max: 4, hulls });
    this.drifters.prewarm(renderer, camera, scene);
    this.drifters.onHail = (d, line) => hud.hail(d.name, line);
    this.runTime = 0;
    this.ambience = 1;
    audio.music(true, 'chillMusic');
    hud.toast('CHILL VIBES', '#7affd6', 2600);
  }

  _setupRace(hulls = [], defs = []) {
    this.track = new Track(hf, WORLD_SEED);
    this.gates = new GateField(scene, this.track);
    this.nextGate = 0;
    this.raceTime = 0;
    this.timeLeft = 32;
    this.gatesCleared = 0;
    this.gatesMissed = 0;
    this.lap = 1;
    this.bestGateStreak = 0;
    this.streak = 0;

    const start = this.track.sample(2, new THREE.Vector3());
    const tan = this.track.tangent(2, new THREE.Vector3());
    this.player.flight.position.copy(start).addScaledVector(tan, -900);
    this.player.flight.quaternion.setFromUnitVectors(FWD, tan);
    this.player.flight.velocity.copy(tan).multiplyScalar(240);
    this.playerF = 0;

    this.racers = RACER_ROSTER.map((r, i) => {
      const a = new AIRacer(scene, this.track, {
        ...r, startF: 1.5 + i * 1.9, hull: hulls[i % Math.max(1, hulls.length)],
      });
      a.shipName = defs[i % Math.max(1, defs.length)]?.name;
      this.targets.push(a);
      return a;
    });
    hud.toast('FLY THROUGH THE GATES', '#b6ff3d');
  }

  teardown() {
    if (this.terrain) this.terrain.dispose();
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const c = scene.children[i];
      if (c === camera) continue;
      scene.remove(c);
    }
    scene.add(camera);
    this.crashing = false; this.wreck = null;
    this.field = null; this.drones = null; this.track = null; this.drifters = null;
    hud.setAmbience(1);
    this.gates = null; this.racers = null;
  }

  // -------------------------------------------------------------------------
  handleInput(dt) {
    const p = this.player;
    const f = p.flight;

    // --- steering ---------------------------------------------------------
    // Mouse drives a virtual stick that holds its deflection (so a bank can be
    // carried through a full 180) but needs a deliberate movement to reach the
    // edges, and responds gently near centre.
    const [mx, my] = input.consumeMouse();
    const sens = 0.0015 * input.sensitivity;         // ~660px for full throw
    this.stick.x = THREE.MathUtils.clamp(this.stick.x + mx * sens, -1, 1);
    this.stick.y = THREE.MathUtils.clamp(this.stick.y + my * sens * (input.invertY ? -1 : 1), -1, 1);

    // Gentle self-centring: an unattended ship levels out, a held turn does not.
    const centre = Math.exp(-dt * (p.flight.assist === ASSIST.ASSISTED ? 0.35 : 0.15));
    this.stick.x *= centre;
    this.stick.y *= centre;

    // Touch and tilt are absolute, not incremental: the stick sits wherever the
    // finger or the handset is pointing right now. Applied after the centring
    // decay so a held deflection stays put, and left alone when nothing is
    // driving them, which lets the decay level the ship out on release.
    if (touch.active) {
      const t = touch.axes(_touchAxes);
      this.stick.x = t.x;
      this.stick.y = t.y;
    }

    const kPitch = input.axis('ArrowUp', 'ArrowDown');
    const kRoll = input.axis('KeyA', 'KeyD');
    const kYaw = input.axis('KeyQ', 'KeyE');

    // Snap the stick to centre when the keyboard takes over that axis, or on X.
    if (kRoll || input.down('KeyX')) this.stick.x = 0;
    if (kPitch || input.down('KeyX')) this.stick.y = 0;

    // Dead zone + expo curve: fine aiming near centre, full authority at the edge.
    const shape = (v) => {
      const a = Math.abs(v);
      if (a < DEAD_ZONE) return 0;
      const t = (a - DEAD_ZONE) / (1 - DEAD_ZONE);
      return Math.sign(v) * Math.pow(t, 1.85);
    };

    f.ctl.pitch = THREE.MathUtils.clamp(-shape(this.stick.y) + kPitch, -1, 1);
    f.ctl.roll = THREE.MathUtils.clamp(shape(this.stick.x) + kRoll, -1, 1);
    f.ctl.yaw = kYaw;

    // --- throttle ---------------------------------------------------------
    const th = input.axis('KeyS', 'KeyW');
    if (th) touch.throttleSet = null;         // the keyboard takes the rail back
    f.throttle = THREE.MathUtils.clamp(f.throttle + th * dt * 1.15, 0, 1);
    if (touch.throttleSet !== null) {
      // The rail is an absolute demand, but easing into it keeps the engine
      // note from snapping when a thumb jumps across the strip.
      f.throttle += (touch.throttleSet - f.throttle) * (1 - Math.exp(-dt * 9));
    }
    touch.setThrottleReadout(f.throttle);
    f.wantBoost = input.down('ShiftLeft') || input.down('ShiftRight') || touch.boost;
    f.braking = input.down('ControlLeft') || input.down('ControlRight') || touch.brake;

    // --- weapons ----------------------------------------------------------
    const lo = p.loadout;
    lo.update(dt);
    const wantPrimary = input.mouse(0) || input.down('Space') || touch.primary;
    const wantSecondary = input.mouse(2) || input.down('KeyF') || touch.secondary;

    f.forward(_v);
    const muzzle = _v2.copy(f.position).addScaledVector(_v, MUZZLE_FWD);
    if (this.mode === 'chill') { this.lock = null; this.lockStrength = 0; }
    else this.updateLock(dt, _v);

    if (wantPrimary) {
      const w = lo.primary;
      const aim = this.assistedAim(muzzle, _v, w.speed ?? 4000, _aim);
      if (w.kind === 'beam') {
        if (!lo.overheated) {
          this.combat.beam(w, muzzle, aim, p, this.targets, dt, p.mods?.dmg ?? 1);
          lo.noteBeamHeat(dt, this.abilityHeatMult ?? 1);
        }
      } else if (lo.canPrimary()) {
        this.combat.fireProjectile(w, muzzle, aim, f.quaternion, p);
        lo.notePrimary(this.abilityRofMult ?? 1, this.abilityHeatMult ?? 1);
        audio.shot('gun');
        this.shake = Math.min(1, this.shake + 0.05);
      }
    }

    if (wantSecondary && lo.canSecondary()) {
      const w = lo.secondary;
      const target = this.lock ?? null;
      const aim = target
        ? _aim.copy(target.position).sub(muzzle).normalize()
        : _aim.copy(_v);
      this.combat.fireMissile(w, muzzle, aim, p, target, 1, f.velocity);
      lo.noteSecondary();
      audio.shot('missile');
      this.shake = Math.min(1, this.shake + 0.18);
      if (target) hud.toast('MISSILE AWAY', '#ffb347', 700);
    }

    // --- ability ----------------------------------------------------------
    if ((input.pressed('KeyR') || touch.tapped('ability')) && p.abilityCd <= 0) this.triggerAbility();

    if (input.pressed('KeyT') || touch.tapped('target')) this.cycleLock(_v);
    if (input.pressed('KeyC') || touch.tapped('camera')) this.camMode = (this.camMode + 1) % 3;
    if (touch.tapped('recentre')) {
      touch.recentre();
      this.stick.x = 0; this.stick.y = 0;
      hud.toast('CONTROLS ZEROED', '#5ef2ff', 700);
    }
    if (touch.tapped('pause')) { this.pause(); return; }
    if (input.pressed('KeyM')) {
      const m = audio.toggleMute();
      hud.muted = m;
      hud.toast(m ? 'AUDIO MUTED' : 'AUDIO ON', '#5ef2ff', 800);
    }
    if (input.pressed('BracketLeft')) nudgeOrientation(this.playerModel, -Math.PI / 2);
    if (input.pressed('BracketRight')) nudgeOrientation(this.playerModel, Math.PI / 2);
    if (input.pressed('Backslash')) resetOrientation(this.playerModel);
  }

  /**
   * Sticky lock-on: picks whatever hostile sits closest to the nose inside the
   * acquisition cone, and keeps it until it leaves a wider break cone. Feeds
   * both the aim assist and the missile seekers.
   */
  updateLock(dt, fwd) {
    const p = this.player;
    const ACQUIRE = 0.90;      // ~26 deg half-angle to gain a lock
    const BREAK = 0.72;        // ~44 deg before it drops
    const RANGE = 4800;

    const score = (t) => {
      if (!t || !t.alive || t === p) return null;
      _v3.copy(t.position).sub(p.flight.position);
      const d = _v3.length();
      if (d > RANGE) return null;
      return { dot: _v3.divideScalar(d).dot(fwd), d };
    };

    // best candidate available right now
    let best = null, bestDot = -1;
    for (const t of this.targets) {
      const sc = score(t);
      if (sc && sc.dot > bestDot) { bestDot = sc.dot; best = t; }
    }

    const held = score(this.lock);
    if (this.manualLock && held && held.dot > BREAK) {
      // player picked this one with T — leave it alone
    } else if (held && held.dot > BREAK && !(best && bestDot > held.dot + 0.05)) {
      // keep the current lock unless something is clearly better centred
    } else {
      this.manualLock = false;
      this.lock = bestDot > ACQUIRE ? best : null;
      this.lockStrength = 0;
    }

    this.lockStrength = this.lock
      ? Math.min(1, (this.lockStrength ?? 0) + dt * 3)
      : 0;
    return this.lock;
  }

  /** T cycles the lock through whatever is in front, nearest first. */
  cycleLock(fwd) {
    const p = this.player;
    const cands = this.targets
      .filter((t) => t !== p && t.alive)
      .map((t) => {
        _v3.copy(t.position).sub(p.flight.position);
        const d = _v3.length();
        return { t, d, dot: _v3.divideScalar(d).dot(fwd) };
      })
      .filter((c) => c.dot > 0.35 && c.d < 6000)
      .sort((a, b) => a.d - b.d);
    if (!cands.length) { this.lock = null; this.manualLock = false; return; }
    const i = cands.findIndex((c) => c.t === this.lock);
    this.lock = cands[(i + 1) % cands.length].t;
    this.lockStrength = 0;
    this.manualLock = true;
    audio.ui();
  }

  /**
   * Intercept point for a projectile of `speed` — two fixed-point iterations
   * are plenty at these ranges.
   */
  leadPoint(target, origin, speed, out) {
    out.copy(target.position);
    const vel = target.velocity ?? target.vel;
    if (!vel || speed <= 0) return out;
    for (let i = 0; i < 2; i++) {
      const t = THREE.MathUtils.clamp(out.distanceTo(origin) / speed, 0, 1.2);
      out.copy(target.position).addScaledVector(vel, t);
    }
    return out;
  }

  /** Blend raw nose aim toward the intercept point, scaled by lock confidence. */
  assistedAim(origin, fwd, speed, out) {
    out.copy(fwd);
    if (!this.lock || !this.lock.alive) return out;
    this.leadPoint(this.lock, origin, speed, _v3).sub(origin).normalize();
    return out.lerp(_v3, 0.85 * (this.lockStrength ?? 0)).normalize();
  }

  triggerAbility() {
    const p = this.player;
    const a = p.ship.ability;
    p.abilityCd = a.cd;
    p.abilityT = a.dur;
    this.activeAbility = a.id;
    hud.toast(a.name, p.ship.accent, 900);
    audio.ability();

    if (a.id === 'sugarRush') p.flight.boostFuel = p.stats.boostMax;
    if (a.id === 'aegis') p.shield = 300;
    if (a.id === 'blink') {
      p.flight.forward(_v);
      p.flight.position.addScaledVector(_v, a.dist ?? 2500);
      this.shake = 1;
      this.combat.spark(p.flight.position, 0xc66bff, 1, 260);
    }
    if (a.id === 'vortex' && this.field) this.vortexT = a.dur;
  }

  updateAbility(dt) {
    const p = this.player;
    p.abilityCd = Math.max(0, p.abilityCd - dt);
    p.abilityT = Math.max(0, p.abilityT - dt);
    const on = p.abilityT > 0;
    const id = this.activeAbility;

    const m = p.flight.mods;
    m.speed = 1; m.thrust = 1; m.turn = 1; m.drag = 1;
    p.invuln = 0; p.dmgReduction = 0;
    this.abilityRofMult = 1; this.abilityHeatMult = 1;
    this.magnetBoost = 1;

    if (on) {
      if (id === 'phaseCoil') { p.invuln = 1; m.turn = 1.4; }
      if (id === 'sugarRush') { m.speed = 1.25; m.thrust = 1.3; }
      if (id === 'vortex') this.magnetBoost = 10;
      if (id === 'bulwark') p.dmgReduction = 0.7;
      if (id === 'overspin') { this.abilityRofMult = 2; this.abilityHeatMult = 0; }
      if (id === 'slipstream') { m.drag = 0.25; m.speed = 1.45; }
      if (id === 'overdrive') { m.speed = 1.3; m.thrust = 1.3; m.turn = 1.3; }
    }
    if (p.shield > 0 && id === 'aegis' && p.abilityT <= 0) p.shield = 0;
  }

  // -------------------------------------------------------------------------
  update(dt) {
    const p = this.player;
    this.time += dt;

    if (this.crashing) {
      this.terrain.update(p.flight.position.x, p.flight.position.z);
      this.env.update(dt, p.flight.position);
      this.combat.update(dt, this.targets, hf);
      this.updateWreck(dt);
      this.updateCamera(dt);
      return;
    }

    this.handleInput(dt);
    this.updateAbility(dt);

    // fixed-step physics with bounded catch-up
    const H = 1 / 120;
    this.acc += Math.min(dt, 0.1);
    let steps = 0;
    while (this.acc >= H && steps < 8) {
      p.flight.step(H, hf);
      this.acc -= H;
      steps++;
    }

    if (p.flight.crashed && !this.crashing) {
      if (this.mode === 'chill') {
        // Nothing ends a drift. Scrape the ground and you get bounced back up.
        p.flight.velocity.y = Math.abs(p.flight.velocity.y) * 0.4 + 60;
        p.flight.position.y += 40;
        this.shake = Math.min(1, this.shake + 0.35);
      } else {
        this.crash(p.flight.lastImpact);
      }
    }

    // model follows physics
    this.playerModel.position.copy(p.flight.position);
    this.playerModel.quaternion.copy(p.flight.quaternion);
    const boost = p.flight.boosting;
    p.thruster.scale.set(1, 0.45 + p.flight.throttle * 0.9 + (boost ? 1.6 : 0), 1);
    p.glowMat.opacity = 0.4 + p.flight.throttle * 0.45 + (boost ? 0.3 : 0);

    this.terrain.update(p.flight.position.x, p.flight.position.z);
    this.env.update(dt, p.flight.position);
    this.combat.update(dt, this.targets, hf);

    if (this.mode === 'free') this.updateFree(dt);
    else if (this.mode === 'chill') this.updateChill(dt);
    else this.updateRace(dt);

    this.updateCamera(dt);

    audio.engine(THREE.MathUtils.clamp(p.flight.speed / p.stats.maxSpeed, 0, 1.2), boost);

    if (!p.alive && !this.crashing && this.mode !== 'chill') this.crash(p.flight.speed * 0.4);
  }

  updateFree(dt) {
    const p = this.player;
    this.runTime += dt;
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT <= 0) this.combo = 0;

    const magnet = p.stats.magnet * (this.magnetBoost ?? 1);
    const got = this.field.update(dt, p.flight.position, magnet);
    for (const it of got) {
      this.combo++;
      this.comboT = 3.2;
      const mult = p.stats.scoreMult * (1 + Math.min(this.combo, 20) * 0.05);
      const pts = Math.round(it.type.score * mult);
      p.score += pts;
      p.pickups++;
      if (it.type === PICKUP.BOOST) p.flight.boostFuel = p.stats.boostMax;
      if (it.type === PICKUP.REPAIR) p.heal(45);
      if (it.type === PICKUP.CORE) hud.toast('NEXUS CORE', '#ff4fd8', 1100);
      hud.pop(`+${pts}${this.combo > 2 ? ` ×${this.combo}` : ''}`,
        it.type === PICKUP.CORE ? '#ff4fd8' : '#5ef2ff');
      audio.pickup(it.type === PICKUP.CORE);
    }

    if (this.goal && p.pickups >= this.goal && !this.goalMet) {
      this.goalMet = true;
      hud.toast('GOAL COMPLETE', '#b6ff3d', 1800);
      this.finish();
      return;
    }

    this.drones.update(dt, p, this.field);
    this.targets = [p, ...this.drones.live];
  }

  updateChill(dt) {
    const p = this.player;
    this.runTime += dt;
    this.drifters.update(dt, p);
    this.targets = [p, ...this.drifters.live];

    for (const s of this.drifters.live) {
      const near = s.position.distanceTo(p.flight.position) < 1600;
      if (near && !s._passed) { s._passed = true; this.drifters.seen = (this.drifters.seen ?? 0) + 1; }
      else if (!near && s.position.distanceTo(p.flight.position) > 2600) s._passed = false;
    }

    // The HUD dissolves over five minutes, down to a 5% ghost — the mode is
    // about the view, not the instruments.
    const k = Math.min(1, this.runTime / HUD_FADE_SECONDS);
    this.ambience = 1 - (k * k * (3 - 2 * k));
    hud.setAmbience(this.ambience, true);
  }

  updateRace(dt) {
    const p = this.player;
    this.raceTime += dt;
    this.timeLeft -= dt;

    const proj = this.track.project(p.flight.position, this.playerF ?? 0, 30);
    this.playerF = proj.f;
    this.offTrack = proj.dist;

    // gate clearing
    const gateNode = this.track.gateIndexToNode(this.nextGate);
    this.track.sample(gateNode, _v);
    const distToGate = _v.distanceTo(p.flight.position);
    if (distToGate < GATE_RADIUS && this.playerF > gateNode - 0.6) {
      this.clearGate();
    } else if (this.playerF > gateNode + 1.2) {
      this.missGate();
    }

    for (const r of this.racers) {
      r.update(dt, this.playerF);
      if (r.wasHit) {
        r.wasHit = false;
        p.score += 150;
        hud.pop('+150 TAKEDOWN', '#ff4fd8');
        audio.boom();
      }
    }
    this.gates.update(this.nextGate, this.time);
    this.targets = [p, ...this.racers];

    if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish(); }
  }

  clearGate() {
    this.nextGate++;
    this.gatesCleared++;
    this.streak++;
    this.bestGateStreak = Math.max(this.bestGateStreak, this.streak);
    const bonus = Math.min(6, 3.2 + this.streak * 0.08);
    this.timeLeft = Math.min(45, this.timeLeft + bonus);
    const pts = Math.round(100 * (1 + Math.min(this.streak, 25) * 0.06) * this.player.stats.scoreMult);
    this.player.score += pts;
    hud.pop(`+${pts}  +${bonus.toFixed(1)}s`, '#b6ff3d');
    audio.gate();
    if (this.goal && this.gatesCleared >= this.goal && !this.goalMet) {
      this.goalMet = true;
      hud.toast('GOAL COMPLETE', '#b6ff3d', 1800);
      this.finish();
      return;
    }
    if (this.gatesCleared % 10 === 0) {
      this.lap++;
      hud.toast(`SECTOR ${this.lap}`, '#ffd66b', 1200);
      this.timeLeft = Math.min(48, this.timeLeft + 5);
    }
  }

  missGate() {
    this.nextGate++;
    this.gatesMissed++;
    this.streak = 0;
    this.timeLeft -= 1.5;
    hud.pop('GATE MISSED −1.5s', '#ff4d3d');
    audio.miss();
  }

  /** Terrain impact: fireball, wreck tumble, then the run is over. */
  crash(impact) {
    const p = this.player;
    this.crashing = true;
    this.shake = 1.6;

    this.combat.fireball(p.flight.position, (110 + Math.min(impact, 300) * 0.5) * FX_SCALE, 0xffb347);
    audio.boom();
    hud.flash('#ffd9a0', 0.85);
    hud.toast('WRECKED', '#ff4d3d', 2000);

    // hide the intact hull, leave a tumbling wreck for the camera to watch
    this.playerModel.visible = false;
    p.hp = 0;
    p.alive = false;

    const wreck = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a3138, flatShading: true });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Mesh(
        new THREE.TetrahedronGeometry((2.4 + Math.random() * 4.5) * 7, 0), mat);
      g.position.copy(p.flight.position);
      wreck.add(g);
      g.userData.vel = new THREE.Vector3(
        (Math.random() - 0.5) * 380,
        140 + Math.random() * 260,
        (Math.random() - 0.5) * 380,
      ).addScaledVector(p.flight.velocity, 0.25);
      g.userData.spin = new THREE.Vector3(
        Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
    }
    scene.add(wreck);
    this.wreck = wreck;
    this.crashT = 0;
  }

  updateWreck(dt) {
    this.crashT += dt;
    for (const g of this.wreck.children) {
      g.userData.vel.y -= 240 * dt;
      g.position.addScaledVector(g.userData.vel, dt);
      g.rotation.x += g.userData.spin.x * dt;
      g.rotation.y += g.userData.spin.y * dt;
      g.rotation.z += g.userData.spin.z * dt;
      const gy = hf.height(g.position.x, g.position.z) + 12;
      if (g.position.y < gy) {
        g.position.y = gy;
        g.userData.vel.y = Math.abs(g.userData.vel.y) * 0.32;
        g.userData.vel.multiplyScalar(0.7);
      }
      if (Math.random() < dt * 3) this.combat.spark(g.position, 0xff8844, 1, 34);
    }
    if (this.crashT > 2.2) this.finish();
  }

  // -------------------------------------------------------------------------
  updateCamera(dt) {
    const p = this.player;
    const f = p.flight;
    if (this.crashing) {
      const focus = this.wreck.children[0]?.position ?? f.position;
      const target = _v3.copy(focus).add(
        new THREE.Vector3(Math.cos(this.crashT * 0.7), 0.42, Math.sin(this.crashT * 0.7)).multiplyScalar(760));
      target.y = Math.max(target.y, hf.height(target.x, target.z) + 140, 160);
      this.camPos.lerp(target, 1 - Math.exp(-dt * 3.2));
      const m = new THREE.Matrix4().lookAt(this.camPos, focus, UP);
      _q.setFromRotationMatrix(m);
      this.camQuat.slerp(_q, 1 - Math.exp(-dt * 5));
      camera.position.copy(this.camPos);
      camera.quaternion.copy(this.camQuat);
      this.shake = Math.max(0, this.shake - dt * 1.4);
      if (this.shake > 0.001) {
        camera.position.x += (Math.random() - 0.5) * this.shake * 22;
        camera.position.y += (Math.random() - 0.5) * this.shake * 22;
      }
      return;
    }
    const spd01 = THREE.MathUtils.clamp(f.speed / p.stats.maxSpeed, 0, 1.3);

    f.forward(_v); f.up(_v2);
    let target;
    if (this.camMode === 2) {
      // cockpit
      target = _v3.copy(f.position).addScaledVector(_v, 60).addScaledVector(_v2, 34);
      this.camPos.lerp(target, 1 - Math.exp(-dt * 40));
      this.camQuat.slerp(f.quaternion, 1 - Math.exp(-dt * 26));
    } else {
      const back = this.camMode === 0 ? CAM_BACK : CAM_BACK_FAR;
      const up = this.camMode === 0 ? CAM_UP : CAM_UP_FAR;
      target = _v3.copy(f.position)
        .addScaledVector(_v, -(back + spd01 * CAM_BACK * 0.28))
        .addScaledVector(_v2, up);
      // lead by one frame of travel so the ship doesn't shrink at high speed
      target.addScaledVector(f.velocity, dt);
      // don't let the chase cam clip through terrain
      const gy = hf.height(target.x, target.z) + CAM_GROUND_CLEAR;
      if (target.y < gy) target.y = gy;
      this.camPos.lerp(target, 1 - Math.exp(-dt * 14));

      _q.copy(f.quaternion);
      // look slightly ahead of the nose
      const look = _v.clone().multiplyScalar(CAM_LOOK_AHEAD).add(f.position).addScaledVector(_v2, CAM_UP * 0.6);
      const m = new THREE.Matrix4().lookAt(this.camPos, look, _v2);
      _q.setFromRotationMatrix(m);
      this.camQuat.slerp(_q, 1 - Math.exp(-dt * 12));
    }

    camera.position.copy(this.camPos);
    camera.quaternion.copy(this.camQuat);

    // shake
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * 0.9 + (f.boosting ? 0.12 : 0);
    if (sh > 0.001) {
      camera.position.x += (Math.random() - 0.5) * sh * 16;
      camera.position.y += (Math.random() - 0.5) * sh * 16;
      camera.rotateZ((Math.random() - 0.5) * sh * 0.014);
    }

    // speed FOV
    const wantFov = FOV_BASE + spd01 * FOV_SPEED + (f.boosting ? FOV_BOOST : 0);
    this.fov += (wantFov - this.fov) * (1 - Math.exp(-dt * 5));
    if (Math.abs(camera.fov - this.fov) > 0.01) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
  }


  /** Collect nearby points of interest for the scanner. */
  radarBlips(range) {
    const p = this.player;
    const px = p.flight.position.x, pz = p.flight.position.z;
    const out = [];
    const r2 = (range * 1.35) ** 2;

    if (this.mode === 'chill') {
      for (const c of this.drifters.live) {
        out.push({ x: c.position.x, z: c.position.z, color: '#7affd6', size: 3.4 });
      }
      return out;
    }

    if (this.mode === 'free') {
      for (const [, items] of this.field.active) {
        for (const it of items) {
          if (this.field.taken.has(it.id)) continue;
          const dx = it.position.x - px, dz = it.position.z - pz;
          if (dx * dx + dz * dz > r2) continue;
          const core = it.type === PICKUP.CORE;
          out.push({
            x: it.position.x, z: it.position.z,
            color: '#' + it.type.color.toString(16).padStart(6, '0'),
            size: core ? 5 : 3.4,
          });
        }
      }
      for (const [, site] of this.field.sites) {
        if (site.remaining <= 0) continue;
        out.push({
          x: site.pos.x, z: site.pos.z, kind: 'site',
          color: site.guarded ? '#ff8844' : '#7affd6',
          size: site.guarded ? 7 : 5.5,
        });
      }
      for (const d of this.drones.drones) {
        if (!d.alive) continue;
        out.push({ x: d.position.x, z: d.position.z, color: '#ff3355', size: 3.2 });
      }
    } else {
      for (let g = 0; g < 8; g++) {
        this.track.gatePos(this.nextGate + g, _v);
        out.push({
          x: _v.x, z: _v.z, kind: 'gate', size: g === 0 ? 4 : 2.6,
          color: g === 0 ? '#b6ff3d' : '#5ef2ff',
        });
      }
      for (const r of this.racers) {
        out.push({
          x: r.position.x, z: r.position.z, size: 3.2,
          color: '#' + r.color.toString(16).padStart(6, '0'),
        });
      }
    }
    return out;
  }

  /** Project live hostiles to screen space for the targeting overlay. */
  screenTargets() {
    const p = this.player;
    const out = [];
    const halfW = innerWidth / 2, halfH = innerHeight / 2;
    for (const t of this.targets) {
      if (t === p || !t.alive) continue;
      const dist = t.position.distanceTo(p.flight.position);
      if (dist > 6000) continue;

      _proj.copy(t.position).project(camera);
      const behind = _proj.z > 1;
      const x = halfW + _proj.x * halfW;
      const y = halfH - _proj.y * halfH;
      // apparent radius: project a point one hull-radius off to the side
      _v3.copy(t.position).add(_v2.set(1, 0, 0).applyQuaternion(camera.quaternion)
        .multiplyScalar(t.radius ?? 16));
      _v3.project(camera);
      const r = Math.abs((_v3.x - _proj.x) * halfW);

      out.push({
        x, y, behind,
        r: THREE.MathUtils.clamp(r, 16, 190),
        dist,
        locked: t === this.lock,
        lockT: t === this.lock ? (this.lockStrength ?? 0) : 0,
        hp01: this.mode === 'chill' ? 1 : (t.maxHp ? THREE.MathUtils.clamp(t.hp / t.maxHp, 0, 1) : 1),
        name: t.name ?? null,
        quiet: this.mode === 'chill',
        color: this.mode === 'chill'
          ? '#7ad4ff'
          : (t.color ? '#' + t.color.toString(16).padStart(6, '0') : '#ff3355'),
      });
    }
    return out;
  }

  // -------------------------------------------------------------------------
  renderHUD() {
    const p = this.player;
    const f = p.flight;
    const lo = p.loadout;
    const d = {
      speed: f.speed,
      alt: f.position.y,
      agl: Math.max(0, f.agl ?? 0),
      boost: f.boostFuel / p.stats.boostMax,
      heat: lo.heat,
      hull: p.hp / p.stats.hullMax,
      overheat: lo.overheated,
      weaponName: lo.primary.name,
      secondaryName: lo.secondary.name,
      ammo: lo.ammo,
      score: Math.round(p.score),
      abilityName: p.ship.ability.name,
      abilityReady: p.abilityCd <= 0,
      abilityCd: p.abilityCd,
    };
    if (this.goal) {
      d.goal = this.mode === 'free'
        ? { label: 'PICKUPS COLLECTED', have: p.pickups, need: this.goal }
        : { label: 'GATES CLEARED', have: this.gatesCleared, need: this.goal };
    }

    if (this.mode === 'chill') {
      d.sub = `${this.drifters.live.length} CRAFT IN RANGE`;
      d.top = `<div class="lbl">CHILL VIBES</div>
        <div style="font-size:19px;color:#e8f4ff">${fmtTime(this.runTime)}</div>
        <div class="lbl" style="margin-top:3px">NO DESTINATION</div>`;
      d.board = '';
    } else if (this.mode === 'free') {
      d.sub = `${p.pickups} PICKUPS · ${p.kills} KILLS${this.combo > 2 ? ` · COMBO ×${this.combo}` : ''}`;
      const home = this.drones.home;
      const siteKm = home ? f.position.distanceTo(home.pos) / 1000 : null;
      d.top = `<div class="lbl">FREE RANGE</div>
        <div style="font-size:19px;color:#e8f4ff">${fmtTime(this.runTime)}</div>
        <div class="lbl" style="margin-top:3px">${home
          ? (this.drones.engaged
              ? '<span style="color:#ff4d3d">GARRISON ENGAGED</span>'
              : `GUARDED CACHE ${siteKm.toFixed(1)}KM`)
          : 'NO CONTACTS'}</div>`;
      d.board = '';
    } else {
      const board = [{ name: 'YOU', f: this.playerF, me: true, color: '#b6ff3d' },
        ...this.racers.map((r) => ({ name: r.name, f: r.f, color: '#' + r.color.toString(16).padStart(6, '0') }))]
        .sort((a, b) => b.f - a.f);
      const myPos = board.findIndex((b) => b.me) + 1;
      d.sub = `P${myPos}/${board.length} · ${this.gatesCleared} GATES`;
      const crit = this.timeLeft < 6;
      d.top = `<div class="lbl">TIME</div>
        <div style="font-size:34px;font-weight:700;color:${crit ? '#ff4d3d' : '#e8f4ff'};line-height:1">
          ${this.timeLeft.toFixed(1)}</div>
        <div class="lbl" style="margin-top:3px">SECTOR ${this.lap} · GATE ${this.nextGate + 1} · STREAK ${this.streak}</div>`;
      d.board = `<div class="lbl" style="margin-bottom:5px">CIRCUIT</div>` + board.map((b, i) =>
        `<div class="r ${b.me ? 'me' : ''}"><span><span class="p">${i + 1}</span> ${b.name}</span>
          <span style="color:${b.color}">${Math.round(b.f * NODE_SPACING / 100) / 10}k</span></div>`).join('');
    }
    hud.setHUD(d);
    hud.setStick(this.stick.x, this.stick.y);
    hud.drawTargets(this.screenTargets(), !this.crashing);

    const range = this.mode === 'race' ? 4500 : 14000;
    p.flight.forward(_v2);
    hud.drawRadar({
      px: f.position.x, pz: f.position.z,
      heading: Math.atan2(_v2.x, -_v2.z),
      range,
      blips: this.radarBlips(range),
      show: !this.crashing,
      shifted: this.mode === 'race',      // the circuit board owns the top-left
      legend: this.mode === 'chill'
        ? { key: 'chill', items: [['#7affd6', 'TRAFFIC']] }
        : this.mode === 'free'
          ? { key: 'free', items: [['#5ef2ff', 'SHARD'], ['#ff4fd8', 'CORE'], ['#ff8844', 'GUARDED'], ['#ff3355', 'HOSTILE']] }
          : { key: 'race', items: [['#b6ff3d', 'NEXT'], ['#5ef2ff', 'GATE'], ['#ff4fd8', 'RIVAL']] },
    });
  }

  finish() {
    if (this.state !== 'play') return;
    this.state = 'over';
    input.releaseLock();
    touch.setVisible(false);
    const p = this.player;
    if (this.mode === 'chill') {
      hud.setAmbience(1);
      hud.showResults(
        { title: 'DRIFT ENDED', lines: [
          ['TIME ADRIFT', fmtTime(this.runTime)],
          ['CRAFT PASSED', this.drifters.seen ?? '—'],
          ['FINAL SCORE', Math.round(p.score).toLocaleString(), 'total'],
        ] },
        () => this.start(this.cfg),
        () => this.toHangar(),
      );
      return;
    }
    const lines = this.mode === 'free'
      ? [
          ...(this.goal ? [['GOAL', `${Math.min(p.pickups, this.goal)} / ${this.goal} PICKUPS`]] : []),
          ['TIME AIRBORNE', fmtTime(this.runTime)],
          ['PICKUPS', p.pickups],
          ['DRONES DOWNED', p.kills],
          ['BEST COMBO', `×${this.combo}`],
          ['FINAL SCORE', Math.round(p.score).toLocaleString(), 'total'],
        ]
      : [
          ...(this.goal ? [['GOAL', `${Math.min(this.gatesCleared, this.goal)} / ${this.goal} GATES`]] : []),
          ['GATES CLEARED', this.gatesCleared],
          ['GATES MISSED', this.gatesMissed],
          ['BEST STREAK', this.bestGateStreak],
          ['DISTANCE', `${(this.playerF * NODE_SPACING / 1000).toFixed(2)} km`],
          ['SECTORS', this.lap],
          ['FINAL SCORE', Math.round(p.score).toLocaleString(), 'total'],
        ];
    hud.showResults(
      { title: this.goalMet ? 'GOAL COMPLETE' : (p.alive ? 'RUN COMPLETE' : 'HULL BREACH'), lines },
      () => this.start(this.cfg),
      () => this.toHangar(),
    );
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    input.releaseLock();
    touch.setVisible(false);
    hud.showPause(
      () => {
        this.state = 'play';
        input.requestLock();
        if (IS_TOUCH) { touch.recentre(); touch.setVisible(true); }
      },
      () => this.toHangar(),
    );
  }
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
const game = new Game();
hangar = new HangarStage(renderer);
hangar.resize(innerWidth, innerHeight);
hangar.attachControls(renderer.domElement);

hud.muted = audio.muted;
hud.onMuteChange = (m) => {
  audio.ensure();
  audio.setMuted(m);
  audio.music(!m);
};
hud.onUi = () => audio.ui();
hud.onSens = (v) => { input.sensitivity = v; touch.sensitivity = v; };
input.sensitivity = hud.sens;
touch.sensitivity = hud.sens;
touch.onFeedback = () => audio.ui();
hud.onPreview = (ship) => hangar.select(ship, (st) => hud.setPreviewState(st));

/**
 * Tilt steering needs the sensor, and iOS only hands it over from inside a
 * gesture — so the ask rides on the tap that picked the mode. If the handset
 * turns out to have no gyro, or the prompt is declined, quietly fall back to
 * the on-screen stick rather than launching with dead controls.
 */
async function useSteering(mode) {
  touch.setMode(mode);
  if (mode !== STEER.TILT) return;
  const live = await touch.enableGyro();
  if (live) return;
  touch.setMode(STEER.TOUCH);
  hud.setSteer(STEER.TOUCH);
  hud.toast('NO TILT SENSOR — TOUCH STEERING', '#ffb347', 1800);
}
hud.onSteer = (mode) => { audio.ui(); useSteering(mode); };

function toHangar() {
  audio.music(true, 'music');
  hud.setAmbience(1);
  hangar.setInteractive(true);
  game.state = 'menu';
  game.teardown();
  game.player = null;
  touch.setVisible(false);
  hud.showMenu((cfg) => {
    // Same gesture-bound ask as the steering chip, for players who never
    // touched the option and are launching on the default.
    if (IS_TOUCH && hud.steer === STEER.TILT && !touch.gyroLive) useSteering(STEER.TILT);
    game.start(cfg);
  });
}
game.toHangar = toHangar;

game.state = 'splash';
hud.showSplash(() => {
  audio.ensure();
  if (!audio.muted) audio.music(true);
  toHangar();
});
// spin something interesting behind the splash
hangar.select(hud.ship(), () => {});

addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && game.state === 'play') game.pause();
});
input.onUnlock = () => { if (game.state === 'play') game.pause(); };

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (game.state === 'splash' || game.state === 'menu') {
    hangar.render(dt);
  } else {
    if (game.state === 'play') game.update(dt);
    // Draw the world before the HUD, and never let an overlay error take the
    // frame down with it — a broken gauge should not blank the game.
    if (game.player) renderer.render(scene, camera);
    if (game.state === 'play') {
      try {
        game.renderHUD();
      } catch (err) {
        if (!game._hudErr) { game._hudErr = true; console.error('HUD render failed', err); }
      }
    }
  }
  input.endFrame();
  touch.endFrame();
}
requestAnimationFrame(loop);

// expose for quick tuning during the jam
window.__game = game;
window.__three = THREE;
window.__audio = audio;
window.__touch = touch;
