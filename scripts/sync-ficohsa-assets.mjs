/**
 * Escanea public/images/ficohsa (cartas) y public/logos/ficohsa (logo).
 * Genera public/games/ficohsa.assets.json para que el juego cargue assets sin listarlos a mano.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const CARDS_DIR = path.join(root, 'public', 'images', 'ficohsa');
const LOGO_DIR = path.join(root, 'public', 'logos', 'ficohsa');
const OUT = path.join(root, 'public', 'games', 'ficohsa.assets.json');

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);

const PREFERRED_LOGO_NAMES = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.webp'];

function publicUrl(basePath, filename) {
  const enc = encodeURIComponent(filename);
  return `${basePath}/${enc}`;
}

function listCardImages() {
  if (!fs.existsSync(CARDS_DIR)) {
    console.warn(`[sync-ficohsa] No existe ${CARDS_DIR}; cards vacío.`);
    return [];
  }

  return fs
    .readdirSync(CARDS_DIR)
    .filter((name) => {
      if (name.startsWith('.')) return false;
      const ext = path.extname(name).toLowerCase();
      return IMAGE_EXT.has(ext);
    })
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    )
    .map((name) => publicUrl('/images/ficohsa', name));
}

function resolveLogoUrl() {
  if (!fs.existsSync(LOGO_DIR)) {
    console.warn(`[sync-ficohsa] No existe ${LOGO_DIR}; se usará logo del registry.`);
    return null;
  }

  const files = fs.readdirSync(LOGO_DIR).filter((n) => !n.startsWith('.'));
  const byLower = new Map(files.map((f) => [f.toLowerCase(), f]));

  for (const preferred of PREFERRED_LOGO_NAMES) {
    const hit = byLower.get(preferred);
    if (hit) {
      return publicUrl('/logos/ficohsa', hit);
    }
  }

  const firstImage = files.find((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()));
  if (firstImage) {
    return publicUrl('/logos/ficohsa', firstImage);
  }

  return null;
}

const cards = listCardImages();
const logo = resolveLogoUrl();

const payload = {
  cards,
  ...(logo ? { logo } : {}),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(
  `[sync-ficohsa] ${OUT.replace(root + path.sep, '')}: ${cards.length} cartas${logo ? `, logo ${logo}` : ', sin logo en carpeta'}`
);
