import * as THREE from 'three';
import { mulberry32, fbm2 } from './noise.js';
import { HOSTILE_SCALE } from './scale.js';
import { CALLSIGNS, GREETINGS } from './greetings.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const FWD = new THREE.Vector3(0, 0, -1);

const GREET_RANGE = 2200;

function faceAlong(mesh, dir, dt) {
  if (dir.lengthSq() < 1e-6) return;
  _q.setFromUnitVectors(FWD, _v2.copy(dir).normalize());
  mesh.quaternion.slerp(_q, 1 - Math.exp(-dt * 2.2));
}

/**
 * Ambient traffic for Chill Vibes.
 *
 * Everything shares one slowly wandering "traffic heading", so the sky reads as
 * a loose migration rather than random noise — but each ship carries its own
 * drift, bank and altitude band so it never looks like a formation. Nothing
 * here is hostile: they will not shoot, and engaging them is entirely optional.
 */
export class Drifters {
  constructor(scene, hf, combat, opts = {}) {
    this.scene = scene;
    this.hf = hf;
    this.combat = combat;
    this.max = opts.max ?? 4;
    this.range = opts.range ?? 9000;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.rng = mulberry32(5150);
    this.t = 0;
    this.seen = 0;
    this.ships = [];
    this.build(opts.hulls ?? []);
  }

  build(hulls) {
    for (let i = 0; i < this.max; i++) {
      const src = hulls.length ? hulls[i % hulls.length] : null;
      const mesh = src
        ? src.clone(true)
        : new THREE.Mesh(new THREE.ConeGeometry(50, 200, 5),
            new THREE.MeshLambertMaterial({ color: 0x4a5578, flatShading: true }));
      mesh.scale.setScalar(HOSTILE_SCALE * 0.9);

      const glow = new THREE.Mesh(
        new THREE.ConeGeometry(18, 110, 8),
        new THREE.MeshBasicMaterial({
          color: src?.userData.accent ?? 0x9fe8ff, transparent: true, opacity: 0.55,
          blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        }),
      );
      glow.rotation.x = Math.PI / 2;
      glow.position.z = 120;
      mesh.add(glow);

      mesh.visible = false;
      this.group.add(mesh);
      this.ships.push({
        mesh, position: mesh.position, radius: 120,
        hp: 140, maxHp: 140, alive: false, score: 0,
        pooled: true, drifter: true,
        vel: new THREE.Vector3(),
        lane: (this.rng() - 0.5) * 2,          // personal offset from the traffic line
        band: 300 + this.rng() * 1500,          // preferred altitude above ground
        speed: 150 + this.rng() * 220,
        wobble: this.rng() * 6.28,
        respawn: i * 9,
        name: CALLSIGNS[(i * 7 + 3) % CALLSIGNS.length],
        greeted: false,
        applyDamage(dmg) { this.hp -= dmg; },
      });
    }
  }

  prewarm(renderer, camera, scene) {
    for (const d of this.ships) { d.mesh.visible = true; d.mesh.position.set(0, -9000, 0); }
    try { renderer.compile(scene, camera); } catch { /* non-fatal */ }
    for (const d of this.ships) d.mesh.visible = false;
  }

  /** The shared heading, drifting slowly over minutes. */
  trafficHeading() {
    return fbm2(this.t * 0.012, 3.7, 991, 3) * Math.PI * 2;
  }

  place(d, player) {
    const h = this.trafficHeading() + d.lane * 0.5;
    // Scattered wide and deep so encounters are solitary — never a formation.
    const side = (this.rng() - 0.5) * this.range * 2.6;
    const along = this.range * (0.5 + this.rng() * 1.3);
    const cx = Math.sin(h), cz = Math.cos(h);
    const x = player.position.x + cx * along - cz * side;
    const z = player.position.z + cz * along + cx * side;
    const y = Math.max(this.hf.height(x, z), 0) + d.band;
    d.mesh.position.set(x, y, z);
    d.mesh.visible = true;
    d.alive = true;
    d.hp = d.maxHp;
    d.vel.set(-cx, 0, -cz).multiplyScalar(d.speed);
    d.greeted = false;
  }

  update(dt, player) {
    this.t += dt;
    const h = this.trafficHeading();

    for (const d of this.ships) {
      if (!d.alive) {
        d.respawn -= dt;
        if (d.respawn <= 0) this.place(d, player);
        continue;
      }
      if (d.hp <= 0) {
        this.combat.fireball(d.position, 300, 0x9fe8ff);
        d.alive = false;
        d.mesh.visible = false;
        d.respawn = 14 + this.rng() * 16;
        d._passed = false;
        this.onDown?.(d);
        continue;
      }

      // travel along the shared heading, with a lazy personal weave
      const wob = Math.sin(this.t * 0.23 + d.wobble) * 0.5 + d.lane * 0.35;
      _v.set(-Math.sin(h + wob), 0, -Math.cos(h + wob)).multiplyScalar(d.speed);
      const targetY = Math.max(this.hf.height(d.position.x, d.position.z), 0) + d.band;
      _v.y = (targetY - d.position.y) * 0.35 + Math.sin(this.t * 0.4 + d.wobble) * 22;

      d.vel.lerp(_v, 1 - Math.exp(-dt * 0.7));
      d.mesh.position.addScaledVector(d.vel, dt);
      faceAlong(d.mesh, d.vel, dt);
      // gentle bank into the weave
      d.mesh.rotateZ(Math.sin(this.t * 0.23 + d.wobble) * 0.004);

      const gap = d.position.distanceTo(player.position);
      if (gap > this.range * 2.2) { this.place(d, player); continue; }

      // A pass close enough to see each other earns a hail, once per encounter.
      if (!d.greeted && gap < GREET_RANGE) {
        d.greeted = true;
        this.onHail?.(d, GREETINGS[(Math.random() * GREETINGS.length) | 0]);
      }
    }
  }

  get live() { return this.ships.filter((s) => s.alive); }
}
