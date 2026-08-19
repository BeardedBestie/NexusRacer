import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SHIP_LENGTH } from './scale.js';

// ---------------------------------------------------------------------------
// Weapon archetypes
// ---------------------------------------------------------------------------
export const WEAPONS = {
  pulseLaser: {
    id: 'pulseLaser', name: 'Pulse Laser', kind: 'projectile',
    dmg: 14, speed: 2600, rof: 7, spread: 0.004, heat: 0.055, life: 1.6,
    color: 0x5ef2ff, size: [0.5, 22], salvo: 2, salvoSpread: 1.6, tracer: 'bolt',
  },
  railLaser: {
    id: 'railLaser', name: 'Rail Laser', kind: 'projectile',
    dmg: 42, speed: 5200, rof: 1.8, spread: 0.0008, heat: 0.28, life: 1.4,
    color: 0xff4fd8, size: [0.7, 60], salvo: 1, tracer: 'bolt',
  },
  beamLance: {
    id: 'beamLance', name: 'Beam Lance', kind: 'beam',
    dps: 78, range: 1400, heat: 0.85, color: 0xb6ff3d, width: 1.1,
  },
  machineGun: {
    id: 'machineGun', name: 'Vulcan MG', kind: 'projectile',
    dmg: 6, speed: 2100, rof: 18, spread: 0.016, heat: 0.028, life: 1.2,
    color: 0xffd27a, size: [0.28, 10], salvo: 1, tracer: 'bolt',
  },
  scatterGun: {
    id: 'scatterGun', name: 'Scatter Blaster', kind: 'projectile',
    dmg: 9, speed: 1700, rof: 3.2, spread: 0.045, heat: 0.16, life: 0.9,
    color: 0xff9ee8, size: [0.45, 12], salvo: 6, tracer: 'bolt',
  },
  missile: {
    id: 'missile', name: 'Seeker Missile', kind: 'missile',
    dmg: 55, speed: 620, accel: 900, turn: 2.6, life: 6.5, splash: 26, splashR: 45,
    ammoCost: 1, color: 0xffb347,
  },
  rocket: {
    id: 'rocket', name: 'Rocket Pod', kind: 'missile',
    dmg: 34, speed: 900, accel: 1500, turn: 0.35, life: 4.0, splash: 60, splashR: 90,
    ammoCost: 1, color: 0xff6a3d, salvo: 3, salvoSpread: 3.2,
  },
  heavyRocket: {
    id: 'heavyRocket', name: 'Siege Rocket', kind: 'missile',
    dmg: 90, speed: 700, accel: 1100, turn: 0.2, life: 5.0, splash: 130, splashR: 140,
    ammoCost: 1, color: 0xff3d3d,
  },
};

