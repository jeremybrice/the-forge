#!/usr/bin/env node
'use strict';

/**
 * Local HTTP server for Forge Shell's browser fallback mode.
 *
 * Serves the static app/ directory and a small file-system API
 * (mirroring the Tauri fs_commands.rs / config.rs commands) so the
 * dashboard also works in browsers/webviews that lack the File System
 * Access API (e.g. cmux's embedded browser).
 *
 * Binds to 127.0.0.1 only — this exposes read/write access to any path
 * the OS user can reach, the same trust boundary as the desktop app, and
 * must never be bound to a network-reachable interface.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4173;
const HOST = '127.0.0.1';
const APP_DIR = path.join(__dirname, 'app');

const CONFIG_DIR = process.platform === 'darwin'
  ? path.join(os.homedir(), 'Library', 'Application Support', 'forge-shell')
  : path.join(os.homedir(), '.config', 'forge-shell');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav'
};

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return { currentProject: null, recentProjects: [] };
  }
}

function saveConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function collectMdFiles(dir, relative) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const entryPath = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full, entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const stat = fs.statSync(full);
      results.push({ name: entry.name, path: entryPath, modified: Math.floor(stat.mtimeMs) });
    }
  }
  return results;
}

async function handleApi(req, res, pathname, query) {
  try {
    if (pathname === '/api/config' && req.method === 'GET') {
      return sendJSON(res, 200, loadConfig());
    }

    if (pathname === '/api/config/project' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      const target = body.path;
      if (!target || !fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
        return sendJSON(res, 400, { error: `Not a valid directory: ${target}` });
      }
      const config = loadConfig();
      config.currentProject = target;
      config.recentProjects = [target, ...(config.recentProjects || []).filter((p) => p !== target)].slice(0, 10);
      saveConfig(config);
      return sendJSON(res, 200, { ok: true, path: target });
    }

    if (pathname === '/api/fs/read' && req.method === 'GET') {
      const content = fs.readFileSync(query.get('path'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(content);
    }

    if (pathname === '/api/fs/write' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      fs.mkdirSync(path.dirname(body.path), { recursive: true });
      fs.writeFileSync(body.path, body.content ?? '');
      return sendJSON(res, 200, { ok: true });
    }

    if (pathname === '/api/fs/readdir' && req.method === 'GET') {
      const entries = fs.readdirSync(query.get('path'), { withFileTypes: true }).map((e) => ({
        name: e.name,
        kind: e.isDirectory() ? 'directory' : 'file'
      }));
      return sendJSON(res, 200, entries);
    }

    if (pathname === '/api/fs/list-md' && req.method === 'GET') {
      const dirPath = query.get('path') || '';
      const subdir = query.get('subdir') || '';
      const full = subdir ? path.join(dirPath, subdir) : dirPath;
      if (!fs.existsSync(full)) return sendJSON(res, 200, []);
      return sendJSON(res, 200, collectMdFiles(full, ''));
    }

    if (pathname === '/api/fs/meta' && req.method === 'GET') {
      const stat = fs.statSync(query.get('path'));
      return sendJSON(res, 200, { modified: Math.floor(stat.mtimeMs) });
    }

    if (pathname === '/api/fs/mkdir' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      fs.mkdirSync(body.path, { recursive: true });
      return sendJSON(res, 200, { ok: true });
    }

    if (pathname === '/api/fs/delete' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}');
      fs.unlinkSync(body.path);
      return sendJSON(res, 200, { ok: true });
    }

    return sendJSON(res, 404, { error: 'Not found' });
  } catch (err) {
    return sendJSON(res, 500, { error: err.message });
  }
}

function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = path.join(APP_DIR, relative);

  if (filePath !== APP_DIR && !filePath.startsWith(APP_DIR + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://${HOST}`);
  if (parsed.pathname.startsWith('/api/')) {
    handleApi(req, res, parsed.pathname, parsed.searchParams);
  } else {
    serveStatic(req, res, parsed.pathname);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Forge Shell server running at http://${HOST}:${PORT}`);
  console.log(`Config file: ${CONFIG_PATH}`);
});
