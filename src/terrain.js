import * as THREE from 'three';
import { fbm2, ridged2, valueNoise2 } from './noise.js';

export const SEA_LEVEL = 0;

// ---------------------------------------------------------------------------
// Height field:  h = B (continents) + R (ridges) + D (detail) - C (carving)
// ---------------------------------------------------------------------------
export class HeightField {
  constructor(seed = 1337) {
    this.seed = seed | 0;
  }

  // Continental mass: very low frequency, features far larger than a chunk
  continent(x, z) {
    const s = this.seed;
    const base = fbm2(x * 0.000085, z * 0.000085, s, 4);
    const warp = fbm2(x * 0.00022 + 11.3, z * 0.00022 - 4.7, s + 501, 3) * 0.35;
    return (base + warp) * 900;
  }

  // Mountain ranges: ridged noise gated by continental mass
  ridges(x, z, cont) {
    const mask = THREE.MathUtils.smoothstep(cont, 40, 620);
    if (mask <= 0.001) return 0;
    const s = this.seed + 9001;
    const r = ridged2(x * 0.00042, z * 0.00042, s, 6);
    const r2 = ridged2(x * 0.0016, z * 0.0016, s + 77, 4);
    return (Math.pow(r, 1.7) * 1450 + r2 * 130) * mask;
  }

  // High-frequency surface variation, kept subtle to preserve the low-poly read
  detail(x, z) {
    return fbm2(x * 0.0042, z * 0.0042, this.seed + 313, 3) * 26;
  }

  // Rivers / valleys / basin carving
  carve(x, z, cont) {
    if (cont < -40) return 0;
    const r = ridged2(x * 0.00028 + 88.1, z * 0.00028 - 33.9, this.seed + 4242, 4);
    const river = Math.pow(THREE.MathUtils.smoothstep(r, 0.72, 0.99), 1.4);
    const basin = Math.max(0, fbm2(x * 0.00035, z * 0.00035, this.seed + 61, 3)) * 90;
    return river * 230 + basin;
  }

  height(x, z) {
    const cont = this.continent(x, z);
    let h = cont + this.ridges(x, z, cont) + this.detail(x, z) - this.carve(x, z, cont);
    // Flatten shallow shelves for readable coastlines & landable plains
    if (h > -20 && h < 90) h *= 0.72;
    return h;
  }

  moisture(x, z) { return fbm2(x * 0.00016 + 500, z * 0.00016 - 200, this.seed + 77, 3); }
  temperature(x, z) { return fbm2(x * 0.00011 - 900, z * 0.00011 + 640, this.seed + 91, 3); }

  normal(x, z, eps = 6, out = new THREE.Vector3()) {
    const hL = this.height(x - eps, z), hR = this.height(x + eps, z);
    const hD = this.height(x, z - eps), hU = this.height(x, z + eps);
    return out.set(hL - hR, 2 * eps, hD - hU).normalize();
  }
}

// ---------------------------------------------------------------------------
// Palette / biome classification
// ---------------------------------------------------------------------------
const C = (hex) => new THREE.Color(hex).convertSRGBToLinear();

const PAL = {
  deep:    C(0x0a2a4d),
  shallow: C(0x1d7b9c),
  beach:   C(0xe8d9a6),
  grass1:  C(0x568f3f),
  grass2:  C(0x79b95a),
  forest1: C(0x2c6438),
  forest2: C(0x3d7c45),
  scrub:   C(0x9b9c5c),
  desert:  C(0xdcb56d),
  badland: C(0xb27a4d),
  rock1:   C(0x6c6c74),
  rock2:   C(0x8d8c93),
  alpine:  C(0xa3acb1),
  snow:    C(0xf4f8ff),
};

const _a = new THREE.Color(), _b = new THREE.Color();