// ---------------------------------------------------------------------------
// Ship roster.  Stats are 0..10 designer-facing and get resolved to physical
// values in `resolveStats`.
// ---------------------------------------------------------------------------
export const SHIPS = [
  {
    id: 'azure-comet',
    name: 'AZURE COMET',
    klass: 'Sprinter',
    file: 'Meshy_AI_Azure_Comet_0818004749_texture.glb',
    accent: '#4db8ff',
    blurb: 'Pure kinetic energy with a cockpit bolted on. Regenerates boost faster than anything else flying.',
    stats: { accel: 9.0, speed: 8.5, handling: 6.0, boost: 9.0, hull: 3.5, mass: 3.2 },
    primary: 'railLaser', secondary: 'missile', secondaryAmmo: 7,
    ability: { id: 'cometTail', name: 'Comet Tail', desc: 'Boost stops draining entirely', cd: 16, dur: 5.0 },
  },
  {
    id: 'desert-cruiser',
    name: 'DESERT CRUISER',
    klass: 'Liner',
    file: 'Meshy_AI_Azure_Starcruiser_0818060008_texture.glb',
    accent: '#4de0ff',
    blurb: 'Built for long hauls between nowhere and nowhere. Slow to wind up, impossible to stop, and it carries fuel like a grudge.',
    stats: { accel: 4.5, speed: 8.0, handling: 4.0, boost: 9.5, hull: 9.5, mass: 9.0 },
    primary: 'railLaser', secondary: 'heavyRocket', secondaryAmmo: 9,
    magnet: 1.6,
    ability: { id: 'aegis', name: 'Aegis Shell', desc: 'Absorbs the next 300 damage', cd: 22, dur: 6.0 },
  },
  {
    id: 'emerald-serpent',
    name: 'EMERALD SERPENT',
    klass: 'Interceptor',
    file: 'Meshy_AI_Emerald_Serpent_Starf_0818055844_texture.glb',
    accent: '#4dffa8',
    blurb: 'Coiled and quick. Bites hard in the corners, punishes anything in a straight line behind it.',
    stats: { accel: 7.5, speed: 7.0, handling: 8.5, boost: 6.5, hull: 5.0, mass: 4.5 },
    primary: 'pulseLaser', secondary: 'missile', secondaryAmmo: 8,
    ability: { id: 'phaseCoil', name: 'Phase Coil', desc: 'Brief i-frames + 40% turn boost', cd: 14, dur: 2.2 },
  },
  {
    id: 'dark-dragon',
    name: 'DARK DRAGON',
    klass: 'Stalker',
    file: 'Meshy_AI_Emerald_Serpent_Starf_0818003629_texture.glb',
    accent: '#9d5cff',
    blurb: 'The Serpent\u2019s older, meaner cousin. Same bones, blacked out, and considerably less interested in your survival.',
    stats: { accel: 7.5, speed: 7.5, handling: 8.0, boost: 6.5, hull: 5.5, mass: 4.8 },
    primary: 'railLaser', secondary: 'missile', secondaryAmmo: 8,
    ability: { id: 'phaseCoil', name: 'Phase Coil', desc: 'Brief i-frames + 40% turn boost', cd: 14, dur: 2.4 },
  },
  {
    id: 'sugarblade',
    name: 'SUGARBLADE',
    klass: 'Trickster',
    file: 'Meshy_AI_Cotton_Candy_Starfigh_0818003636_texture.glb',
    accent: '#ff9ee8',
    blurb: 'Absurdly nimble, dangerously soft. Point-blank scatter fire is its whole personality.',
    stats: { accel: 6.5, speed: 5.5, handling: 10.0, boost: 7.0, hull: 3.5, mass: 3.0 },
    primary: 'scatterGun', secondary: 'rocket', secondaryAmmo: 9,
    ability: { id: 'sugarRush', name: 'Sugar Rush', desc: 'Instant boost refill + 25% speed', cd: 18, dur: 3.5 },
  },
  {
    id: 'nimbus-floss',
    name: 'NIMBUS FLOSS',
    klass: 'Collector',
    file: 'Meshy_AI_Cotton_Candy_Starfigh_0818003641_texture.glb',
    accent: '#ffc2f2',
    blurb: 'Built for the sweep. Enormous pickup magnet and a payout multiplier on every shard.',
    stats: { accel: 6.0, speed: 6.0, handling: 8.0, boost: 8.0, hull: 4.0, mass: 3.5 },
    primary: 'pulseLaser', secondary: 'missile', secondaryAmmo: 6,
    magnet: 3.0, scoreMult: 1.35,
    ability: { id: 'vortex', name: 'Vortex Pull', desc: 'Yanks every shard within 900m', cd: 22, dur: 2.0 },
  },
  {
    id: 'rustwing-93',
    name: 'RUSTWING 93',
    klass: 'Bruiser',
    file: 'Meshy_AI_Rustwing_93_0818003700_texture.glb',
    accent: '#d98a4a',
    blurb: 'Held together by spite and rivets. Hits like a falling building, turns like one too.',
    stats: { accel: 5.0, speed: 6.5, handling: 4.0, boost: 5.0, hull: 9.0, mass: 8.5 },
    primary: 'machineGun', secondary: 'heavyRocket', secondaryAmmo: 5,
    ability: { id: 'bulwark', name: 'Bulwark', desc: '70% damage reduction, no steering loss', cd: 20, dur: 4.0 },
  },
  {
    id: 'rustwing-vulcan',
    name: 'RUSTWING VULCAN',
    klass: 'Gunship',
    file: 'Meshy_AI_Rustwing_93_0818003711_texture.glb',
    accent: '#ffb347',
    blurb: 'Someone welded four more barrels onto a Rustwing. Nobody has asked them to stop.',
    stats: { accel: 5.5, speed: 6.0, handling: 4.5, boost: 6.0, hull: 8.0, mass: 8.0 },
    primary: 'machineGun', secondary: 'rocket', secondaryAmmo: 12,
    heatMult: 0.6,
    ability: { id: 'overspin', name: 'Overspin', desc: 'Double fire rate, zero heat', cd: 16, dur: 4.5 },
  },
  {
    id: 'gilded-nautilus',
    name: 'GILDED NAUTILUS',
    klass: 'Juggernaut',
    file: 'Meshy_AI_Gilded_Nautilus_0818003655_texture.glb',
    accent: '#ffd66b',
    blurb: 'A vault with engines. Deepest boost reserves in the fleet and a siege rocket to match.',
    stats: { accel: 4.5, speed: 7.5, handling: 3.5, boost: 10.0, hull: 10.0, mass: 10.0 },
    primary: 'railLaser', secondary: 'heavyRocket', secondaryAmmo: 8,
    ability: { id: 'aegis', name: 'Aegis Shell', desc: 'Absorbs the next 300 damage', cd: 24, dur: 6.0 },
  },
  {
    id: 'the-patriot',
    name: 'THE PATRIOT',
    klass: 'Speedrunner',
    file: 'Meshy_AI_Neon_Skyblade_0818003705_texture.glb',
    accent: '#5ef2ff',
    blurb: 'Top speed leader, painted like a flypast. The beam lance melts whatever it can hold still long enough to look at.',
    stats: { accel: 7.0, speed: 10.0, handling: 6.5, boost: 7.5, hull: 4.5, mass: 4.0 },
    primary: 'beamLance', secondary: 'missile', secondaryAmmo: 6,
    ability: { id: 'slipstream', name: 'Slipstream', desc: 'Drag collapses, +45% top speed', cd: 17, dur: 3.0 },
  },
  {
    id: 'neon-skyblade-x',
    name: 'SKYBLADE //X',
    klass: 'Duelist',
    file: 'Meshy_AI_Neon_Skyblade_0818003724_texture.glb',
    accent: '#a86bff',
    blurb: 'Tuned for the launch, not the lap. Rail lasers punch straight through anything lightweight.',
    stats: { accel: 10.0, speed: 8.0, handling: 7.0, boost: 6.0, hull: 4.5, mass: 3.8 },
    primary: 'railLaser', secondary: 'missile', secondaryAmmo: 10,
    ability: { id: 'blink', name: 'Blink Drive', desc: 'Snap 2.5km forward, instantly', cd: 12, dur: 0.15, dist: 2500 },
  },
  {
    id: 'pastel-starfighter',
    name: 'PASTEL STARFIGHTER',
    klass: 'All-Rounder',
    file: 'Meshy_AI_Neon_Starfighter_0818003720_texture.glb',
    accent: '#ffa8e0',
    blurb: 'No weak stat, no standout one, and a paint job like a sunset. The ship you pick when you plan to out-fly people, not out-stat them.',
    stats: { accel: 7.0, speed: 7.5, handling: 7.0, boost: 7.0, hull: 6.5, mass: 5.5 },
    primary: 'pulseLaser', secondary: 'rocket', secondaryAmmo: 10,
    ability: { id: 'overdrive', name: 'Overdrive', desc: '+30% to everything. No downside. Enjoy.', cd: 20, dur: 3.0 },
  },
  {
    id: 'goldie-grr',
    name: 'GOLDIE GRR',
    klass: 'Cruiser',
    file: 'Meshy_AI_Neon_Manta_Cruiser_0818004714_texture.glb',
    accent: '#ffc233',
    blurb: 'Wide, gold and completely unbothered. Glides through gate lines other ships have to fight for.',
    stats: { accel: 5.0, speed: 7.0, handling: 6.0, boost: 8.5, hull: 8.5, mass: 8.0 },
    primary: 'beamLance', secondary: 'heavyRocket', secondaryAmmo: 7,
    magnet: 2.0,
    ability: { id: 'glide', name: 'Glide Field', desc: 'No drag, no gravity, for four seconds', cd: 19, dur: 4.0 },
  },
  {
    id: 'party-monster',
    name: 'PARTY MONSTER',
    klass: 'Assassin',
    file: 'Meshy_AI_Neon_Starblade_0818004803_texture.glb',
    accent: '#c66bff',
    blurb: 'Thin as a rumour and twice as fast to spread. Its blink drive reaches five times further than anyone else\u2019s — it is across the map before the alarm finishes.',
    stats: { accel: 8.5, speed: 9.0, handling: 8.0, boost: 6.5, hull: 3.5, mass: 3.4 },
    primary: 'railLaser', secondary: 'missile', secondaryAmmo: 9,
    ability: { id: 'blink', name: 'Blink Drive ×5', desc: 'Snap 12.5km forward, instantly', cd: 14, dur: 0.15, dist: 12500 },
  },
  {
    id: 'butter-rocket',
    name: 'BUTTER ROCKET',
    klass: 'Wildcard',
    file: 'Meshy_AI_Butter_Rocket_0818004730_texture.glb',
    accent: '#ffd97a',
    blurb: 'Slides through corners like it is greased, because it is. Rocket pods on every hardpoint.',
    stats: { accel: 8.0, speed: 7.0, handling: 5.5, boost: 6.5, hull: 5.5, mass: 5.0 },
    primary: 'scatterGun', secondary: 'rocket', secondaryAmmo: 15,
    // Measured on the four-yaw sheet (/?grid=1&yaws=butter-rocket): this hull's
    // length axis is X, canopy forward, so it needs a quarter turn the other way.
    modelYaw: -Math.PI / 2,
    ability: { id: 'greaseTrail', name: 'Grease Trail', desc: 'Drag halves, turn rate up 20%', cd: 15, dur: 4.0 },
  },
  {
    id: 'red-pig',
    name: 'RED PIG',
    klass: 'Veteran',
    file: 'Meshy_AI_Rosso_Porco_Jet_0818004709_texture.glb',
    accent: '#ff5c4d',
    blurb: 'An old seaplane that never got the memo about the future. Still out-turns most of the grid.',
    stats: { accel: 6.0, speed: 5.5, handling: 9.5, boost: 5.5, hull: 6.5, mass: 5.5 },
    primary: 'machineGun', secondary: 'rocket', secondaryAmmo: 10,
    heatMult: 0.7,
    ability: { id: 'aceInstinct', name: 'Ace Instinct', desc: 'Turn rate +60%, damage taken -40%', cd: 18, dur: 4.5 },
  },
  {
    id: 'tw-humpty',
    name: 'TW-H HUMPTY',
    klass: 'Training Wheels',
    file: 'Meshy_AI_Rainbow_Rocket_Racer_0818052725_texture.glb',
    accent: '#ff5f5f',
    blurb: 'A toy with a flight licence. Slow, stable and almost impossible to crash — the one you hand somebody who has never flown before.',
    stats: { accel: 4.0, speed: 2.5, handling: 9.0, boost: 6.0, hull: 9.5, mass: 6.0 },
    primary: 'pulseLaser', secondary: 'rocket', secondaryAmmo: 12,
    magnet: 2.4, trainer: true, sizeMult: 0.8,
    ability: { id: 'bumper', name: 'Bumper Field', desc: 'Shrugs off 80% of everything', cd: 14, dur: 5.0 },
  },
  {
    id: 'tw-dumpty',
    name: 'TW-D DUMPTY',
    klass: 'Training Wheels',
    file: 'Meshy_AI_Rainbow_Rocket_Racer_0818052732_texture.glb',
    accent: '#7ad4ff',
    blurb: 'Humpty\u2019s slightly braver sibling. Still forgiving, still slow, but it will actually turn when you ask it to.',
    stats: { accel: 4.5, speed: 3.0, handling: 9.5, boost: 6.5, hull: 9.0, mass: 5.5 },
    primary: 'scatterGun', secondary: 'missile', secondaryAmmo: 10,
    magnet: 2.4, trainer: true, sizeMult: 0.8,
    ability: { id: 'bumper', name: 'Bumper Field', desc: 'Shrugs off 80% of everything', cd: 14, dur: 5.0 },
  },
];

