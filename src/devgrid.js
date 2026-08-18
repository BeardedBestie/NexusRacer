// Dev-only contact sheet: renders every ship at a fixed heading so the model
// orientation can be checked at a glance.  Open /?grid=1
// A correctly oriented hull points LEFT (its local -Z is rotated to -X).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SHIPS, loadShipModel } from './ships.js';
import { SHIP_LENGTH } from './scale.js';

export async function runGrid() {
  const q = new URLSearchParams(location.search);
  const from = Number(q.get('from') || 0);
  const list = SHIPS.slice(from, from + Number(q.get('count') || SHIPS.length));
  const TILE = 300, COLS = Number(q.get('cols') || 4);
  const rows = Math.ceil(list.length / COLS);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(TILE, TILE);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1424);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x33405a, 2.2));
  const dl = new THREE.DirectionalLight(0xffffff, 2.6);
  dl.position.set(3, 6, 5).multiplyScalar(SHIP_LENGTH * 0.1);
  scene.add(dl);

  // frame whatever the current hull size is, near side-on so the silhouette
  // reads the heading
  const cam = new THREE.PerspectiveCamera(35, 1, SHIP_LENGTH * 0.02, SHIP_LENGTH * 40);
  cam.position.set(0, SHIP_LENGTH * 0.19, SHIP_LENGTH * 2.4);
  cam.lookAt(0, 0, 0);

  const rt = new THREE.WebGLRenderTarget(TILE, TILE);
  const buf = new Uint8Array(TILE * TILE * 4);

  const sheet = document.createElement('canvas');
  sheet.width = COLS * TILE;
  sheet.height = rows * TILE;
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, sheet.width, sheet.height);

  const tile = document.createElement('canvas');
  tile.width = TILE; tile.height = TILE;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(TILE, TILE);

  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI / 2;      // nose (-Z) -> -X -> screen LEFT
  scene.add(pivot);

  // ?yaws=<ship-id> renders one hull at all four cardinal yaws so the correct
  // one can be read off directly instead of guessed at.
  const yawId = q.get('yaws');
  if (yawId) {
    const ship = SHIPS.find((x) => x.id === yawId);
    const quarters = [0, 90, 180, 270];
    for (let i = 0; i < quarters.length; i++) {
      const m = await loadShipModel({ ...ship, cacheKey: `${ship.id}@${quarters[i]}`, modelYaw: (quarters[i] * Math.PI) / 180 });
      pivot.add(m);
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, TILE, TILE, buf);
      renderer.setRenderTarget(null);
      for (let y = 0; y < TILE; y++) {
        const src = (TILE - 1 - y) * TILE * 4;
        img.data.set(buf.subarray(src, src + TILE * 4), y * TILE * 4);
      }
      tctx.putImageData(img, 0, 0);
      const cx2 = (i % COLS) * TILE, cy2 = Math.floor(i / COLS) * TILE;
      ctx.drawImage(tile, cx2, cy2);
      ctx.fillStyle = '#9fe8ff';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`yaw ${quarters[i]}`, cx2 + 8, cy2 + 22);
      ctx.strokeStyle = '#ff3366'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx2 + 60, cy2 + TILE - 18); ctx.lineTo(cx2 + 14, cy2 + TILE - 18);
      ctx.moveTo(cx2 + 26, cy2 + TILE - 26); ctx.lineTo(cx2 + 14, cy2 + TILE - 18);
      ctx.lineTo(cx2 + 26, cy2 + TILE - 10);
      ctx.stroke();
      pivot.remove(m);
    }
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#05070f';
    sheet.style.cssText = 'width:100vw;height:auto;display:block';
    document.body.appendChild(sheet);
    console.log('YAWS_READY');
    return;
  }

  for (let i = 0; i < list.length; i++) {
    const ship = list[i];
    const m = await loadShipModel(ship);
    pivot.add(m);

    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, TILE, TILE, buf);
    renderer.setRenderTarget(null);

    // flip vertically — GL origin is bottom-left
    for (let y = 0; y < TILE; y++) {
      const src = (TILE - 1 - y) * TILE * 4;
      img.data.set(buf.subarray(src, src + TILE * 4), y * TILE * 4);
    }
    tctx.putImageData(img, 0, 0);

    const cx = (i % COLS) * TILE, cy = Math.floor(i / COLS) * TILE;
    ctx.drawImage(tile, cx, cy);
    ctx.fillStyle = '#9fe8ff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${from + i} ${ship.id}`, cx + 8, cy + 20);
    // arrow marking where the nose SHOULD be
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 60, cy + TILE - 18);
    ctx.lineTo(cx + 14, cy + TILE - 18);
    ctx.moveTo(cx + 26, cy + TILE - 26);
    ctx.lineTo(cx + 14, cy + TILE - 18);
    ctx.lineTo(cx + 26, cy + TILE - 10);
    ctx.stroke();

    pivot.remove(m);
  }

  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;background:#05070f';
  sheet.style.cssText = 'width:100vw;height:auto;display:block';
  document.body.appendChild(sheet);
  console.log('GRID_READY');
}
