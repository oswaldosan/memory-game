import { promises as fs } from 'node:fs';
import path from 'node:path';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const MAX_BODY_BYTES = 60 * 1024 * 1024; // 60 MB total
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const EXT_FROM_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Payload demasiado grande (>60MB)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });

const decodeDataUrl = (dataUrl) => {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('dataUrl inválido');
  const mime = m[1].toLowerCase();
  if (!ALLOWED_MIME.has(mime)) throw new Error(`MIME no permitido: ${mime}`);
  return { mime, buf: Buffer.from(m[2], 'base64') };
};

const safeFilename = (idx, mime) => `${idx}.${EXT_FROM_MIME[mime]}`;

export default function gameAdminPlugin({ rootDir = process.cwd() } = {}) {
  return {
    name: 'game-admin-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__game-admin-status', (_req, res) => {
        json(res, 200, { ok: true, mode: 'dev' });
      });

      server.middlewares.use('/__create-game', async (req, res) => {
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'Solo POST' });
          return;
        }
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw);
          const { id, title, theme, logo, cards } = body || {};

          if (!id || !SLUG_RE.test(id)) {
            json(res, 400, { ok: false, error: 'id inválido (slug a-z 0-9 -, máx 40)' });
            return;
          }
          if (!title || typeof title !== 'string') {
            json(res, 400, { ok: false, error: 'title requerido' });
            return;
          }
          if (!Array.isArray(cards) || cards.length < 2) {
            json(res, 400, { ok: false, error: 'mínimo 2 cartas' });
            return;
          }
          if (cards.length > 24) {
            json(res, 400, { ok: false, error: 'máximo 24 cartas' });
            return;
          }

          const indexPath = path.join(rootDir, 'public', 'games', 'index.json');
          const indexRaw = await fs.readFile(indexPath, 'utf-8');
          const index = JSON.parse(indexRaw);
          if (Array.isArray(index.games) && index.games.some((g) => g.id === id)) {
            json(res, 409, { ok: false, error: `Ya existe un juego con id "${id}"` });
            return;
          }

          const imagesDir = path.join(rootDir, 'public', 'images', id);
          const logosDir = path.join(rootDir, 'public', 'logos', id);
          await fs.mkdir(imagesDir, { recursive: true });

          const cardPaths = [];
          for (let i = 0; i < cards.length; i++) {
            const { dataUrl } = cards[i] || {};
            const { mime, buf } = decodeDataUrl(dataUrl);
            const name = safeFilename(i + 1, mime);
            await fs.writeFile(path.join(imagesDir, name), buf);
            cardPaths.push(`/images/${id}/${name}`);
          }

          let logoUrl = null;
          if (logo && logo.dataUrl) {
            await fs.mkdir(logosDir, { recursive: true });
            const { mime, buf } = decodeDataUrl(logo.dataUrl);
            const name = `logo.${EXT_FROM_MIME[mime]}`;
            await fs.writeFile(path.join(logosDir, name), buf);
            logoUrl = `/logos/${id}/${name}`;
          }

          const entry = {
            id,
            title,
            logo: logoUrl || '/images/logo.png',
            cards: cardPaths,
          };
          if (theme && typeof theme === 'object') {
            entry.theme = theme;
          }

          index.games = Array.isArray(index.games) ? index.games : [];
          index.games.push(entry);
          await fs.writeFile(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf-8');

          json(res, 200, { ok: true, entry });
        } catch (err) {
          json(res, 400, { ok: false, error: err.message || String(err) });
        }
      });
    },
  };
}
