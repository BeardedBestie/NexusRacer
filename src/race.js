import * as THREE from 'three';
import { fbm2 } from './noise.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const FWD = new THREE.Vector3(0, 0, -1);

const NODE_SPACING = 300;
const GATE_EVERY = 3;          // nodes between gates
const GATE_RADIUS = 88;
const RACER_SCALE = 1.9;

/**
 * Endless procedural track: a heading-integrated spline that meanders over the
 * terrain forever.  Nodes are generated lazily and cached, so `nodeAt(i)` is
 * stable for the whole session and identical for every racer.
 */
export class Track {
  constructor(hf, seed = 20250817) {
    this.hf = hf;
    this.seed = seed;
    this.nodes = [];
    this._heading = 0;
    this._pos = new THREE.Vector3(0, 0, 0);
    this.ensure(64);
  }

  ensure(count) {
    while (this.nodes.length < count) {
      const i = this.nodes.length;
      // heading meander: low-frequency noise integrated into a smooth curve
      const turn = fbm2(i * 0.021, 0.5, this.seed, 4) * 0.115
                 + fbm2(i * 0.0052, 12.5, this.seed + 3, 3) * 0.075;
      this._heading += turn;
      if (i > 0) {
        this._pos.x += Math.sin(this._heading) * NODE_SPACING;
        this._pos.z += -Math.cos(this._heading) * NODE_SPACING;
      }
      const terrain = this.hf.height(this._pos.x, this._pos.z);
      const bank = fbm2(i * 0.033, 88.0, this.seed + 9, 3);
      const altitude = Math.max(terrain, 0)
        + 330 + fbm2(i * 0.017, 44.0, this.seed + 5, 3) * 240;
      this.nodes.push({
        i,
        pos: new THREE.Vector3(this._pos.x, altitude, this._pos.z),
        heading: this._heading,
        bank: bank * 0.9,
        dist: i * NODE_SPACING,
      });
    }
  }

  nodeAt(i) { this.ensure(i + 4); return this.nodes[Math.max(0, i)]; }

  /** Catmull-Rom-ish position at continuous node index */
  sample(f, out = new THREE.Vector3()) {
    const i = Math.floor(f), t = f - i;
    const a = this.nodeAt(Math.max(0, i - 1)).pos;
    const b = this.nodeAt(i).pos;
    const c = this.nodeAt(i + 1).pos;
    const d = this.nodeAt(i + 2).pos;
    const t2 = t * t, t3 = t2 * t;
    out.set(
      0.5 * ((2 * b.x) + (-a.x + c.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3),
      0.5 * ((2 * b.y) + (-a.y + c.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3),
      0.5 * ((2 * b.z) + (-a.z + c.z) * t + (2 * a.z - 5 * b.z + 4 * c.z - d.z) * t2 + (-a.z + 3 * b.z - 3 * c.z + d.z) * t3),
    );
    return out;
  }

  tangent(f, out = new THREE.Vector3()) {
    this.sample(f + 0.05, out);
    this.sample(f - 0.05, _v3);
    return out.sub(_v3).normalize();
  }

  gateIndexToNode(g) { return g * GATE_EVERY + 4; }

  gatePos(g, out = new THREE.Vector3()) { return this.sample(this.gateIndexToNode(g), out); }

  /** Approximate node-index progress of a world position, searched near `hint`. */
  project(pos, hint = 0, span = 26) {
    let best = hint, bestD = Infinity;
    const lo = Math.max(0, Math.floor(hint) - span);
    const hi = Math.floor(hint) + span;
    for (let i = lo; i <= hi; i++) {
      const d = this.nodeAt(i).pos.distanceToSquared(pos);
      if (d < bestD) { bestD = d; best = i; }
    }
    // refine
    let bf = best, bfd = bestD;
    for (let k = -9; k <= 9; k++) {
      const f = best + k / 10;
      if (f < 0) continue;
      const d = this.sample(f, _v).distanceToSquared(pos);
      if (d < bfd) { bfd = d; bf = f; }
    }
    return { f: bf, dist: Math.sqrt(bfd) };
  }
}

// ---------------------------------------------------------------------------
// Gate visuals — a rolling window of rings ahead of the player
// ---------------------------------------------------------------------------
export class GateField {
  constructor(scene, track) {
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.window = 16;
    this.rings = [];
    const geo = new THREE.TorusGeometry(GATE_RADIUS, 5.5, 6, 24);
    for (let i = 0; i < this.window; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x5ef2ff, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      });
      const m = new THREE.Mesh(geo, mat);
      // inner glow disc
      const disc = new THREE.Mesh(
        new THREE.RingGeometry(GATE_RADIUS * 0.15, GATE_RADIUS * 0.98, 24),
        new THREE.MeshBasicMaterial({
          color: 0x5ef2ff, transparent: true, opacity: 0.055,
          side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
          depthWrite: false, toneMapped: false,
        }),
      );
      m.add(disc);
      m.userData.disc = disc;
      this.group.add(m);
      this.rings.push(m);
    }
    this.radius = GATE_RADIUS;
  }

