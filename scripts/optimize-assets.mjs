/**
 * Shrink the shipped assets.
 *
 *   node scripts/optimize-assets.mjs           # models + audio
 *   node scripts/optimize-assets.mjs models
 *   node scripts/optimize-assets.mjs audio
 *
 * Originals are moved to assets_src/ (untracked, not served) before anything is
 * overwritten, so this is always reversible and re-running it is a no-op for
 * files that have already been processed.
 *
 * Models: the hulls are ~97% texture by weight — three 2048x2048 JPEGs against
 * a ~230KB mesh. Resizing to 1024 and re-encoding as WebP therefore does almost
 * all the work, and it touches no geometry at all, so verified model
 * orientations and silhouettes are unaffected. Deliberately NOT using
 * simplify/quantize: they would alter meshes for a rounding error's worth of
 * savings. WebP in glTF rides on EXT_texture_webp, which three's GLTFLoader
 * reads natively — no loader changes needed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const MODELS = 'public/models';
const SOUND = 'public/sound';
const BACKUP = 'assets_src';

const TEXTURE_SIZE = 1024;
const MUSIC_KBPS = 112;     // stereo, background music
const SFX_KBPS = 96;        // short one-shots

const mb = (b) => (b / 1024 / 1024).toFixed(2) + ' MB';
const sizeOf = (p) => statSync(p).size;

function backup(dir, file) {
  const dest = join(BACKUP, dir.replace('public/', ''));
  mkdirSync(dest, { recursive: true });
  const target = join(dest, file);
  if (existsSync(target)) return false;       // already archived: this is a re-run
  copyFileSync(join(dir, file), target);
  return true;
}

function optimizeModels() {
  const files = readdirSync(MODELS).filter((f) => f.endsWith('.glb'));
  let before = 0, after = 0, done = 0;

  for (const file of files) {
    const src = join(MODELS, file);
    const size = sizeOf(src);
    if (!backup(MODELS, file)) {
      console.log(`  skip  ${file} (already optimized)`);
      before += size; after += size;
      continue;
    }
    const tmp = join(MODELS, `.tmp-${file}`);
    execFileSync('npx', [
      'gltf-transform', 'optimize', src, tmp,
      '--compress', 'false',            // leave geometry byte-for-byte alone
      '--simplify', 'false',            // ditto — these hulls are already low-poly
      '--texture-compress', 'webp',
      '--texture-size', String(TEXTURE_SIZE),
    ], { stdio: 'pipe' });
    renameSync(tmp, src);

    const now = sizeOf(src);
    before += size; after += now; done++;
    console.log(`  ${file.padEnd(52)} ${mb(size)} → ${mb(now)}`);
  }
  console.log(`\nmodels: ${done} optimized · ${mb(before)} → ${mb(after)}` +
    ` (${(100 - (after / before) * 100).toFixed(1)}% smaller)\n`);
}

function optimizeAudio() {
  const files = readdirSync(SOUND).filter((f) => /\.mp3$/i.test(f));
  let before = 0, after = 0, done = 0;

  for (const file of files) {
    const src = join(SOUND, file);
    const size = sizeOf(src);
    if (!backup(SOUND, file)) {
      console.log(`  skip  ${file} (already optimized)`);
      before += size; after += size;
      continue;
    }
    const isMusic = /bgmusic|music|theme/i.test(file);
    const tmp = join(SOUND, `.tmp-${file}`);
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', src,
      '-codec:a', 'libmp3lame',
      '-b:a', `${isMusic ? MUSIC_KBPS : SFX_KBPS}k`,
      '-ar', '44100',
      ...(isMusic ? [] : ['-ac', '1']),     // one-shots collapse to mono
      tmp,
    ], { stdio: 'pipe' });
    renameSync(tmp, src);

    const now = sizeOf(src);
    before += size; after += now; done++;
    console.log(`  ${file.padEnd(34)} ${mb(size)} → ${mb(now)}`);
  }
  console.log(`\naudio: ${done} re-encoded · ${mb(before)} → ${mb(after)}` +
    ` (${(100 - (after / before) * 100).toFixed(1)}% smaller)\n`);
}

const what = process.argv[2] ?? 'all';
mkdirSync(BACKUP, { recursive: true });
if (what === 'all' || what === 'models') optimizeModels();
if (what === 'all' || what === 'audio') optimizeAudio();
