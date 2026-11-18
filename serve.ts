// FROSTLINE — a tiny static server for local play-testing only.
// Serves game/ at http://localhost:8080 (open game/index.html there).
// Not part of the submission; the game itself needs no server at all.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'game');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

createServer(async (req, res) => {
  try {
    const path = req.url.split('?')[0];
    const file = join(root, path === '/' ? 'index.html' : decodeURIComponent(path));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(8080, () => console.log('FROSTLINE at http://localhost:8080'));
