import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serves gateway/src/widget.js as a plain browser script.
// IMPORTANT: Do not `import` the widget in Node (it references `document`).
export function setupWidgetRoute(app, logger) {
  const widgetPath = path.join(__dirname, 'widget.js');
  const widgetStaticPath = path.join(__dirname, 'widget-route-static.js');

  app.get('/widget.js', (req, res) => {
    try {
      const js = fs.readFileSync(widgetStaticPath, 'utf-8');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      // Allow embedding from other origins (proxy can override too).
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      // Cache bust via ?v=
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(200).send(js);
    } catch (e) {
      logger && logger.error && logger.error('[WIDGET] failed to read widget.js', { err: String(e) });
      res.status(500).send('/* widget.js unavailable */');
    }
  });

  app.get('/widget-loader.js', (req, res) => {
    try {
      const js = fs.readFileSync(widgetPath, 'utf-8');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      // Allow embedding from other origins (proxy can override too).
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      // Cache bust via ?v=
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(200).send(js);
    } catch (e) {
      logger && logger.error && logger.error('[WIDGET] failed to read widget-loader.js', { err: String(e) });
      res.status(500).send('/* widget-loader.js unavailable */');
    }
  });

  app.get('/config.js', (req, res) => {
    try {
      const configPath = path.join(__dirname, 'config.js');
      const js = fs.readFileSync(configPath, 'utf-8');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(200).send(js);
    } catch (e) {
      logger && logger.error && logger.error('[WIDGET] failed to read config.js', { err: String(e) });
      res.status(500).send('/* config.js unavailable */');
    }
  });
}

