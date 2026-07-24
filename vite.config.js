import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { createInterface } from 'readline';

/**
 * POST /__bw/publish-dump
 */
function publishDumpPlugin() {
  return {
    name: 'bw-publish-dump',
    configureServer(server) {
      server.middlewares.use('/__bw/publish-dump', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            const body = JSON.parse(raw || '{}');
            const id = String(body.id || `story-${Date.now()}`).replace(/[^\w.-]+/g, '_');
            const dir = join(process.cwd(), 'data/generated/publish-log', id);
            mkdirSync(dir, { recursive: true });

            const slim = {
              id: body.id,
              title: body.title,
              createdAt: body.createdAt || new Date().toISOString(),
              theme: body.theme,
              dialogues: body.dialogues,
              panels: (body.panels || []).map((p) => ({
                i: p.i,
                partySize: p.partySize,
                characterIds: p.characterIds,
                scene: p.scene,
                bubbles: p.bubbles,
              })),
            };
            writeFileSync(join(dir, 'meta.json'), JSON.stringify(slim, null, 2), 'utf8');

            for (const p of body.panels || []) {
              if (!p.composedJpeg) continue;
              const m = String(p.composedJpeg).match(/^data:image\/\w+;base64,(.+)$/);
              if (!m) continue;
              writeFileSync(
                join(dir, `panel-${String(p.i).padStart(2, '0')}.jpg`),
                Buffer.from(m[1], 'base64')
              );
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, dir: `data/generated/publish-log/${id}` }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
          }
        });
      });
    },
  };
}

/**
 * YOLOv8 animeface worker (keeps model warm)
 * https://github.com/Fuyucch1/yolov8_animeface
 */
function createAnimeFaceWorker() {
  const script = join(process.cwd(), 'scripts/animeface-worker.py');
  const child = spawn('python', ['-u', script], {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rl = createInterface({ input: child.stdout });
  let ready = false;
  const queue = [];

  child.stderr.on('data', (d) => {
    const s = d.toString().trim();
    if (s) console.log('[animeface]', s);
  });
  child.on('exit', (code) => {
    console.warn('[animeface] worker exit', code);
    ready = false;
    while (queue.length) {
      const { reject } = queue.shift();
      reject(new Error('animeface worker exited'));
    }
  });

  rl.on('line', (line) => {
    if (!ready) {
      if (line.trim() === 'READY') {
        ready = true;
        console.log('[animeface] worker ready');
      }
      return;
    }
    const job = queue.shift();
    if (!job) return;
    try {
      const parsed = JSON.parse(line);
      if (parsed && parsed.error) job.reject(new Error(parsed.error));
      else job.resolve(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      job.reject(e);
    }
  });

  const detect = (imagePath) =>
    new Promise((resolve, reject) => {
      const waitReady = (tries = 0) => {
        if (!ready) {
          if (tries > 600) {
            reject(new Error('animeface worker not ready'));
            return;
          }
          setTimeout(() => waitReady(tries + 1), 100);
          return;
        }
        queue.push({ resolve, reject });
        child.stdin.write(`${imagePath}\n`);
      };
      waitReady();
    });

  const stop = () => {
    try {
      child.stdin.write('quit\n');
    } catch {
      /* ignore */
    }
    child.kill();
  };

  return { detect, stop, child };
}

/**
 * POST /__bw/detect-faces  { image: dataURL }
 */
function animeFaceDetectPlugin() {
  let worker = null;

  return {
    name: 'bw-animeface-detect',
    configureServer(server) {
      worker = createAnimeFaceWorker();
      server.httpServer?.on('close', () => worker?.stop());

      server.middlewares.use('/__bw/detect-faces', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => {
          const tmpDir = join(process.cwd(), 'data/generated/.face-tmp');
          mkdirSync(tmpDir, { recursive: true });
          const tmp = join(
            tmpDir,
            `face-${Date.now()}-${randomBytes(4).toString('hex')}.jpg`
          );
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            const m = String(body.image || '').match(/^data:image\/\w+;base64,(.+)$/);
            if (!m) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: '需要 image dataURL' }));
              return;
            }
            writeFileSync(tmp, Buffer.from(m[1], 'base64'));
            if (!worker) worker = createAnimeFaceWorker();
            const faces = await worker.detect(tmp);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, faces, engine: 'yolov8_animeface' }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
          } finally {
            try {
              unlinkSync(tmp);
            } catch {
              /* ignore */
            }
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), publishDumpPlugin(), animeFaceDetectPlugin()],
});