export const SHIPS_BY_ID = Object.fromEntries(SHIPS.map((s) => [s.id, s]));

/** Deterministic pick of `n` hulls for the opposition, never the player's own. */
export function pickEnemyShips(excludeId, n, seed = 0) {
  const pool = SHIPS.filter((s) => s.id !== excludeId);
  const out = [];
  for (let i = 0; i < n; i++) out.push(pool[(i * 5 + seed * 3 + 2) % pool.length]);
  return out;
}

// Map 0..10 designer stats to physical simulation values
export function resolveStats(ship) {
  const s = ship.stats;
  // Trainers are deliberately gentle: low top speed, heavy damping, and enough
  // lift that they simply refuse to fall out of the sky.
  const trainer = !!ship.trainer;
  return {
    trainer,
    maxSpeed: (260 + s.speed * 62) * (trainer ? 0.62 : 1),  // m/s
    thrust: 90 + s.accel * 34,               // m/s^2
    brake: 55 + s.handling * 9,
    pitchRate: 0.85 + s.handling * 0.155,    // rad/s
    yawRate: 0.42 + s.handling * 0.072,
    rollRate: 1.6 + s.handling * 0.30,
    inertia: (1.0 + (10 - s.handling) * 0.14) * (trainer ? 0.7 : 1),
    boostMax: 60 + s.boost * 16,
    boostRegen: 5 + s.boost * 2.1,
    boostDrain: 24 - s.boost * 0.85,
    boostThrust: 190 + s.boost * 26,
    hullMax: 60 + s.hull * 26,
    mass: 0.8 + s.mass * 0.13,
    liftCoef: (0.85 + s.handling * 0.03) * (trainer ? 1.5 : 1),
    magnet: (ship.magnet ?? 1) * 260,
    scoreMult: ship.scoreMult ?? 1,
    heatMult: ship.heatMult ?? 1,
  };
}

