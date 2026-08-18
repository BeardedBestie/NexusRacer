import * as THREE from 'three';
import { mulberry32 } from './noise.js';

// ---------------------------------------------------------------------------
// Sky dome (gradient shader, no textures) + sun + fog + volumetric-ish clouds
// ---------------------------------------------------------------------------
const skyVert = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w;
  }
`;

const skyFrag = /* glsl */`
  varying vec3 vDir;
  uniform vec3 uTop, uMid, uBottom, uSunDir, uSunColor;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y * 0.5 + 0.5;
    vec3 c = mix(uBottom, uMid, smoothstep(0.35, 0.52, h));
    c = mix(c, uTop, smoothstep(0.5, 0.95, h));
    float sun = max(dot(d, normalize(uSunDir)), 0.0);
    c += uSunColor * pow(sun, 220.0) * 3.0;
    c += uSunColor * pow(sun, 8.0) * 0.16;
    c += uSunColor * pow(max(1.0 - abs(d.y) * 3.2, 0.0), 3.0) * pow(sun, 2.0) * 0.28;
    gl_FragColor = vec4(c, 1.0);
  }
`;

export const PRESETS = {
  dawn: {
    label: 'DAWN RUN',
    top: 0x1b2b6b, mid: 0x6f7fd6, bottom: 0xffb98a, sun: 0xffd9a0,
    sunDir: [0.35, 0.30, -0.9], fog: 0xcdd6f0, fogNear: 2400, fogFar: 15000,
    hemiSky: 0xcadaff, hemiGround: 0x5a5040, hemiI: 0.9, dirI: 1.9,
  },
  noon: {
    label: 'HIGH NOON',
    top: 0x2a63c9, mid: 0x83bdf2, bottom: 0xd8ecff, sun: 0xffffff,
    sunDir: [0.4, 0.72, -0.5], fog: 0xc8dcf2, fogNear: 3200, fogFar: 19000,
    hemiSky: 0xcfe6ff, hemiGround: 0x6a7a54, hemiI: 0.95, dirI: 2.1,
  },
  dusk: {
    label: 'NEON DUSK',
    top: 0x1b1450, mid: 0x8a4a8f, bottom: 0xff9a63, sun: 0xffc08a,
    sunDir: [-0.5, 0.42, -0.75], fog: 0xc08fa2, fogNear: 2600, fogFar: 16000,
    hemiSky: 0xffd6ba, hemiGround: 0x4a3a5e, hemiI: 1.35, dirI: 2.3, ambI: 1.05,
  },
};

export class Environment {
  constructor(scene, presetName = 'dawn', seed = 7, renderer = null) {
    this.scene = scene;
    this.preset = PRESETS[presetName] ?? PRESETS.dawn;
    const p = this.preset;

    const col = (h) => new THREE.Color(h).convertSRGBToLinear();

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVert, fragmentShader: skyFrag,
      side: THREE.BackSide, depthWrite: false, depthTest: false,
      uniforms: {
        uTop: { value: col(p.top) },
        uMid: { value: col(p.mid) },
        uBottom: { value: col(p.bottom) },
        uSunColor: { value: col(p.sun) },
        uSunDir: { value: new THREE.Vector3(...p.sunDir).normalize() },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 20), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    scene.add(this.sky);

    scene.fog = new THREE.Fog(col(p.fog), p.fogNear, p.fogFar);

    this.hemi = new THREE.HemisphereLight(col(p.hemiSky), col(p.hemiGround), p.hemiI * 1.6);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(col(p.sun), p.dirI);
    this.sun.position.set(...p.sunDir).multiplyScalar(1000);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.ambient = new THREE.AmbientLight(col(p.mid), p.ambI ?? 0.55);
    scene.add(this.ambient);

    // Reflect the actual sky: gives the water and the metal hulls a palette
    // that matches whichever time-of-day preset is running.
    if (renderer) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 20), this.skyMat.clone());
      dome.material.depthTest = true;
      dome.material.depthWrite = true;
      envScene.add(dome);
      scene.environment = pmrem.fromScene(envScene, 0).texture;
      scene.environmentIntensity = 1.0;
      pmrem.dispose();
      dome.geometry.dispose();
    }

    this._buildWater(col(p.mid));
    this._buildClouds(seed, col(p.bottom));
    this.time = 0;
  }

  _buildWater(tint) {
    const geo = new THREE.PlaneGeometry(60000, 60000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x0d4468).convertSRGBToLinear(),
      metalness: 0.62, roughness: 0.14,
      envMapIntensity: 1.35,
    });
    this.water = new THREE.Mesh(geo, this.waterMat);
    this.water.position.y = -4;
    this.water.renderOrder = -5;
    this.scene.add(this.water);
  }

  _buildClouds(seed, tint) {
    const rng = mulberry32(seed);
    const N = 120;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff, transparent: true, opacity: 0.55,
      flatShading: true, depthWrite: false, fog: true,
      emissive: 0x000000,
    });
    this.cloudMesh = new THREE.InstancedMesh(geo, mat, N);
    this.cloudMesh.frustumCulled = false;
    this.cloudData = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const d = {
        x: (rng() - 0.5) * 26000,
        y: 1750 + rng() * 2400,
        z: (rng() - 0.5) * 26000,
        sx: 300 + rng() * 760,
        sy: 55 + rng() * 95,
        sz: 280 + rng() * 700,
        drift: 6 + rng() * 14,
      };
      this.cloudData.push(d);
      pos.set(d.x, d.y, d.z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI);
      s.set(d.sx, d.sy, d.sz);
      m.compose(pos, q, s);
      this.cloudMesh.setMatrixAt(i, m);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.cloudMesh);
    this._m = m; this._q = q; this._s = s; this._p = pos;
  }

  update(dt, camPos) {
    this.time += dt;
    this.sky.position.copy(camPos);
    this.water.position.x = camPos.x;
    this.water.position.z = camPos.z;

    this.sun.position.copy(camPos).addScaledVector(
      new THREE.Vector3(...this.preset.sunDir).normalize(), 3000);
    this.sun.target.position.copy(camPos);

    // recycle clouds around the player so the sky never empties out
    const R = 13000;
    for (let i = 0; i < this.cloudData.length; i++) {
      const d = this.cloudData[i];
      d.x += d.drift * dt;
      if (d.x - camPos.x > R) d.x -= R * 2;
      if (camPos.x - d.x > R) d.x += R * 2;
      if (d.z - camPos.z > R) d.z -= R * 2;
      if (camPos.z - d.z > R) d.z += R * 2;
      this._p.set(d.x, d.y, d.z);
      this._q.identity();
      this._s.set(d.sx, d.sy, d.sz);
      this._m.compose(this._p, this._q, this._s);
      this.cloudMesh.setMatrixAt(i, this._m);
    }
    this.cloudMesh.instanceMatrix.needsUpdate = true;
  }
}
