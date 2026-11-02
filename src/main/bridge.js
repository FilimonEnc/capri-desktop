'use strict';

// Local HTTP bridge. Claude Code hooks POST their event JSON to /event,
// we hand it to the overlay. Bound to 127.0.0.1 only.
// Also serves the Capri Skills Marketplace and its API.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const skills = require('./skills');

const MAX_BODY = 512 * 1024;
const MARKETPLACE_DIR = path.resolve(__dirname, '../../marketplace');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(json),
    'access-control-allow-origin': '*',
  });
  res.end(json);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function createBridge({ port, onEvent, onDebug }) {
  const server = http.createServer(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, 'http://127.0.0.1');

    // Only allow /event from CLI hooks or localhost browsers
    if (url.pathname === '/event' && req.headers.origin && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.origin)) {
      return send(res, 403, { ok: false });
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, name: 'capri', pid: process.pid });
    }

    // Skills Marketplace Static Files
    if (url.pathname === '/marketplace' || url.pathname === '/marketplace/') {
      const file = path.join(MARKETPLACE_DIR, 'index.html');
      if (fs.existsSync(file)) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return fs.createReadStream(file).pipe(res);
      }
    }

    if (url.pathname.startsWith('/marketplace/')) {
      const sub = url.pathname.slice('/marketplace/'.length);
      const safeSub = path.normalize(sub).replace(/^(\.\.[/\\])+/, '');
      const file = path.join(MARKETPLACE_DIR, safeSub);
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        const ext = path.extname(file).toLowerCase();
        res.writeHead(200, { 'content-type': MIME_TYPES[ext] || 'application/octet-stream' });
        return fs.createReadStream(file).pipe(res);
      }
    }

    // Skills Marketplace API
    if (url.pathname === '/api/skills' && req.method === 'GET') {
      return send(res, 200, skills.list());
    }

    if (url.pathname === '/api/skills/install' && req.method === 'POST') {
      const body = await readJson(req).catch(() => ({}));
      return send(res, 200, skills.install(body.id));
    }

    if (url.pathname === '/api/skills/uninstall' && req.method === 'POST') {
      const body = await readJson(req).catch(() => ({}));
      return send(res, 200, skills.uninstall(body.id));
    }

    if (url.pathname === '/api/skills/toggle' && req.method === 'POST') {
      const body = await readJson(req).catch(() => ({}));
      return send(res, 200, skills.toggle(body.id, body.enabled));
    }

    if (url.pathname === '/api/skills/custom' && req.method === 'POST') {
      const body = await readJson(req).catch(() => ({}));
      return send(res, 200, skills.createCustom(body));
    }

    if (req.method === 'POST' && url.pathname === '/event') {
      try {
        const evt = await readJson(req);
        if (!evt || typeof evt !== 'object' || typeof evt.hook_event_name !== 'string') {
          return send(res, 400, { ok: false, error: 'missing hook_event_name' });
        }
        onEvent(evt);
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 400, { ok: false, error: err.message });
      }
    }

    if (onDebug && url.pathname.startsWith('/debug/')) {
      try {
        const body = req.method === 'POST' ? await readJson(req).catch(() => ({})) : {};
        return send(res, 200, await onDebug(url.pathname.slice(7), body));
      } catch (err) {
        return send(res, 500, { ok: false, error: err.message });
      }
    }

    send(res, 404, { ok: false });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[capri] port ${port} already in use, Claude events will not reach this instance`);
    } else {
      console.error('[capri] bridge error:', err.message);
    }
  });

  server.listen(port, '127.0.0.1', () => console.log(`[capri] listening on 127.0.0.1:${port}`));
  return server;
}

module.exports = { createBridge };