// ---------------------------------------------------------------------------
// Model loading + normalisation
// ---------------------------------------------------------------------------
const loader = new GLTFLoader();
const cache = new Map();

const ORIENT_KEY = 'nexusracer.orient.v2';
export const orientOverrides = JSON.parse(localStorage.getItem(ORIENT_KEY) || '{}');
export function saveOrient() {
  localStorage.setItem(ORIENT_KEY, JSON.stringify(orientOverrides));
}

/** Drop a manual override so the hull falls back to geometric detection. */
export function resetOrientation(wrap) {
  const id = wrap?.userData?.shipId;
  if (!id) return;
  delete orientOverrides[id];
  wrap.userData.inner.rotation.y = wrap.userData.baseYaw;
  saveOrient();
}

// One-time cleanup of overrides written against the old heuristic.
try { localStorage.removeItem('nexusracer.orient.v1'); } catch { /* ignore */ }

const TARGET_LEN = SHIP_LENGTH; // world units, nose-to-tail

/**
 * Work out which way a model faces, from geometry alone.
 *
 * Two objective tests on a coarse voxel occupancy grid:
 *   1. Aircraft are mirror-symmetric across the plane containing their length
 *      axis, so reflecting along the *lateral* axis maps the hull onto itself.
 *      Whichever horizontal axis reflects with less error is the lateral one;
 *      the other is the length axis.
 *   2. Hulls taper toward the nose, so of the two ends of the length axis the
 *      one with less occupied volume is the front.
 *
 * Returns the yaw needed to point the nose down -Z.
 */