  update(nextGate, time) {
    for (let k = 0; k < this.rings.length; k++) {
      const g = nextGate + k;
      const m = this.rings[k];
      const f = this.track.gateIndexToNode(g);
      this.track.sample(f, _v);
      this.track.tangent(f, _v2);
      m.position.copy(_v);
      m.quaternion.setFromUnitVectors(FWD, _v2);
      const isNext = k === 0;
      const isLap = g > 0 && g % 10 === 0;
      const col = isNext ? 0xb6ff3d : (isLap ? 0xffd66b : 0x5ef2ff);
      m.material.color.setHex(col);
      m.userData.disc.material.color.setHex(col);
      const pulse = isNext ? 1 + Math.sin(time * 6) * 0.04 : 1;
      m.scale.setScalar(pulse);
      m.material.opacity = isNext ? 1.0 : Math.max(0.12, 0.85 - k * 0.06);
      m.userData.disc.material.opacity = isNext ? 0.13 : 0.04;
    }
  }
}

// ---------------------------------------------------------------------------
// AI racers — procedural low-poly craft that follow the spline
// ---------------------------------------------------------------------------
function fallbackRacer(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.ConeGeometry(5.5, 22, 5),
    new THREE.MeshLambertMaterial({ color: 0x323a55, flatShading: true }),
  );
  hull.rotation.x = -Math.PI / 2;
  g.add(hull);
  return g;
}

/** Livery glow so each rival is identifiable at range and on the scanner. */
function dressRacer(root, color) {
  const glowMat = new THREE.MeshBasicMaterial({
    color, toneMapped: false, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const trail = new THREE.Mesh(new THREE.ConeGeometry(2.6, 15, 8), glowMat);
  trail.rotation.x = Math.PI / 2;
  trail.position.z = 13;
  root.add(trail);
  root.userData.trail = trail;
  return root;
}

export class AIRacer {
  constructor(scene, track, opts) {
    this.track = track;
    this.name = opts.name;
    this.color = opts.color;
    this.skill = opts.skill;                 // 0..1
    this.mesh = dressRacer(opts.hull ? opts.hull.clone(true) : fallbackRacer(opts.color), opts.color);
    this.mesh.scale.setScalar(RACER_SCALE);
    scene.add(this.mesh);
    this.position = this.mesh.position;
    this.radius = 14 * RACER_SCALE;
    this.velocity = new THREE.Vector3();
    this._prev = new THREE.Vector3();
    this.hp = 120; this.maxHp = 120; this.alive = true; this.isEnemy = true;
    this.f = opts.startF ?? 0;               // node-index progress
    this.lateral = (Math.random() - 0.5) * 90;
    this.vertical = (Math.random() - 0.5) * 60;
    this.speed = 0;
    this.baseSpeed = 300 + opts.skill * 240;
    this.stun = 0;
    this.score = 200;
  }

  applyDamage(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.hp = this.maxHp;
      this.stun = 2.6;               // knocked out of the race briefly
      this.f = Math.max(0, this.f - 6);
      this.wasHit = true;
    }
  }

  update(dt, playerF) {
    // rubber-banding keeps the pack close enough to matter
    const gap = playerF - this.f;
    const band = THREE.MathUtils.clamp(1 + gap * 0.012, 0.78, 1.32);
    const target = this.stun > 0 ? this.baseSpeed * 0.25 : this.baseSpeed * band;
    this.stun = Math.max(0, this.stun - dt);
    this.speed += (target - this.speed) * (1 - Math.exp(-dt * 1.6));

    this.f += (this.speed * dt) / NODE_SPACING;
    this.track.sample(this.f, _v);
    this.track.tangent(this.f, _v2);

    // offset from the centreline so the pack fans out
    _v3.copy(_v2).cross(new THREE.Vector3(0, 1, 0)).normalize();
    const wob = Math.sin(this.f * 0.35 + this.lateral) * 26;
    _v.addScaledVector(_v3, this.lateral + wob);
    _v.y += this.vertical;

    this._prev.copy(this.mesh.position);
    this.mesh.position.lerp(_v, 1 - Math.exp(-dt * 9));
    // expose a velocity so weapon lead / homing can solve an intercept
    if (dt > 0) this.velocity.copy(this.mesh.position).sub(this._prev).divideScalar(dt);
    _q.setFromUnitVectors(FWD, _v2);
    this.mesh.quaternion.slerp(_q, 1 - Math.exp(-dt * 6));
    const t = this.mesh.userData.trail;
    if (t) {
      t.scale.set(1, 0.7 + Math.random() * 0.7, 1);
      t.material.opacity = this.stun > 0 ? 0.2 : 0.9;
    }
  }
}

export const RACER_ROSTER = [
  { name: 'VEXIS',    color: 0xff4fd8, skill: 0.92 },
  { name: 'HALCYON',  color: 0x5ef2ff, skill: 0.80 },
  { name: 'DROSS-9',  color: 0xb6ff3d, skill: 0.68 },
  { name: 'MARROW',   color: 0xffb347, skill: 0.55 },
  { name: 'PALE JAY', color: 0xa86bff, skill: 0.44 },
];

export { NODE_SPACING, GATE_RADIUS, GATE_EVERY };
