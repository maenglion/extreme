import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTerm, listTerms, openGlossary } from './db/glossary.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function sendJson(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

export function createApp({ dbPath } = {}) {
  return http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');

    if (request.method === 'GET' && url.pathname === '/api/terms') {
      const db = openGlossary(dbPath);
      try {
        return sendJson(response, 200, { terms: listTerms(db) });
      } finally {
        db.close();
      }
    }

    const termApiMatch = url.pathname.match(/^\/api\/terms\/(\d+)$/);
    if (request.method === 'GET' && termApiMatch) {
      const db = openGlossary(dbPath);
      try {
        const term = getTerm(db, Number(termApiMatch[1]));
        return term ? sendJson(response, 200, { term }) : sendJson(response, 404, { error: 'Term not found' });
      } finally {
        db.close();
      }
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return sendJson(response, 405, { error: 'Method not allowed' });
    }

    const requestedPath = url.pathname === '/' || /^\/terms\/\d+$/.test(url.pathname) ? '/index.html' : url.pathname;
    const filePath = path.resolve(publicDir, `.${requestedPath}`);
    if (!filePath.startsWith(`${publicDir}${path.sep}`)) return sendJson(response, 404, { error: 'Not found' });

    fs.readFile(filePath, (error, data) => {
      if (error) return sendJson(response, 404, { error: 'Not found' });
      response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
      response.end(request.method === 'HEAD' ? undefined : data);
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createApp().listen(port, '127.0.0.1', () => console.log(`Developer glossary: http://127.0.0.1:${port}`));
}
