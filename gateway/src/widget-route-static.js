import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Patch: serve widget JS as a static text file instead of importing it as a Node module.
 * This prevents crashes like "ReferenceError: document is not defined" when the widget file
 * contains browser-only globals.
 */
export function setupWidgetRoute(app, logger) {
  app.get('/widget.js', (req, res) => {
    try {
      // Prefer widget.js (browser script). Fallback to widget-template.js if that's what you have.
      const p1 = path.join(__dirname, 'widget.js');
      const p2 = path.join(__dirname, 'widget-template.js');
      const p = fs.existsSync(p1) ? p1 : p2;

      const js = fs.readFileSync(p, 'utf8');
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(js);
    } catch (e) {
      logger?.error?.('[WIDGET] failed to serve /widget.js', e);
      res.status(500).send('// widget unavailable');
    }
  });
}
