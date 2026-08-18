import * as THREE from 'three';
import { WEAPONS } from './ships.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, -1);

const boltGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
boltGeo.rotateX(Math.PI / 2); // align to -Z

const missileGeo = new THREE.ConeGeometry(0.9, 5.5, 6);
missileGeo.rotateX(-Math.PI / 2);

const flareGeo = new THREE.SphereGeometry(1, 8, 6);

function additive(color) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
}

// ---------------------------------------------------------------------------
export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'combat';
    scene.add(this.group);

    this.bolts = [];
    this.missiles = [];
    this.fx = [];
    this.pool = { bolt: [], missile: [], flare: [] };
    this.mats = new Map();
    this.beams = [];
    this.onKill = null;

    // Allocating meshes/materials during a kill costs a visible frame, so the
    // whole budget is built up front and only ever recycled after this.
    this._prealloc('bolt', boltGeo, 110, false);
    this._prealloc('missile', missileGeo, 28, false);
    this._prealloc('flare', flareGeo, 90, true);
  }

  _prealloc(kind, geo, n, ownMaterial) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, ownMaterial ? additive(0xffffff) : this.mat(0xffffff));
      m.visible = false;
      m.frustumCulled = false;
      this.group.add(m);
      this.pool[kind].push(m);
    }
  }

  /** Force shader/VAO setup once, before anything is on screen. */
  prewarm(renderer, camera) {
    const touched = [];
    for (const kind of Object.keys(this.pool)) {
      const m = this.pool[kind][0];
      if (m) { m.visible = true; touched.push(m); }
    }
    if (this._beamGeo === undefined) this._drawBeams();
    try { renderer.compile(this.scene, camera); } catch (e) { /* non-fatal */ }
    for (const m of touched) m.visible = false;
  }

  mat(color) {
    if (!this.mats.has(color)) this.mats.set(color, additive(color));
    return this.mats.get(color);
  }

  _take(kind, geo, color) {
    const p = this.pool[kind];
    let m = p.pop();
    if (kind === 'flare') {
      // flares fade individually, so each keeps its own material
      if (!m) { m = new THREE.Mesh(geo, additive(color)); this.group.add(m); }
      m.material.color.setHex(color);
      m.material.opacity = 0.95;
    } else {
      if (!m) { m = new THREE.Mesh(geo, this.mat(color)); this.group.add(m); }
      m.material = this.mat(color);
    }
    m.visible = true;
    return m;
  }

  _give(kind, mesh) { mesh.visible = false; this.pool[kind].push(mesh); }

  // -------------------------------------------------------------------------
  fireProjectile(w, origin, dir, quat, owner, dmgMult = 1) {
    const salvo = w.salvo ?? 1;
    for (let i = 0; i < salvo; i++) {
      const d = _v.copy(dir).normalize().clone();
      const spread = (w.spread ?? 0) + 0;
      if (salvo > 1 && w.salvoSpread) {
        const a = (i / salvo) * Math.PI * 2;
        d.x += Math.cos(a) * w.salvoSpread * 0.004;
        d.y += Math.sin(a) * w.salvoSpread * 0.004;
      }
      d.x += (Math.random() - 0.5) * spread * 2;
      d.y += (Math.random() - 0.5) * spread * 2;
      d.z += (Math.random() - 0.5) * spread * 2;
      d.normalize();

      const mesh = this._take('bolt', boltGeo, w.color);
      const [r, len] = w.size;
      mesh.scale.set(r, r, len);
      mesh.position.copy(origin);
      mesh.quaternion.setFromUnitVectors(FWD, d);

      this.bolts.push({
        mesh, dir: d, speed: w.speed, life: w.life,
        dmg: w.dmg * dmgMult, owner, w,
      });
    }
  }

  /**
   * @param launchVel the shooter's own velocity. A missile that leaves the rail
   *   at its muzzle speed alone is *slower* than a ship at cruise (620 m/s of
   *   missile vs 700+ m/s of interceptor), so the shooter overtakes it and it
   *   visibly streams backwards past the cockpit. Real hardpoints inherit the
   *   launch platform's velocity; so do these.
   */
  fireMissile(w, origin, dir, owner, target, dmgMult = 1, launchVel = null) {
    const salvo = w.salvo ?? 1;
    for (let i = 0; i < salvo; i++) {
      const d = dir.clone().normalize();
      if (salvo > 1) {
        const a = (i / salvo) * Math.PI * 2;
        d.x += Math.cos(a) * 0.05; d.y += Math.sin(a) * 0.05; d.normalize();
      }
      const mesh = this._take('missile', missileGeo, w.color);
      mesh.scale.setScalar(1);
      mesh.position.copy(origin);
      mesh.quaternion.setFromUnitVectors(FWD, d);

      const vel = launchVel ? launchVel.clone() : new THREE.Vector3();
      // strip any component pushing it backwards along the launch axis, then
      // add the motor kick so it always leaves the rail moving forward
      const along = vel.dot(d);
      if (along < 0) vel.addScaledVector(d, -along);
      vel.addScaledVector(d, Math.max(w.speed * 0.5, 260));

      this.missiles.push({
        mesh, vel, w, life: w.life, owner, target, dmg: w.dmg * dmgMult,
      });
    }
  }

  beam(w, origin, dir, owner, targets, dt, dmgMult = 1) {
    // instantaneous ray, damages the first target inside its cylinder
    let best = null, bestT = Infinity;
    for (const t of targets) {
      if (!t.alive || t === owner) continue;
      _v.copy(t.position).sub(origin);
      const proj = _v.dot(dir);
      if (proj < 0 || proj > w.range) continue;
      _v2.copy(dir).multiplyScalar(proj).add(origin);
      const dist = _v2.distanceTo(t.position);
      if (dist < (t.radius ?? 12) + 6 && proj < bestT) { best = t; bestT = proj; }
    }
    const end = _v3.copy(dir).multiplyScalar(best ? bestT : w.range).add(origin);
    this.beams.push({ a: origin.clone(), b: end.clone(), color: w.color, width: w.width, t: 0.06 });
    if (best) {
      this.damage(best, w.dps * dt * dmgMult, owner);
      if (Math.random() < dt * 22) this.spark(end, w.color, 6);
    }
    return best;
  }

  damage(target, dmg, owner) {
    if (!target.alive) return;
    if (target.applyDamage) target.applyDamage(dmg, owner);
    else {
      target.hp -= dmg;
      if (target.hp <= 0) { target.alive = false; this.onKill?.(target, owner); }
    }
  }

  explode(pos, radius, dmg, targets, owner, color = 0xffb347) {
    for (const t of targets) {
      if (!t.alive || t === owner) continue;
      const d = t.position.distanceTo(pos);
      if (d < radius) this.damage(t, dmg * (1 - d / radius), owner);
    }
    this.spark(pos, color, 1, radius * 0.5);
  }

  /** Big multi-stage fireball for crashes and kills. */
  fireball(pos, size = 90, color = 0xffb347) {
    this.spark(pos, 0xffffff, 1, size * 0.55);
    this.spark(pos, color, 1, size);
    this.spark(pos, 0xff4d2d, 1, size * 1.4);
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.3) * Math.PI;
      const r = size * (0.35 + Math.random() * 1.15);
      _v.set(Math.cos(a) * Math.cos(b), Math.sin(b) * 0.9 + 0.25, Math.sin(a) * Math.cos(b))
        .multiplyScalar(r).add(pos);
      this.spark(_v, i % 3 === 0 ? 0xffd66b : color, 1, size * (0.14 + Math.random() * 0.3));
    }
  }

  spark(pos, color, count = 5, size = 8) {
    const m = this._take('flare', flareGeo, color);
    m.position.copy(pos);
    m.scale.setScalar(size * 0.4);
    this.fx.push({ mesh: m, t: 0, dur: 0.42, size });
  }

  // -------------------------------------------------------------------------
  update(dt, targets, hf) {
    // bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      const travel = b.speed * dt;
      _v.copy(b.dir).multiplyScalar(travel);
      const prev = _v2.copy(b.mesh.position);
      b.mesh.position.add(_v);
      b.life -= dt;

      let hit = null;
      for (const t of targets) {
        if (!t.alive || t === b.owner) continue;
        // segment-sphere
        _v3.copy(t.position).sub(prev);
        const proj = THREE.MathUtils.clamp(_v3.dot(b.dir), 0, travel);
        const cx = prev.x + b.dir.x * proj, cy = prev.y + b.dir.y * proj, cz = prev.z + b.dir.z * proj;
        const dx = t.position.x - cx, dy = t.position.y - cy, dz = t.position.z - cz;
        if (dx * dx + dy * dy + dz * dz < Math.pow((t.radius ?? 12) + 3, 2)) { hit = t; break; }
      }

      const groundY = hf ? hf.height(b.mesh.position.x, b.mesh.position.z) : -1e9;
      if (hit || b.life <= 0 || b.mesh.position.y < groundY) {
        if (hit) { this.damage(hit, b.dmg, b.owner); this.spark(b.mesh.position, b.w.color, 3, 7); }
        else if (b.life > 0) this.spark(b.mesh.position, b.w.color, 2, 5);
        this._give('bolt', b.mesh);
        this.bolts.splice(i, 1);
      }
    }

    // missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      const w = m.w;
      if (m.target && m.target.alive) {
        // Lead against the missile's terminal speed, not its current speed, and
        // cap it hard: a head-on target's own velocity points past the shooter,
        // so an over-long lead time aims the seeker backwards.
        const terminal = Math.max(w.speed * 2.2, m.vel.length(), 1);
        const dist = m.target.position.distanceTo(m.mesh.position);
        const lead = THREE.MathUtils.clamp(dist / terminal, 0, 0.7);
        const tv = m.target.velocity ?? m.target.vel;
        _v.copy(m.target.position);
        if (tv) _v.addScaledVector(tv, lead);
        _v.sub(m.mesh.position).normalize();
        // Capture the speed BEFORE touching m.vel — copying into it first
        // clobbers the magnitude and pins the missile at a crawl forever.
        const speed = m.vel.length() || 1;
        _v2.copy(m.vel).divideScalar(speed);
        _v2.lerp(_v, 1 - Math.exp(-w.turn * dt)).normalize();
        m.vel.copy(_v2).multiplyScalar(speed);
      }
      _v.copy(m.vel).normalize().multiplyScalar(w.accel * dt);
      m.vel.add(_v);
      const sp = m.vel.length();
      const maxS = w.speed * 2.2 + 400;
      if (sp > maxS) m.vel.multiplyScalar(maxS / sp);
      m.mesh.position.addScaledVector(m.vel, dt);
      m.mesh.quaternion.setFromUnitVectors(FWD, _v.copy(m.vel).normalize());
      m.life -= dt;

      if (Math.random() < dt * 30) this.spark(m.mesh.position, 0xff8844, 1, 3.2);

      let boom = m.life <= 0;
      for (const t of targets) {
        if (!t.alive || t === m.owner) continue;
        if (t.position.distanceToSquared(m.mesh.position) < Math.pow((t.radius ?? 12) + 6, 2)) {
          this.damage(t, m.dmg, m.owner); boom = true; break;
        }
      }
      const gy = hf ? hf.height(m.mesh.position.x, m.mesh.position.z) : -1e9;
      if (m.mesh.position.y < gy) boom = true;

      if (boom) {
        if (w.splash) this.explode(m.mesh.position, w.splashR, w.splash, targets, m.owner, w.color);
        else this.spark(m.mesh.position, w.color, 4, 14);
        this._give('missile', m.mesh);
        this.missiles.splice(i, 1);
      }
    }

    // fx
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      const k = f.t / f.dur;
      if (k >= 1) { this._give('flare', f.mesh); this.fx.splice(i, 1); continue; }
      f.mesh.scale.setScalar(f.size * (0.4 + k * 1.9));
      f.mesh.material.opacity = 0.92 * (1 - k) * (1 - k);
    }

    // beams decay
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].t -= dt;
      if (this.beams[i].t <= 0) this.beams.splice(i, 1);
    }
    this._drawBeams();
  }

  _drawBeams() {
    if (!this._beamGeo) {
      const g = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, -0.5);
      this._beamGeo = g;
      this._beamMeshes = [];
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(g, additive(0xffffff));
        m.visible = false;
        m.frustumCulled = false;
        this.group.add(m);
        this._beamMeshes.push(m);
      }
    }
    while (this._beamMeshes.length < this.beams.length) {
      const m = new THREE.Mesh(this._beamGeo, additive(0xffffff));
      this.group.add(m); this._beamMeshes.push(m);
    }
    for (let i = 0; i < this._beamMeshes.length; i++) {
      const mesh = this._beamMeshes[i];
      const b = this.beams[i];
      if (!b) { mesh.visible = false; continue; }
      mesh.visible = true;
      mesh.material.color.setHex(b.color);
      mesh.material.opacity = 0.55 + Math.random() * 0.35;
      mesh.position.copy(b.a);
      _v.copy(b.b).sub(b.a);
      const len = _v.length();
      mesh.quaternion.setFromUnitVectors(FWD, _v.normalize());
      const w = b.width * (0.8 + Math.random() * 0.5);
      mesh.scale.set(w, w, len);
    }
  }
}