const GRID = 26;

function detectForwardYaw(root, box, size) {
  const min = box.min, inv = new THREE.Vector3(
    GRID / Math.max(size.x, 1e-6), GRID / Math.max(size.y, 1e-6), GRID / Math.max(size.z, 1e-6));
  const vox = new Uint8Array(GRID * GRID * GRID);
  const v = new THREE.Vector3();
  const idx = (x, y, z) => (z * GRID + y) * GRID + x;
  const clamp = (n) => Math.min(GRID - 1, Math.max(0, n | 0));

  root.updateWorldMatrix(true, true);
  let sampled = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(pos.count / 20000));
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      vox[idx(clamp((v.x - min.x) * inv.x), clamp((v.y - min.y) * inv.y), clamp((v.z - min.z) * inv.z))] = 1;
      sampled++;
    }
  });
  if (!sampled) return 0;

  // --- 1. which horizontal axis is the mirror (lateral) axis? --------------
  let errX = 0, errZ = 0, total = 0;
  for (let z = 0; z < GRID; z++) {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const a = vox[idx(x, y, z)];
        if (a) total++;
        if (a !== vox[idx(GRID - 1 - x, y, z)]) errX++;
        if (a !== vox[idx(x, y, GRID - 1 - z)]) errZ++;
      }
    }
  }
  if (!total) return 0;
  const lengthIsZ = errX <= errZ;    // X reflects cleanly => X is lateral

  // --- 2. which end of the length axis is the nose? ------------------------
  const band = Math.max(2, Math.round(GRID * 0.28));
  let lo = 0, hi = 0;
  for (let z = 0; z < GRID; z++) {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (!vox[idx(x, y, z)]) continue;
        const k = lengthIsZ ? z : x;
        if (k < band) lo++;
        else if (k >= GRID - band) hi++;
      }
    }
  }
  // Thinner end is the nose.  `lo` is the -axis end, `hi` the +axis end.
  const noseAtNegative = lo <= hi;

  if (lengthIsZ) return noseAtNegative ? 0 : Math.PI;
  // length runs along X: rotate so the nose lands on -Z
  return noseAtNegative ? -Math.PI / 2 : Math.PI / 2;
}