// Returns rgb into `out`. slope01: 0 flat -> 1 vertical.
export function biomeColor(h, slope01, moist, temp, jitter, out) {
  if (h < -140)      _a.copy(PAL.deep);
  else if (h < -8)   _a.copy(PAL.deep).lerp(PAL.shallow, THREE.MathUtils.smoothstep(h, -140, -8));
  else if (h < 14)   _a.copy(PAL.shallow).lerp(PAL.beach, THREE.MathUtils.smoothstep(h, -8, 14));
  else if (h < 240) {
    // lowlands: grass <-> forest <-> desert driven by moisture / temperature
    const wet = THREE.MathUtils.smoothstep(moist, -0.15, 0.35);
    const hot = THREE.MathUtils.smoothstep(temp, 0.05, 0.45);
    _a.copy(PAL.grass1).lerp(PAL.grass2, jitter);
    _b.copy(PAL.forest1).lerp(PAL.forest2, jitter);
    _a.lerp(_b, wet * 0.85);
    _b.copy(PAL.scrub).lerp(PAL.desert, hot);
    _a.lerp(_b, hot * (1 - wet) * 0.9);
    _a.lerp(PAL.beach, THREE.MathUtils.smoothstep(h, 14, 34) < 1 ? 0.35 * (1 - THREE.MathUtils.smoothstep(h, 14, 34)) : 0);
  }
  else if (h < 620)  _a.copy(PAL.badland).lerp(PAL.rock1, THREE.MathUtils.smoothstep(h, 240, 620));
  else if (h < 1050) _a.copy(PAL.rock1).lerp(PAL.alpine, THREE.MathUtils.smoothstep(h, 620, 1050));
  else               _a.copy(PAL.alpine).lerp(PAL.snow, THREE.MathUtils.smoothstep(h, 1000, 1450));

  // Exposed rock on steep faces
  if (slope01 > 0.42 && h > 20) {
    _b.copy(PAL.rock1).lerp(PAL.rock2, jitter);
    _a.lerp(_b, THREE.MathUtils.smoothstep(slope01, 0.42, 0.8) * 0.85);
  }
  // Snow only sticks to shallow slopes
  if (h > 950 && slope01 < 0.55) {
    _a.lerp(PAL.snow, THREE.MathUtils.smoothstep(h, 950, 1350) * (1 - slope01));
  }
  const v = 0.93 + jitter * 0.14;
  out.setRGB(_a.r * v, _a.g * v, _a.b * v);
  return out;
}

// ---------------------------------------------------------------------------
// Chunked streaming terrain (flat-shaded, vertex-coloured, skirted)
// ---------------------------------------------------------------------------
const CHUNK = 900;                // world units per chunk
const LOD_RES = [40, 24, 14, 8];  // grid cells per chunk edge by LOD
const SKIRT = 90;                 // downward skirt to hide LOD cracks

export class TerrainStreamer {
  constructor(scene, hf, opts = {}) {
    this.scene = scene;
    this.hf = hf;
    this.radius = opts.radius ?? 6;
    this.chunks = new Map();
    this.queue = [];
    this.budgetPerFrame = opts.budgetPerFrame ?? 2;
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    this._c = new THREE.Color();
    this._n = new THREE.Vector3();
  }

  key(cx, cz) { return cx + ',' + cz; }

  lodFor(dist) {
    if (dist <= 1) return 0;
    if (dist <= 2) return 1;
    if (dist <= 4) return 2;
    return 3;
  }

