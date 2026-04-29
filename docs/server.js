/**
 * ═══════════════════════════════════════════════════════════════
 * STARLIGHT INN — Desktop Server
 * Just double-click "Start Starlight Inn.bat" to play!
 * ═══════════════════════════════════════════════════════════════
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer((req, res) => {
  // Security: only serve from ROOT directory
  let filePath = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  
  if (filePath.endsWith('/')) filePath += 'index.html';
  
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`<h1>🌟 Starlight Inn</h1><p>File not found: ${req.url}</p>`);
      } else {
        res.writeHead(500); res.end('Server error');
      }
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║                                               ║
║      ✨  STARLIGHT INN IS LIVE  ✨           ║
║                                               ║
║   🌐 http://localhost:${PORT}                     ║
║                                               ║
║   Your browser should open automatically!     ║
║                                               ║
║   Press Ctrl+C to stop the server.            ║
║                                               ║
╚═══════════════════════════════════════════════╝
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Starlight Inn server...');
  server.close(() => process.exit(0));
});
