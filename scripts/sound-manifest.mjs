// Regenerate public/sound/manifest.json — run automatically by `npm run dev`.
//
// Also sanitises filenames: characters like '#', '?', '%' and spaces break
// static URLs (Vite serves index.html instead of the file), so any clip
// carrying them is renamed in place to a safe slug that keeps its keywords.
import { readdirSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const dir = 'public/sound';
const AUDIO = /\.(mp3|ogg|wav|m4a)$/i;
const UNSAFE = /[#?%&+ ]/;

const safeName = (file) => {
  const ext = extname(file).toLowerCase();
  let stem = basename(file, extname(file))
    .replace(/-\d{10,}$/, '')          // drop generator timestamps
    .replace(/[#?%&+]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  if (!stem) stem = 'clip';
  return stem + ext;
};

const renamed = [];
for (const file of readdirSync(dir)) {
  if (!AUDIO.test(file) || !UNSAFE.test(file)) continue;
  let target = safeName(file);
  let n = 2;
  while (existsSync(join(dir, target)) && target !== file) {
    target = safeName(file).replace(/(\.[a-z0-9]+)$/, `_${n++}$1`);
  }
  renameSync(join(dir, file), join(dir, target));
  renamed.push(`${file} -> ${target}`);
}

const files = readdirSync(dir).filter((f) => AUDIO.test(f)).sort();
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(files, null, 2));
if (renamed.length) console.log(`sanitised ${renamed.length}:\n  ${renamed.join('\n  ')}`);
console.log(`manifest: ${files.length} clips`);