  update(px, pz) {
    const ccx = Math.floor(px / CHUNK), ccz = Math.floor(pz / CHUNK);
    const R = this.radius;
    const wanted = new Set();

    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dz));
        if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
        const cx = ccx + dx, cz = ccz + dz;
        const k = this.key(cx, cz);
        wanted.add(k);
        const lod = this.lodFor(d);
        const existing = this.chunks.get(k);
        if (!existing) {
          this.queue.push({ cx, cz, lod, d });
          this.chunks.set(k, { pending: true, lod });
        } else if (!existing.pending && existing.lod !== lod) {
          this.queue.push({ cx, cz, lod, d });
          existing.lod = lod;
          existing.pending = true;
        }
      }
    }

    // Evict
    for (const [k, ch] of this.chunks) {
      if (!wanted.has(k)) {
        if (ch.mesh) {
          this.group.remove(ch.mesh);
          ch.mesh.geometry.dispose();
        }
        this.chunks.delete(k);
      }
    }

    // Nearest-first
    this.queue.sort((a, b) => a.d - b.d);
    let built = 0;
    while (this.queue.length && built < this.budgetPerFrame) {
      const job = this.queue.shift();
      const k = this.key(job.cx, job.cz);
      const ch = this.chunks.get(k);
      if (!ch) continue;
      if (ch.lod !== job.lod) continue;
      const mesh = this.buildChunk(job.cx, job.cz, job.lod);
      if (ch.mesh) { this.group.remove(ch.mesh); ch.mesh.geometry.dispose(); }
      ch.mesh = mesh;
      ch.pending = false;
      this.group.add(mesh);
      built++;
    }
  }

  buildChunk(cx, cz, lod) {
    const res = LOD_RES[lod];
    const step = CHUNK / res;
    const ox = cx * CHUNK, oz = cz * CHUNK;
    const hf = this.hf;

    // Sample (res+1)^2 heights
    const N = res + 1;
    const H = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        H[j * N + i] = hf.height(ox + i * step, oz + j * step);
      }
    }

    const quads = res * res;
    const skirtQuads = res * 4;
    const triCount = (quads + skirtQuads) * 2;
    const pos = new Float32Array(triCount * 3 * 3);
    const col = new Float32Array(triCount * 3 * 3);
    let p = 0, c = 0;
    const col3 = this._c;

    const pushTri = (x0, y0, z0, x1, y1, z1, x2, y2, z2, r, g, b) => {
      pos[p++] = x0; pos[p++] = y0; pos[p++] = z0;
      pos[p++] = x1; pos[p++] = y1; pos[p++] = z1;
      pos[p++] = x2; pos[p++] = y2; pos[p++] = z2;
      for (let t = 0; t < 3; t++) { col[c++] = r; col[c++] = g; col[c++] = b; }
    };

    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const x0 = i * step, x1 = (i + 1) * step;
        const z0 = j * step, z1 = (j + 1) * step;
        const h00 = H[j * N + i], h10 = H[j * N + i + 1];
        const h01 = H[(j + 1) * N + i], h11 = H[(j + 1) * N + i + 1];

        const wx = ox + x0 + step * 0.5, wz = oz + z0 + step * 0.5;
        const hAvg = (h00 + h10 + h01 + h11) * 0.25;
        const dhx = ((h10 + h11) - (h00 + h01)) * 0.5 / step;
        const dhz = ((h01 + h11) - (h00 + h10)) * 0.5 / step;
        const slope = Math.min(1, Math.hypot(dhx, dhz) * 0.9);
        const jitter = valueNoise2(wx * 0.0035, wz * 0.0035, hf.seed + 991) * 0.5 + 0.5;
        biomeColor(hAvg, slope, hf.moisture(wx, wz), hf.temperature(wx, wz), jitter, col3);
        const r = col3.r, g = col3.g, b = col3.b;

        // Alternate diagonal for a less regular faceted read
        if (((i + j) & 1) === 0) {
          pushTri(x0, h00, z0, x0, h01, z1, x1, h11, z1, r, g, b);
          pushTri(x0, h00, z0, x1, h11, z1, x1, h10, z0, r, g, b);
        } else {
          pushTri(x0, h00, z0, x0, h01, z1, x1, h10, z0, r, g, b);
          pushTri(x1, h10, z0, x0, h01, z1, x1, h11, z1, r, g, b);
        }
      }
    }

    // Skirts around the border, pinned downward, coloured like the edge
    const sc = 0.55;
    const edge = (i0, j0, i1, j1) => {
      const ax = i0 * step, az = j0 * step, bx = i1 * step, bz = j1 * step;
      const ha = H[j0 * N + i0], hb = H[j1 * N + i1];
      const hm = (ha + hb) * 0.5;
      biomeColor(hm, 0.5, 0, 0, 0.5, col3);
      const r = col3.r * sc, g = col3.g * sc, b = col3.b * sc;
      pushTri(ax, ha, az, ax, ha - SKIRT, az, bx, hb, bz, r, g, b);
      pushTri(bx, hb, bz, ax, ha - SKIRT, az, bx, hb - SKIRT, bz, r, g, b);
    };
    for (let i = 0; i < res; i++) {
      edge(i + 1, 0, i, 0);
      edge(i, res, i + 1, res);
      edge(0, i, 0, i + 1);
      edge(res, i + 1, res, i);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, this.material);
    mesh.position.set(ox, 0, oz);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.frustumCulled = true;
    return mesh;
  }

  dispose() {
    for (const [, ch] of this.chunks) if (ch.mesh) ch.mesh.geometry.dispose();
    this.chunks.clear();
    this.scene.remove(this.group);
  }
}

export { CHUNK };
