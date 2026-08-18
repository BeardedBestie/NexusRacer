import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { WEAPONS } from './ships.js';
import { HOSTILE_SCALE, SHIP_RADIUS } from './scale.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

const FWD = new THREE.Vector3(0, 0, -1);

const GUARD_ORBIT = 1300;    // how far guards ring their site
const ENGAGE_R = 4200;       // player gets this close, the garrison wakes up
const LEASH_R = 5200;        // guards never chase further than this from home

/**
 * Point a hull's nose along `dir`.
 *
 * Object3D.lookAt aims +Z at the target, but every ship in this game noses
 * down -Z, so lookAt would fly them tail-first.
 */
function faceAlong(mesh, dir) {
  if (dir.lengthSq() < 1e-6) return;
  _q.setFromUnitVectors(FWD, _v2.copy(dir).normalize());
  mesh.quaternion.copy(_q);
}

export const PICKUP = {
  SHARD: { id: 'SHARD', score: 250,  color: 0x5ef2ff, size: 170 },
  CORE:  { id: 'CORE',  score: 2500, color: 0xff4fd8, size: 340 },
  BOOST: { id: 'BOOST', score: 100,  color: 0xb6ff3d, size: 190 },
  REPAIR:{ id: 'REPAIR',score: 100,  color: 0xffd66b, size: 190 },
};

const CELL = 5200;

// Loot comes in *sites*, not scattered singles: most of the map is empty sky,
// and the payoff is a cluster you have to fly out and find. The richest sites
// are garrisoned, so an encounter is something you choose to pick.
const SITE_CHANCE = 0.20;
const GUARD_CHANCE = 0.55;

