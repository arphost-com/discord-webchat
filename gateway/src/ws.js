/**
 * WebSocket attach helper
 * - Creates a WS server bound to the existing HTTP server
 * - Registers each connection with the ws hub (ws-hub.js)
 *
 * NOTE: This file must be safe to import in Node (no 'window' or 'document').
 */
import { WebSocketServer } from 'ws';
import { createWsHub } from './ws-hub.js';

export function attachWs(server, opts = {}) {
  if (!server) throw new Error('attachWs(server) requires an http.Server instance');

  const wsHub = createWsHub(opts);

  const wss = new WebSocketServer({
    server,
    path: opts.path || '/ws',
  });

  wss.on('connection', (ws) => {
    try {
      if (opts.logger?.debug) opts.logger.debug('[WS] connection open');
    } catch (_) {}
    wsHub.register(ws);
  });

  return { wss, wsHub };
}

// Backwards-compat export (some older code imported createWsHub from ./ws.js)
export { createWsHub };
