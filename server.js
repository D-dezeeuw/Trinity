/**
 * Trinity - Simple Static File Server
 * No external dependencies
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.glsl': 'text/plain',
  '.vert': 'text/plain',
  '.frag': 'text/plain',
};

const server = http.createServer((req, res) => {
  // Parse URL and remove query string
  let filePath = req.url.split('?')[0];

  // Default to index.html
  if (filePath === '/') {
    filePath = '/index.html';
  }

  // Resolve to absolute path
  const absolutePath = path.join(__dirname, filePath);

  // Security: prevent directory traversal
  if (!absolutePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Get file extension and MIME type
  const ext = path.extname(absolutePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  // Read and serve file
  fs.readFile(absolutePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found: ' + filePath);
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║           TRINITY Game Server          ║
  ╠════════════════════════════════════════╣
  ║  Running at: http://localhost:${PORT}     ║
  ║  Press Ctrl+C to stop                  ║
  ╚════════════════════════════════════════╝
  `);
});
