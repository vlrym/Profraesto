import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
// Test-only static host: deliberately no SPA fallback or application API.
const root = path.resolve('dist');
const base = process.env.TEST_BASE_PATH || '/Profraesto/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.md': 'text/plain' };
http.createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!requested.startsWith(base)) { response.writeHead(404).end('Not found'); return; }
    const relative = requested.slice(base.length) || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || path.relative(root, file).split(path.sep).some(p => p.startsWith('.'))) {
      response.writeHead(403).end(); return;
    }
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(content);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Profraesto: http://127.0.0.1:${process.env.PORT || 4173}`));
