/**
 * Generates the social share card from the real engine — /?card=1
 *
 * Renders a posed hero shot of the world (terrain, sky, water, a ship) into an
 * offscreen target, composites the logo and wordmark over it on a 2D canvas,
 * and POSTs the result to the dev-only /__save endpoint. Regenerate any time
 * the art changes; nothing here ships to production.
 */
import * as THREE from 'three';
import { HeightField, TerrainStreamer } from './terrain.js';
import { Environment } from './environment.js';
import { SHIPS_BY_ID, loadShipModel } from './ships.js';
import { SHIP_LENGTH } from './scale.js';

const W = 1200, H = 630;

// A spot with a coastline and a range behind it, found by sampling the field.
function findVista(hf) {
  let best = null, bestScore = -Infinity;
  for (let i = 0; i < 900; i++) {
    const x = (i % 30) * 2600 - 39000;
    const z = Math.floor(i / 30) * 2600 - 39000;
    const h = hf.height(x, z);
    if (h < 30 || h > 420) continue;                 // low ground, near the water
    let peak = -Infinity, water = 0;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      peak = Math.max(peak, hf.height(x + Math.cos(ang) * 5200, z + Math.sin(ang) * 5200));
      if (hf.height(x + Math.cos(ang) * 3400, z + Math.sin(ang) * 3400) < 0) water++;
    }
    const score = peak * 1.5 + water * 120;          // mountains first, coast second
    if (score > bestScore) { bestScore = score; best = { x, z }; }
  }
  return best ?? { x: 0, z: 0 };
}

export async function runCard() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.55;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, W / H, 2, 60000);
  scene.add(camera);

  const hf = new HeightField(20250817);
  const env = new Environment(scene, 'noon', 20250817, renderer);
  const terrain = new TerrainStreamer(scene, hf, { radius: 8, budgetPerFrame: 400 });

  const vista = findVista(hf);
  const ground = Math.max(hf.height(vista.x, vista.z), 0);
  const shipPos = new THREE.Vector3(vista.x, ground + 620, vista.z);

  for (let i = 0; i < 60; i++) terrain.update(shipPos.x, shipPos.z);

  const ship = await loadShipModel(SHIPS_BY_ID['the-patriot']);
  ship.position.copy(shipPos);
  ship.rotation.set(0.06, Math.PI * 0.22, -0.30);   // banked into frame
  scene.add(ship);

  // Three-quarter view from ahead and slightly below so the hull reads as huge,
  // then swung so the ship sits in the upper right and the logo has clear air
  // in the lower middle.
  const off = new THREE.Vector3(-1, 0.13, 1).normalize().multiplyScalar(SHIP_LENGTH * 2.5);
  camera.position.copy(shipPos).add(off);
  camera.lookAt(shipPos.x, shipPos.y, shipPos.z);
  camera.rotateY(-0.20);      // pushes the ship right in frame
  camera.rotateX(-0.15);      // and up, dropping the horizon
  env.update(0.016, camera.position);

  const rt = new THREE.WebGLRenderTarget(W, H);
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  const buf = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(null);

  // --- composite -----------------------------------------------------------
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W * 4;                 // GL origin is bottom-left
    img.data.set(buf.subarray(src, src + W * 4), y * W * 4);
  }
  ctx.putImageData(img, 0, 0);

  // darken the lower band so the type has something to sit on
  // Keep the treatment light — the render should carry the image. Only the
  // bottom-left corner darkens, and only as far as the type needs.
  const grad = ctx.createLinearGradient(0, H * 0.58, 0, H);
  grad.addColorStop(0, 'rgba(3,5,14,0)');
  grad.addColorStop(1, 'rgba(3,5,14,.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const side = ctx.createLinearGradient(0, 0, W * 0.5, 0);
  side.addColorStop(0, 'rgba(3,5,14,.34)');
  side.addColorStop(1, 'rgba(3,5,14,0)');
  ctx.fillStyle = side;
  ctx.fillRect(0, H * 0.4, W, H * 0.6);
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 1.0);
  vig.addColorStop(0, 'rgba(2,4,12,0)');
  vig.addColorStop(1, 'rgba(2,4,12,.2)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  const logo = new Image();
  logo.src = `${import.meta.env.BASE_URL}nexusracer_logo.png`;
  await logo.decode();
  const lw = 430, lh = lw * (logo.height / logo.width);
  ctx.shadowColor = 'rgba(94,242,255,.55)';
  ctx.shadowBlur = 44;
  ctx.drawImage(logo, 62, H - lh - 108, lw, lh);
  ctx.shadowBlur = 0;

  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,.9)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = '#c4e8fb';
  ctx.font = '600 22px "Avenir Next Condensed", "Helvetica Neue", sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText('18 CRAFT · ENDLESS PROCEDURAL WORLD · THREE WAYS TO FLY', 68, H - 74);

  ctx.fillStyle = '#8fb4d0';
  ctx.font = '500 17px "Avenir Next Condensed", "Helvetica Neue", sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('A BROWSER FLIGHT GAME · BUILT BY GRANT WALKER', 68, H - 42);
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // top-left scanline flourish, matching the in-game chrome
  ctx.strokeStyle = 'rgba(94,242,255,.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(46, 46); ctx.lineTo(46, 96); ctx.moveTo(46, 46); ctx.lineTo(126, 46);
  ctx.moveTo(W - 46, H - 46); ctx.lineTo(W - 46, H - 96);
  ctx.moveTo(W - 46, H - 46); ctx.lineTo(W - 126, H - 46);
  ctx.stroke();

  // JPEG, not PNG: this is a photographic image and scrapers have to fetch it.
  const data = c.toDataURL('image/jpeg', 0.9);
  const res = await fetch('/__save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'social-card.jpg', data }),
  }).then((r) => r.json()).catch((e) => ({ ok: false, error: String(e) }));

  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;background:#05070f;display:grid;place-items:center;min-height:100vh';
  c.style.cssText = 'max-width:96vw;height:auto;box-shadow:0 20px 80px rgba(0,0,0,.6)';
  document.body.appendChild(c);
  const note = document.createElement('div');
  note.style.cssText = 'color:#5ef2ff;font:13px ui-monospace,monospace;padding:14px;letter-spacing:.2em';
  note.textContent = res.ok ? `SAVED → ${res.path}` : `SAVE FAILED: ${res.error}`;
  document.body.appendChild(note);
  console.log('CARD_DONE', JSON.stringify(res));
}
