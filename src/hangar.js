import * as THREE from 'three';
import { loadShipModel, nudgeOrientation, resetOrientation } from './ships.js';
import { mulberry32 } from './noise.js';
import { SHIP_LENGTH, HANGAR_SHIP_LENGTH } from './scale.js';

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
    this.pitch = 0.0;
    this.spinVel = 0;
    this.pitchVel = 0;
    this.dragging = false;
    this.idleFor = 0;
    this.current = null;
    this.loadingFor = null;

    // In-flight hulls are enormous; the preview normalises them back to a
    // display size chosen for the diorama.
    this.shipScale = HANGAR_SHIP_LENGTH / SHIP_LENGTH;

    this._lights();
    this._floor();
    this._bay();
    this._stars();
    this._streaks();
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight(0x8fd8ff, 0x1a0f2e, 1.8));
    const key = new THREE.DirectionalLight(0xffffff, 3.6);
    key.position.set(4, 6, 8);
    this.scene.add(key);
    const rimA = new THREE.PointLight(0x5ef2ff, 700, 200, 2);
    rimA.position.set(-34, 8, -26);
    this.scene.add(rimA);
    const rimB = new THREE.PointLight(0xff4fd8, 520, 200, 2);
    rimB.position.set(34, 4, -22);
    this.scene.add(rimB);
    const under = new THREE.PointLight(0xb6ff3d, 420, 120, 2);
    under.position.set(0, -14, 10);
    this.scene.add(under);
    const fill = new THREE.DirectionalLight(0xbcd8ff, 1.2);
    fill.position.set(-5, 2, 6);
    this.scene.add(fill);
    this.rimA = rimA; this.rimB = rimB;
  }

  _floor() {
    const grid = new THREE.GridHelper(600, 48, 0x5ef2ff, 0x1d3a6b);
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


  /**
   * The bay itself: gantries, deck plating, service arms and light shafts.
   * All procedural, no assets — it exists to give the hull a sense of place
   * and scale rather than floating it in a void.
   */
  _bay() {
    const rng = mulberry32(2029);
    const bay = new THREE.Group();
    this.scene.add(bay);
    this.bay = bay;

    const steel = new THREE.MeshStandardMaterial({
      color: 0x2a3550, metalness: 0.75, roughness: 0.5, flatShading: true,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x161d31, metalness: 0.6, roughness: 0.65, flatShading: true,
    });
    const strip = (color, opacity = 0.85) => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, toneMapped: false,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    // --- deck plating -----------------------------------------------------
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(56, 60, 4, 12), dark);
    deck.position.y = -17;
    bay.add(deck);

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(15, 1.4, 26), steel);
      plate.position.set(Math.cos(a) * 40, -14.6, Math.sin(a) * 40);
      plate.rotation.y = -a;
      bay.add(plate);

      // deck lighting between the plates
      const led = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 24), strip(0x5ef2ff, 0.5));
      led.position.set(Math.cos(a + 0.26) * 40, -13.8, Math.sin(a + 0.26) * 40);
      led.rotation.y = -a;
      bay.add(led);
    }

    // --- structural ribs, arching over the pad ---------------------------
    const ribGeo = new THREE.TorusGeometry(52, 1.5, 4, 28, Math.PI);
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(ribGeo, steel);
      rib.position.y = -15;
      rib.rotation.y = (i / 5) * Math.PI;
      bay.add(rib);
    }
    // crown light running along the top of the arches
    const crown = new THREE.Mesh(new THREE.TorusGeometry(20, 0.7, 4, 28), strip(0x9fe8ff, 0.55));
    crown.position.y = 34;
    crown.rotation.x = Math.PI / 2;
    bay.add(crown);
    this.crown = crown;

    // --- pylons + service arms -------------------------------------------
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = Math.cos(a) * 46, pz = Math.sin(a) * 46;

      const pylon = new THREE.Mesh(new THREE.BoxGeometry(4, 30, 4), steel);
      pylon.position.set(px, -1, pz);
      bay.add(pylon);

      const head = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 7), dark);
      head.position.set(px, 15, pz);
      bay.add(head);

      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6),
        strip(i % 2 ? 0xff4fd8 : 0x5ef2ff, 0.95));
      lamp.position.set(px, 12.6, pz);
      bay.add(lamp);

      // light shaft down onto the pad
      const shaft = new THREE.Mesh(
        new THREE.ConeGeometry(7, 26, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xff4fd8 : 0x5ef2ff, transparent: true, opacity: 0.028,
          blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        }),
      );
      shaft.position.set(px * 0.85, -2, pz * 0.85);
      shaft.rotation.z = Math.atan2(px, 30) * 0.35;
      bay.add(shaft);

      // articulated service arm reaching toward the hull
      const arm = new THREE.Group();
      const seg1 = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 1.6), steel);
      seg1.position.x = 8;
      arm.add(seg1);
      const seg2 = new THREE.Mesh(new THREE.BoxGeometry(11, 1.2, 1.2), steel);
      seg2.position.set(19, -3, 0);
      seg2.rotation.z = 0.5;
      arm.add(seg2);
      arm.position.set(px, -6 + rng() * 8, pz);
      arm.rotation.y = -a + Math.PI;
      bay.add(arm);
      arm.userData.rest = arm.rotation.y;
      (this.arms ??= []).push(arm);
    }

    // --- floating diagnostic panels --------------------------------------
    this.panels = [];
    for (let i = 0; i < 3; i++) {
      const a = -0.9 + i * 0.9;
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 5.5),
        new THREE.MeshBasicMaterial({
          color: 0x5ef2ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      panel.position.set(Math.cos(a) * 34, 6 + i * 3, Math.sin(a) * 34 - 8);
      panel.lookAt(0, 2, 0);
      bay.add(panel);
      this.panels.push({ mesh: panel, phase: rng() * 6.28 });
    }

    // --- drifting motes ---------------------------------------------------
    const N = 260;
    const pos = new Float32Array(N * 3);
    this.motes = [];
    for (let i = 0; i < N; i++) {
      const d = { x: (rng() - 0.5) * 110, y: -16 + rng() * 60, z: (rng() - 0.5) * 110, v: 0.6 + rng() * 1.8 };
      this.motes.push(d);
      pos[i * 3] = d.x; pos[i * 3 + 1] = d.y; pos[i * 3 + 2] = d.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.moteCloud = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0x9fe8ff, size: 0.42, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    bay.add(this.moteCloud);
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

  /**
   * Click-drag to turn the hull over. Releasing keeps the flick's momentum,
   * and the slow auto-spin creeps back once the model has been left alone.
   */
  attachControls(dom) {
    this.dom = dom;
    let px = 0, py = 0;

    // Listen on the window in capture so the drag works whether the pointer
    // lands on the canvas itself or on the menu's transparent viewport column.
    const grabbable = (t) => {
      if (!t || !this.interactive) return false;
      if (t === dom) return true;
      if (t.closest && t.closest('.viewport')) return !t.closest('button');
      return false;
    };

    const down = (e) => {
      if (e.button !== 0 || !grabbable(e.target)) return;
      this.dragging = true;
      this.idleFor = 0;
      px = e.clientX; py = e.clientY;
      document.body.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const move = (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - px, dy = e.clientY - py;
      px = e.clientX; py = e.clientY;
      this.spin += dx * 0.008;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.006, -1.1, 1.1);
      this.spinVel = dx * 0.008;
      this.pitchVel = dy * 0.006;
      this.idleFor = 0;
    };
    const up = () => {
      if (!this.dragging) return;
      this.dragging = false;
      document.body.style.cursor = '';
    };

    addEventListener('pointerdown', down, true);
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  }

  setInteractive(on) {
    this.interactive = on;
    if (!on) document.body.style.cursor = '';
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
    model.scale.setScalar(this.shipScale);
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
    this.camera.position.set(0, 13 * pull, 80 * pull);
    this.camera.lookAt(0, 2, 0);
    this.camera.updateProjectionMatrix();
  }

  render(dt) {
    this.t += dt;

    if (this.dragging) {
      this.idleFor = 0;
    } else {
      this.idleFor += dt;
      // carry the flick, then bleed it off
      this.spin += this.spinVel;
      this.pitch = THREE.MathUtils.clamp(this.pitch + this.pitchVel, -1.1, 1.1);
      const damp = Math.exp(-dt * 3.4);
      this.spinVel *= damp;
      this.pitchVel *= damp;
      // idle turntable creeps back in once you have stopped fiddling
      const idle = THREE.MathUtils.clamp((this.idleFor - 1.6) / 2.5, 0, 1);
      this.spin += dt * 0.32 * idle;
      this.pitch *= Math.exp(-dt * 0.8 * idle);
    }

    const sway = this.dragging ? 0 : 1;
    this.pivot.rotation.y = this.spin;
    this.pivot.rotation.x = this.pitch + Math.sin(this.t * 0.45) * 0.045 * sway;
    this.pivot.rotation.z = Math.sin(this.t * 0.6) * 0.05 * sway;
    this.pivot.position.y = 2 + Math.sin(this.t * 0.9) * 1.4;

    if (this.introT !== undefined && this.introT < 1) {
      this.introT = Math.min(1, this.introT + dt * 1.6);
      const k = 1 - Math.pow(1 - this.introT, 3);
      if (this.current) this.current.scale.setScalar(this.shipScale * (0.4 + k * 0.6));
    }

    this.stars.rotation.y = this.t * 0.012;
    this.ring.material.opacity = 0.2 + Math.sin(this.t * 2.2) * 0.09;
    this.beam.material.opacity = 0.06 + Math.sin(this.t * 1.4) * 0.03;
    this.grid.material.opacity = 0.22 + Math.sin(this.t * 0.8) * 0.07;

    if (this.crown) this.crown.material.opacity = 0.4 + Math.sin(this.t * 1.7) * 0.18;
    if (this.arms) {
      for (let i = 0; i < this.arms.length; i++) {
        const a = this.arms[i];
        a.rotation.y = a.userData.rest + Math.sin(this.t * 0.45 + i) * 0.16;
        a.position.y += Math.sin(this.t * 0.8 + i * 2) * dt * 0.6;
      }
    }
    if (this.panels) {
      for (const p of this.panels) {
        p.mesh.material.opacity = 0.06 + Math.abs(Math.sin(this.t * 1.3 + p.phase)) * 0.12;
      }
    }
    if (this.motes) {
      const arr = this.moteCloud.geometry.attributes.position.array;
      for (let i = 0; i < this.motes.length; i++) {
        const m = this.motes[i];
        m.y += m.v * dt;
        if (m.y > 46) m.y = -18;
        arr[i * 3 + 1] = m.y;
      }
      this.moteCloud.geometry.attributes.position.needsUpdate = true;
    }

    for (const s of this.streaks) {
      s.mesh.position.x += s.speed * dt;
      if (s.mesh.position.x > 380) s.mesh.position.x = -380;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