/**
 * Loads a ship GLB, centres it, scales it to TARGET_LEN and orients its
 * longest horizontal axis down -Z (forward).  Returns a fresh Group each call.
 */
/**
 * Fetch, normalise and cache one hull. The cache holds the *promise*, not the
 * result, so a preload already in flight and a selection asking for the same
 * hull share the one fetch instead of racing to download it twice.
 */
function loadBase(ship, onProgress) {
  const cacheKey = ship.cacheKey ?? ship.id;
  let pending = cache.get(cacheKey);
  if (!pending) {
    pending = buildBase(ship, onProgress);
    // A failed fetch must not be cached as permanent — let the next ask retry.
    pending.catch(() => cache.delete(cacheKey));
    cache.set(cacheKey, pending);
  }
  return pending;
}

async function buildBase(ship, onProgress) {
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${ship.file}`, onProgress);
  const root = gltf.scene;

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      const m = o.material;
      if (m) {
        m.side = THREE.FrontSide;
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
        if ('metalness' in m) m.metalness = Math.min(m.metalness ?? 0.2, 0.45);
        if ('roughness' in m) m.roughness = Math.max(m.roughness ?? 0.6, 0.35);
        if ('envMapIntensity' in m) m.envMapIntensity = 1.1;
      }
    }
  });

  // Normalise: centre + scale + auto-orient
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  root.position.sub(center);

  const holder = new THREE.Group();
  holder.add(root);
  const yaw = ship.modelYaw !== undefined
    ? ship.modelYaw
    : detectForwardYaw(root, box, size);
  holder.rotation.y = yaw;

  const longest = Math.max(size.x, size.z);
  const scale = (TARGET_LEN * (ship.sizeMult ?? 1)) / Math.max(longest, 0.001);
  holder.scale.setScalar(scale);

  return { holder, autoYaw: yaw, size, scale };
}

/**
 * Walk the roster in order and warm every hull, so a hull is already in the
 * cache by the time it is selected and the LOADING HULL chip never shows.
 *
 * Sequential on purpose: one fetch at a time leaves bandwidth for whatever the
 * player is actually waiting on, and yielding between hulls keeps the GLB parse
 * from stuttering the hangar diorama. Hulls that share a `cacheKey` are only
 * fetched once, so this is one pass over the distinct models, not the roster.
 */
let preloadPaused = false;

/** Hold the preloader off while something the player is waiting on loads. */
export function pausePreload(on) { preloadPaused = on; }

export async function preloadShips(onProgress) {
  for (let i = 0; i < SHIPS.length; i++) {
    while (preloadPaused) await new Promise((r) => setTimeout(r, 300));
    try {
      await loadBase(SHIPS[i]);
    } catch (err) {
      console.warn('hull preload failed', SHIPS[i].id, err);
    }
    onProgress?.(i + 1, SHIPS.length);
    await new Promise((r) => setTimeout(r, 60));
  }
}

export async function loadShipModel(ship, onProgress) {
  const base = await loadBase(ship, onProgress);

  const inst = base.holder.clone(true);
  // An explicit modelYaw in the roster is authoritative — drop any stale manual
  // nudge saved against the old auto-detected facing.
  if (ship.modelYaw !== undefined && orientOverrides[ship.id] !== undefined) {
    delete orientOverrides[ship.id];
    saveOrient();
  }
  const extraYaw = orientOverrides[ship.id] ?? 0;
  inst.rotation.y = base.autoYaw + extraYaw;
  const wrap = new THREE.Group();
  wrap.add(inst);
  wrap.userData.inner = inst;
  wrap.userData.baseYaw = base.autoYaw;
  wrap.userData.shipId = ship.id;
  return wrap;
}

export function nudgeOrientation(wrap, deltaYaw) {
  const id = wrap.userData.shipId;
  orientOverrides[id] = ((orientOverrides[id] ?? 0) + deltaYaw) % (Math.PI * 2);
  wrap.userData.inner.rotation.y = wrap.userData.baseYaw + orientOverrides[id];
  saveOrient();
}
