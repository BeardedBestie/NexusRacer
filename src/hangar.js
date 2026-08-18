import * as THREE from 'three';
import { loadShipModel, nudgeOrientation, resetOrientation } from './ships.js';
import { mulberry32 } from './noise.js';

/**
 * The menu backdrop: a holographic hangar bay that renders the selected ship
 * on a slowly rotating pedestal.  Owns its own scene so the game scene can be
 * torn down independently.
 */
export class HangarStage {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 4000);
    this.camera.position.set(0, 11, 74);
    this.camera.lookAt(0, 2, 0);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.t = 0;
    this.spin = 0;
    this.current = null;
    this.loadingFor = null;

    this._lights();
    this._floor();
    this._stars();
    this._streaks();
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight(0x8fd8ff, 0x1a0f2e, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 3.1);
    key.position.set(4, 6, 8);
    this.scene.add(key);
    const rimA = new THREE.PointLight(0x5ef2ff, 900, 220, 2);
    rimA.position.set(-34, 8, -26);
    this.scene.add(rimA);
    const rimB = new THREE.PointLight(0xff4fd8, 800, 220, 2);
    rimB.position.set(34, 4, -22);
    this.scene.add(rimB);
    const under = new THREE.PointLight(0xb6ff3d, 420, 120, 2);
    under.position.set(0, -14, 10);
    this.scene.add(under);
    this.rimA = rimA; this.rimB = rimB;
  }

  _floor() {
    const grid = new THREE.GridHelper(600, 60, 0x5ef2ff, 0x1d3a6b);
    grid.material.transparent = true;
    grid.material.opacity = 0.3;
    grid.position.y = -15;
    this.scene.add(grid);
    this.grid = grid;

    // holo pedestal
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(20, 25, 64),
      new THREE.MeshBasicMaterial({
        color: 0x5ef2ff, transparent: true, opacity: 0.28,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -14.6;
    this.scene.add(ring);
    this.ring = ring;

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(23, 17, 30, 40, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x2e7fa8, transparent: true, opacity: 0.09,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    beam.position.y = -1;
    this.scene.add(beam);
    this.beam = beam;
  }

  _stars() {
    const rng = mulberry32(11);
    const N = 900;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const r = 400 + rng() * 900;
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(rng() * 2 - 1);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
      pos[i * 3 + 1] = Math.cos(ph) * r * 0.6;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
      c.setHSL(0.5 + rng() * 0.35, 0.7, 0.55 + rng() * 0.4);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({
      size: 3.2, vertexColors: true, transparent: true, opacity: 0.9,
      sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.scene.add(this.stars);
  }

  _streaks() {
    // slow horizontal light bars sliding past, for depth
    const rng = mulberry32(77);
    this.streaks = [];
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xff4fd8 : 0x5ef2ff,
        transparent: true, opacity: 0.05 + rng() * 0.08,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      const d = { speed: 18 + rng() * 46, y: (rng() - 0.5) * 150, z: -120 - rng() * 320 };
      m.scale.set(40 + rng() * 160, 0.5 + rng() * 1.6, 1);
      m.position.set((rng() - 0.5) * 700, d.y, d.z);
      this.scene.add(m);
      this.streaks.push({ mesh: m, ...d });
    }
  }

  async select(ship, onState) {
    this.loadingFor = ship.id;
    onState?.('loading');
    let model;
    try {
      model = await loadShipModel(ship);
    } catch (e) {
      console.error('hangar model load failed', e);
      onState?.('error');
      return;
    }
    if (this.loadingFor !== ship.id) return;   // a newer selection won the race

    if (this.current) this.pivot.remove(this.current);
    model.position.set(0, 0, 0);
    model.scale.setScalar(1.25);
    this.pivot.add(model);
    this.current = model;
    this.accent = new THREE.Color(ship.accent);
    this.rimA.color.set(ship.accent);
    this.ring.material.color.set(ship.accent);
    this.introT = 0;
    onState?.('ready');
  }

  rotateModel(dir) {
    if (!this.current) return;
    if (dir === 0) resetOrientation(this.current);
    else nudgeOrientation(this.current, dir * Math.PI / 2);
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    // The ship shares the frame with two side panels, so pull back on narrow
    // viewports instead of letting the hull spill under the UI.
    const pull = THREE.MathUtils.clamp(1.7 / aspect, 1, 2.1);
    this.camera.position.set(0, 11 * pull, 74 * pull);
    this.camera.lookAt(0, 2, 0);
    this.camera.updateProjectionMatrix();
  }

  render(dt) {
    this.t += dt;
    this.spin += dt * 0.32;
    this.pivot.rotation.y = this.spin;
    this.pivot.position.y = 2 + Math.sin(this.t * 0.9) * 1.4;
    this.pivot.rotation.z = Math.sin(this.t * 0.6) * 0.05;
    this.pivot.rotation.x = Math.sin(this.t * 0.45) * 0.045;

    if (this.introT !== undefined && this.introT < 1) {
      this.introT = Math.min(1, this.introT + dt * 1.6);
      const k = 1 - Math.pow(1 - this.introT, 3);
      if (this.current) this.current.scale.setScalar(1.25 * (0.4 + k * 0.6));
    }

    this.stars.rotation.y = this.t * 0.012;
    this.ring.material.opacity = 0.2 + Math.sin(this.t * 2.2) * 0.09;
    this.beam.material.opacity = 0.06 + Math.sin(this.t * 1.4) * 0.03;
    this.grid.material.opacity = 0.22 + Math.sin(this.t * 0.8) * 0.07;

    for (const s of this.streaks) {
      s.mesh.position.x += s.speed * dt;
      if (s.mesh.position.x > 380) s.mesh.position.x = -380;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