// ---------------------------------------------------------------------------
// Deterministic collectible field.  Cells are seeded from world coords, so the
// same shard is always in the same place across sessions.
// ---------------------------------------------------------------------------
export class CollectibleField {
  constructor(scene, hf, seed = 4242) {
    this.scene = scene;
    this.hf = hf;
    this.seed = seed;
    this.active = new Map();   // key -> array of items
    this.sites = new Map();    // key -> site marker
    this.taken = new Set();
    this.radius = 7;

    const geo = new THREE.OctahedronGeometry(1, 0);
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ toneMapped: false, fog: false }),
      1200,
    );
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1200 * 3), 3);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // glow shells
    const gg = new THREE.IcosahedronGeometry(1, 0);
    this.glow = new THREE.InstancedMesh(
      gg,
      new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0.16, fog: false,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }),
      1200,
    );
    this.glow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1200 * 3), 3);
    this.glow.frustumCulled = false;
    scene.add(this.glow);

    this.total = 0;
    this.time = 0;
    this._col = new THREE.Color();
  }

  cellItems(cx, cz) {
    const key = cx + ',' + cz;
    if (this.active.has(key)) return this.active.get(key);
    const rng = mulberry32((cx * 73856093) ^ (cz * 19349663) ^ this.seed);
    const items = [];

    if (rng() < SITE_CHANCE) {
      const sx = cx * CELL + rng() * CELL;
      const sz = cz * CELL + rng() * CELL;
      const ground = this.hf.height(sx, sz);
      const sy = Math.max(ground, 0) + 700 + rng() * 900;
      const guarded = rng() < GUARD_CHANCE;

      const site = {
        id: key,
        pos: new THREE.Vector3(sx, sy, sz),
        guarded,
        remaining: 0,
      };

      const n = guarded ? 4 + Math.floor(rng() * 4) : 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        // clustered in a loose shell around the site marker
        const a = rng() * Math.PI * 2;
        const rad = 260 + rng() * 900;
        const r = rng();
        let type = PICKUP.SHARD;
        if (guarded && r > 0.55) type = PICKUP.CORE;
        else if (r > 0.90) type = PICKUP.BOOST;
        else if (r > 0.80) type = PICKUP.REPAIR;
        items.push({
          id: `${key}:${i}`,
          type,
          site,
          position: new THREE.Vector3(
            sx + Math.cos(a) * rad,
            sy + (rng() - 0.5) * 620,
            sz + Math.sin(a) * rad,
          ),
          phase: rng() * Math.PI * 2,
          alive: true,
        });
        if (!this.taken.has(`${key}:${i}`)) site.remaining++;
      }
      this.sites.set(key, site);
    }

    this.active.set(key, items);
    return items;
  }

  /** Nearest garrisoned site still holding loot, or null. */
  nearestGuardedSite(pos, maxDist = 16000) {
    let best = null, bestD = maxDist * maxDist;
    for (const [, site] of this.sites) {
      if (!site.guarded || site.remaining <= 0) continue;
      const d = site.pos.distanceToSquared(pos);
      if (d < bestD) { bestD = d; best = site; }
    }
    return best;
  }

  /** @returns {Array} collected items this frame */
  update(dt, playerPos, magnetR) {
    this.time += dt;
    const ccx = Math.floor(playerPos.x / CELL), ccz = Math.floor(playerPos.z / CELL);
    const R = this.radius;

    // prune far cells (keeps the map bounded; taken-set preserves progress)
    for (const key of this.active.keys()) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.abs(cx - ccx) > R + 2 || Math.abs(cz - ccz) > R + 2) {
        this.active.delete(key);
        this.sites.delete(key);
      }
    }

    const collected = [];
    let n = 0;
    const cap = this.mesh.count;

    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const items = this.cellItems(ccx + dx, ccz + dz);
        for (const it of items) {
          if (this.taken.has(it.id)) continue;
          const d2 = it.position.distanceToSquared(playerPos);

          // magnet pull
          const mr = magnetR * (it.type === PICKUP.CORE ? 1.6 : 1);
          if (d2 < mr * mr * 16) {
            _v.copy(playerPos).sub(it.position);
            const d = Math.sqrt(d2);
            it.position.addScaledVector(_v.normalize(), Math.min(d, (mr * 8 - d) * dt * 2.4));
          }
          const grab = it.type.size + SHIP_RADIUS;
          if (d2 < grab * grab) {
            this.taken.add(it.id);
            it.alive = false;
            if (it.site) it.site.remaining--;
            collected.push(it);
            continue;
          }
          if (n >= cap) continue;
          if (d2 > 14000 * 14000) continue;

          const bob = Math.sin(this.time * 1.6 + it.phase) * 22;
          const spin = this.time * (it.type === PICKUP.CORE ? 1.1 : 2.0) + it.phase;
          _q.setFromEuler(new THREE.Euler(spin * 0.6, spin, 0));
          _s.setScalar(it.type.size);
          _v2.copy(it.position); _v2.y += bob;
          _m.compose(_v2, _q, _s);
          this.mesh.setMatrixAt(n, _m);
          // Shrink the halo as you close in, or it fills the screen on approach.
          const near = THREE.MathUtils.clamp(
            (Math.sqrt(d2) - it.type.size * 2) / (it.type.size * 6), 0, 1);
          _s.setScalar(it.type.size * (0.55 + 0.9 * near));
          _m.compose(_v2, _q, _s);
          this.glow.setMatrixAt(n, _m);
          this._col.setHex(it.type.color).convertSRGBToLinear();
          this.mesh.setColorAt(n, this._col);
          this.glow.setColorAt(n, this._col);
          n++;
        }
      }
    }

    this.visible = n;
    this.mesh.count = n;
    this.glow.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.glow.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (this.glow.instanceColor) this.glow.instanceColor.needsUpdate = true;
    return collected;
  }
}

// ---------------------------------------------------------------------------
// Hostile fighters — real hulls from the model library, flown by the AI.
// ---------------------------------------------------------------------------
const RING_GEO = new THREE.TorusGeometry(215, 4, 4, 24);
const TRAIL_GEO = new THREE.ConeGeometry(20, 120, 8);
const HULL_GEO = new THREE.ConeGeometry(50, 200, 5);