// ---------------------------------------------------------------------------
// Per-ship weapon controller: heat, cooldowns, ammo
// ---------------------------------------------------------------------------
export class Loadout {
  constructor(ship, stats) {
    this.primary = WEAPONS[ship.primary];
    this.secondary = WEAPONS[ship.secondary];
    this.ammoMax = ship.secondaryAmmo ?? 8;
    this.ammo = this.ammoMax;
    this.heat = 0;
    this.overheated = false;
    this.heatMult = stats.heatMult;
    this._pcd = 0;
    this._scd = 0;
    this._ammoRegen = 0;
  }

  update(dt) {
    this._pcd -= dt; this._scd -= dt;
    const cool = this.overheated ? 0.42 : 0.32;
    this.heat = Math.max(0, this.heat - cool * dt);
    if (this.overheated && this.heat <= 0.15) this.overheated = false;
    if (this.ammo < this.ammoMax) {
      this._ammoRegen += dt;
      if (this._ammoRegen > 5.5) { this._ammoRegen = 0; this.ammo++; }
    }
  }

  canPrimary() { return !this.overheated && this._pcd <= 0; }
  canSecondary() { return this._scd <= 0 && this.ammo > 0; }

  notePrimary(rofMult = 1, heatMult = 1) {
    const w = this.primary;
    this._pcd = 1 / ((w.rof ?? 10) * rofMult);
    this.heat += (w.heat ?? 0.05) * this.heatMult * heatMult;
    if (this.heat >= 1) { this.heat = 1; this.overheated = true; }
  }

  noteBeamHeat(dt, heatMult = 1) {
    this.heat += this.primary.heat * this.heatMult * heatMult * dt;
    if (this.heat >= 1) { this.heat = 1; this.overheated = true; }
  }

  noteSecondary() {
    this._scd = this.secondary.kind === 'missile' ? 1.1 : 0.6;
    this.ammo = Math.max(0, this.ammo - 1);
  }
}
