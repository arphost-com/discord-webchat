import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXCLUDE = new Set([
  'index.js',
  'loader.js',
  // These are not runtime plugins and/or may reference browser globals:
  'config.js',
  'logger.js',
  'widget.js',
]);

export async function loadPlugins(ctx = {}) {
  const pluginsDir = __dirname;
  const files = fs.readdirSync(pluginsDir)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => !EXCLUDE.has(f))
    .sort();

  const loaded = [];

  for (const file of files) {
    try {
      const modUrl = pathToFileURL(path.join(pluginsDir, file)).href;
      const mod = await import(modUrl);

      // Convention: plugin exports `init(ctx)` (optional)
      if (typeof mod.init === 'function') {
        await mod.init(ctx);
        loaded.push(mod.name || file.replace(/\.js$/, ''));
      }
    } catch (err) {
      // Don't crash the gateway because a plugin is bad
      ctx?.logger?.warn?.('[PLUGINS] failed to load', { file, err: String(err?.message || err) });
    }
  }

  return loaded;
}
