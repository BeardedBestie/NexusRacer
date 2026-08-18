import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { WEAPONS } from './ships.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

// Hostiles are read at 1-3km, so they fly oversized to stay legible.
const HOSTILE_SCALE = 2.1;
const FWD = new THREE.Vector3(0, 0, -1);

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
  SHARD: { id: 'SHARD', score: 250,  color: 0x5ef2ff, size: 70 },
  CORE:  { id: 'CORE',  score: 2500, color: 0xff4fd8, size: 130 },
  BOOST: { id: 'BOOST', score: 100,  color: 0xb6ff3d, size: 80 },
  REPAIR:{ id: 'REPAIR',score: 100,  color: 0xffd66b, size: 80 },
};

// Landmark-scale pickups: ten times the size, one tenth the density.
const CELL = 4400;

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
        transparent: true, opacity: 0.22, fog: false,
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
    // Rare by design: most cells are empty, so a pickup is a landmark you
    // navigate to rather than something you fly through by accident.
    const n = rng() < 0.55 ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const x = cx * CELL + rng() * CELL;
      const z = cz * CELL + rng() * CELL;
      const ground = this.hf.height(x, z);
      const r = rng();
      let type = PICKUP.SHARD;
      if (r > 0.955) type = PICKUP.CORE;
      else if (r > 0.90) type = PICKUP.BOOST;
      else if (r > 0.855) type = PICKUP.REPAIR;
      const y = Math.max(ground, 0) + 220 + rng() * 700;
      items.push({
        id: `${cx}:${cz}:${i}`,
        type,
        position: new THREE.Vector3(x, y, z),
        phase: rng() * Math.PI * 2,
        alive: true,
      });
    }
    this.active.set(key, items);
    return items;
  }

  /** @returns {Array} collected items this frame */
  update(dt, playerPos, magnetR) {
    this.time += dt;
    const ccx = Math.floor(playerPos.x / CELL), ccz = Math.floor(playerPos.z / CELL);
    const R = this.radius;

    // prune far cells (keeps the map bounded; taken-set preserves progress)
    for (const key of this.active.keys()) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.abs(cx - ccx) > R + 2 || Math.abs(cz - ccz) > R + 2) this.active.delete(key);
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
          const grab = it.type.size + 26;
          if (d2 < grab * grab) {
            this.taken.add(it.id);
            it.alive = false;
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
            (Math.sqrt(d2) - it.type.size) / (it.type.size * 4), 0, 1);
          _s.setScalar(it.type.size * (1 + 0.45 * near));
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
const RING_GEO = new THREE.TorusGeometry(21, 1.1, 4, 20);
const TRAIL_GEO = new THREE.ConeGeometry(2.1, 12, 8);
const HULL_GEO = new THREE.ConeGeometry(5, 20, 5);

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
  trail.position.z = 12;
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
        score: 200, respawn: i * 0.35, pooled: true,
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

  /** A point out in front of the player, biased toward their flight path. */
  frontalPoint(player, out = new THREE.Vector3()) {
    const fwd = _v.set(0, 0, -1).applyQuaternion(player.flight.quaternion);
    const lead = player.velocity ? player.velocity.length() * 2.2 : 0;
    const heading = Math.atan2(fwd.x, fwd.z);
    const a = heading + (this.rng() - 0.5) * 1.4;      // +/- 40 degrees of the nose
    const d = this.spawnR * (0.75 + this.rng() * 0.5) + lead;
    const x = player.position.x + Math.sin(a) * d;
    const z = player.position.z + Math.cos(a) * d;
    const y = Math.max(this.hf.height(x, z) + 160,
      player.position.y + (this.rng() - 0.45) * 420);
    return out.set(x, y, z);
  }

  /** Put a dormant hull back in the fight, out in front of the player. */
  deploy(d, player) {
    this.frontalPoint(player, _v3);
    d.mesh.position.copy(_v3);
    d.mesh.visible = true;
    d.hp = d.maxHp;
    d.alive = true;
    d.cd = 1.2 + this.rng() * 1.8;
    _v3.copy(player.position).sub(d.mesh.position);
    d.vel.copy(_v3).normalize().multiplyScalar(240);
    faceAlong(d.mesh, _v3);
    const ring = d.mesh.userData.ring;
    if (ring) ring.visible = true;
  }

  /** Retire a hull without destroying it. */
  retire(d, explode) {
    d.alive = false;
    d.mesh.visible = false;
    d.respawn = explode ? 1.4 + this.rng() * 1.6 : 0.4;
    if (explode) {
      this.combat.fireball(d.position, 90, 0xffb347);
      this.onKill?.(d);
    }
  }

  update(dt, player) {
    for (const d of this.drones) {
      if (!d.alive) {
        d.respawn -= dt;
        if (d.respawn <= 0) this.deploy(d, player);
        continue;
      }
      if (d.hp <= 0) { this.retire(d, true); continue; }

      const toP = _v.copy(player.position).sub(d.position);
      const dist = toP.length();
      toP.normalize();

      // Once overshot, a hostile can never catch a boosting player, so it
      // disengages and re-enters from the front instead of trailing uselessly.
      _v2.set(0, 0, -1).applyQuaternion(player.flight.quaternion);
      const ahead = -toP.dot(_v2);
      // 900m is about a second of separation at closing speed — past that a
      // hostile on your six is out of the fight, so send it back around.
      if (dist > this.spawnR * 3 || (dist > 900 && ahead < -0.35)) {
        this.deploy(d, player);
        continue;
      }

      const approach = dist > 620 ? 1 : -0.55;
      const desired = _v2.copy(toP).multiplyScalar(approach);
      const t = performance.now() * 0.001;
      desired.x += Math.cos(d.wobble + t * 0.6) * 0.55;
      desired.y += Math.sin(d.wobble + t * 0.9) * 0.3;
      desired.normalize().multiplyScalar(430);
      d.vel.lerp(desired, 1 - Math.exp(-dt * 1.5));
      d.mesh.position.addScaledVector(d.vel, dt);

      const gy = this.hf.height(d.position.x, d.position.z) + 110;
      if (d.position.y < gy) d.position.y += (gy - d.position.y) * Math.min(1, dt * 3);

      if (d.vel.lengthSq() > 1) faceAlong(d.mesh, d.vel);
      const ring = d.mesh.userData.ring;
      if (ring) { ring.rotation.z += dt * 2.2; ring.material.opacity = 0.35 + 0.25 * Math.sin(t * 4); }

      d.cd -= dt;
      if (d.cd <= 0 && dist < 1800) {
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
