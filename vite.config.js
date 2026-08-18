import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';

/**
 * Dev-only endpoint that lets an in-browser render write a PNG to disk.
 *
 * Used by /?card=1 to generate the social share image from the actual engine
 * rather than mocking one up in an image editor. Writes are confined to the
 * project's public/ directory and the middleware only exists in dev.
 */
function saveImagePlugin() {
  return {
    name: 'nexus-save-image',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const { path, data } = JSON.parse(body);
            const root = resolve(process.cwd(), 'public');
            const out = resolve(root, path);
            const rel = relative(root, out);
            if (rel.startsWith('..') || rel.startsWith(sep)) throw new Error('outside public/');
            mkdirSync(dirname(out), { recursive: true });
            writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
            console.log(`saved public/${rel}`);
            res.end(JSON.stringify({ ok: true, path: `public/${rel}` }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      });
    },
  };
}

export default { plugins: [saveImagePlugin()] };
