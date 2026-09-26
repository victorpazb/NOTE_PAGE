import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 5173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon' };
const publicFiles = new Set(['/index.html', '/styles.css', '/app.js', '/pricing.js', '/pix.js', '/vendor/qrcodegen.js', '/assets/logo-oficial.jpg']);

createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const target = pathname === '/' ? '/index.html' : pathname;
  if (!['GET', 'HEAD'].includes(req.method) || !publicFiles.has(target)) {
    res.writeHead(404).end('Não encontrado');
    return;
  }
  try {
    const body = await readFile(path.join(root, target));
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404).end('Não encontrado');
  }
}).listen(port, '127.0.0.1', () => console.log(`BSH Flats disponível em http://localhost:${port}`));