function fallbackHull() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    HULL_GEO,
    new THREE.MeshLambertMaterial({ color: 0x3a2f45, flatShading: true }),
  );
  body.rotation.x = -Math.PI / 2;
  g.add(body);
  return g;
}

/** Threat marker + engine glow so hostiles read at distance. */
function dressHostile(root, color) {
  const trail = new THREE.Mesh(TRAIL_GEO, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.9, toneMapped: false,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  trail.rotation.x = Math.PI / 2;
  trail.position.z = 120;
  root.add(trail);

  const ring = new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({
    color: 0xff3355, transparent: true, opacity: 0.55, toneMapped: false,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  ring.rotation.x = Math.PI / 2;
  root.add(ring);

  root.userData.trail = trail;
  root.userData.ring = ring;
  return root;
}

/**
 * A fixed pool of hostiles.
 *
 * Cloning a GLB hull and building its decoration costs a visible frame, and a
 * naive "destroy on death, spawn a replacement" loop pays that cost at exactly
 * the worst moment — the instant you score a kill. Every hull is therefore
 * built once during the loading screen and then recycled forever; nothing is
 * constructed or disposed while the game is running.
 */
export class DroneSwarm {
  constructor(scene, hf, combat, opts = {}) {
    this.scene = scene;
    this.hf = hf;
    this.combat = combat;
    this.max = opts.max ?? 5;
    this.spawnR = opts.spawnR ?? 3400;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.rng = mulberry32(99);
    this.onKill = null;
    this.drones = [];
    this.home = null;
    this.engaged = false;
    this.build(opts.hulls ?? []);
  }

  /** Construct the whole pool up front. Called during loading, never in play. */
  build(hulls) {
    for (let i = 0; i < this.max; i++) {
      const src = hulls.length ? hulls[i % hulls.length] : null;
      const mesh = src ? src.clone(true) : fallbackHull();
      mesh.scale.setScalar(HOSTILE_SCALE);
      dressHostile(mesh, src?.userData.accent ?? 0xff8844);
      mesh.visible = false;
      this.group.add(mesh);
      this.drones.push({
        mesh, position: mesh.position, radius: 16 * HOSTILE_SCALE,
        hp: 110, maxHp: 110, alive: false, isEnemy: true,
        vel: new THREE.Vector3(), cd: 0, wobble: this.rng() * 6.28,
        score: 200, respawn: 0, orbit: 0, orbitR: GUARD_ORBIT, pooled: true,
        // The pool owns the death sequence, so damage only drains hp here.
        applyDamage(dmg) { this.hp -= dmg; },
      });
    }
  }

  /** Force renderer setup for every hull before anything is on screen. */
  prewarm(renderer, camera, scene) {
    for (const d of this.drones) { d.mesh.visible = true; d.mesh.position.set(0, -8000, 0); }
    try { renderer.compile(scene, camera); } catch { /* non-fatal */ }
    for (const d of this.drones) d.mesh.visible = false;
  }

  /** Ring the garrison around its site. */
  station(d, i) {
    const a = (i / this.max) * Math.PI * 2 + this.rng() * 0.4;
    const rad = GUARD_ORBIT * (0.7 + this.rng() * 0.6);
    d.mesh.position.set(
      this.home.pos.x + Math.cos(a) * rad,
      this.home.pos.y + (this.rng() - 0.5) * 500,
      this.home.pos.z + Math.sin(a) * rad,
    );
    d.mesh.visible = true;
    d.alive = true;
    d.hp = d.maxHp;
    d.cd = 1.2 + this.rng() * 1.8;
    d.orbit = a;
    d.orbitR = rad;
    d.vel.set(0, 0, 0);
  }

  /**
   * Hostiles no longer roam. They garrison the nearest guarded loot site and
   * only wake up when the player comes to take it — so the sky between sites
   * stays empty and the fights are something you fly toward on purpose.
   */
  update(dt, player, field) {
    const site = field ? field.nearestGuardedSite(player.position) : null;

    if (site !== this.home) {
      this.home = site;
      if (site) this.drones.forEach((d, i) => this.station(d, i));
      else for (const d of this.drones) { d.alive = false; d.mesh.visible = false; }
    }
    if (!this.home) return;

    const siteDist = player.position.distanceTo(this.home.pos);
    this.engaged = siteDist < ENGAGE_R;
    const t = performance.now() * 0.001;

    for (let i = 0; i < this.drones.length; i++) {
      const d = this.drones[i];
      if (!d.alive) {
        d.respawn -= dt;
        // downed guards only come back if the site still has loot worth guarding
        if (d.respawn <= 0 && this.home.remaining > 0) this.station(d, i);
        continue;
      }
      if (d.hp <= 0) { this.retire(d, true); continue; }

      const toP = _v.copy(player.position).sub(d.position);
      const dist = toP.length();
      toP.normalize();

      if (this.engaged) {
        // break off inside knife range, then swing back around
        const approach = dist > 1400 ? 1 : -0.55;
        const desired = _v2.copy(toP).multiplyScalar(approach);
        desired.x += Math.cos(d.wobble + t * 0.6) * 0.55;
        desired.y += Math.sin(d.wobble + t * 0.9) * 0.3;
        desired.normalize().multiplyScalar(430);
        d.vel.lerp(desired, 1 - Math.exp(-dt * 1.5));

        // never let a guard get dragged off its post
        _v3.copy(d.position).sub(this.home.pos);
        const leash = _v3.length();
        if (leash > LEASH_R) d.vel.addScaledVector(_v3.divideScalar(leash), -dt * 900);
      } else {
        // idle patrol: slow circuit of the site
        d.orbit += dt * 0.22;
        _v3.set(
          this.home.pos.x + Math.cos(d.orbit) * d.orbitR,
          this.home.pos.y + Math.sin(d.orbit * 1.7) * 220,
          this.home.pos.z + Math.sin(d.orbit) * d.orbitR,
        ).sub(d.position);
        d.vel.lerp(_v3.normalize().multiplyScalar(200), 1 - Math.exp(-dt * 1.2));
      }

      d.mesh.position.addScaledVector(d.vel, dt);

      const gy = this.hf.height(d.position.x, d.position.z) + 220;
      if (d.position.y < gy) d.position.y += (gy - d.position.y) * Math.min(1, dt * 3);

      if (d.vel.lengthSq() > 1) faceAlong(d.mesh, d.vel);
      // The threat ring is a spotting aid: strong at range, gone up close
      // where the hull itself is perfectly readable.
      const ring = d.mesh.userData.ring;
      if (ring) {
        ring.rotation.z += dt * 2.2;
        const far = Math.min(1, Math.max(0, (dist - 700) / 1400));
        const base = this.engaged ? 0.5 + 0.2 * Math.sin(t * 4) : 0.18;
        ring.material.opacity = base * far;
        ring.visible = far > 0.02;
      }

      d.cd -= dt;
      if (this.engaged && d.cd <= 0 && dist < 2600) {
        d.cd = 1.3 + Math.random() * 1.5;
        _v.copy(player.position).sub(d.position).normalize();
        _v.addScaledVector(player.velocity ?? _v2.set(0, 0, 0), 0.0009).normalize();
        this.combat.fireProjectile(ENEMY_GUN, d.position, _v, null, d, 1);
      }
    }
  }

  /** Live hostiles, for target lists and the scanner. */
  get live() { return this.drones.filter((d) => d.alive); }
}

export const ENEMY_GUN = {
  ...WEAPONS.machineGun, dmg: 5, rof: 2, speed: 1200, color: 0xff3355, spread: 0.02,
  size: [0.4, 12], life: 1.8, salvo: 2, salvoSpread: 2,
};
