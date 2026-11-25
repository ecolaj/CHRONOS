import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Explicit routes for core assets (handles direct, relative, and nested requests)
app.get(/(?:^|\/)js\/app\.js$/, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.type('application/javascript').sendFile(path.join(__dirname, 'js', 'app.js'));
});

app.get(/(?:^|\/)css\/styles\.css$/, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.type('text/css').sendFile(path.join(__dirname, 'css', 'styles.css'));
});

app.get(/(?:^|\/)sw\.js$/, (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Service-Worker-Allowed', '/').type('application/javascript').sendFile(path.join(__dirname, 'sw.js'));
});

app.get(/(?:^|\/)manifest\.json$/, (req, res) => {
  res.type('application/manifest+json').sendFile(path.join(__dirname, 'manifest.json'));
});

// Serve static files from root directory
app.use(express.static(__dirname, { maxAge: 0 }));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') {
    return res.status(404).type('text/plain').send('File not found');
  }
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
