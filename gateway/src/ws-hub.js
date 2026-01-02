// gateway/src/ws-hub.js
import crypto from 'crypto';

/**
 * WebSocket hub:
 * - Tracks sockets by sessionUuid
 * - Normalizes inbound messages
 * - Emits high-level events as OBJECTS (to match routes.js wiring)
 */
export function createWsHub(opts = {}) {
  const logger = opts.logger;

  const socketsBySession = new Map(); // sessionUuid -> Set<ws>
  let onHelloHandler = null;
  let onVisitorHandler = null;
  let onAgentHandler = null;

  function addSocket(sessionUuid, ws) {
    if (!sessionUuid) return;
    const set = socketsBySession.get(sessionUuid) || new Set();
    set.add(ws);
    socketsBySession.set(sessionUuid, set);
    ws.__sessionUuid = sessionUuid;
  }

  function removeSocket(ws) {
    const sessionUuid = ws.__sessionUuid;
    if (!sessionUuid) return;
    const set = socketsBySession.get(sessionUuid);
    if (set) {
      set.delete(ws);
      if (set.size === 0) socketsBySession.delete(sessionUuid);
    }
  }

  function safeSend(ws, obj) {
    try {
      if (ws.readyState === 1) ws.send(JSON.stringify(obj));
    } catch (e) {
      logger?.warn?.('[WS] send failed', { err: String(e?.stack || e) });
    }
  }

  function broadcastToSession(sessionUuid, obj) {
    const set = socketsBySession.get(sessionUuid);
    if (!set) return;
    for (const ws of set) safeSend(ws, obj);
  }

  function attachSession(ws, sessionUuid) {
    addSocket(sessionUuid, ws);
  }

  function register(ws) {
    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw || ''));
      } catch {
        return;
      }

      const type = msg.type || msg.t; // allow older clients
      if (!type) return;

      if (type === 'hello') {
        const sessionUuid = msg.sessionUuid || msg.session || crypto.randomUUID();
        attachSession(ws, sessionUuid);
        safeSend(ws, { type: 'hello_ack', sessionUuid });

        if (onHelloHandler) {
          try {
            await onHelloHandler({ ws, sessionUuid, payload: msg.payload || {} });
          } catch (e) {
            logger?.warn?.('[WS] onHello handler error', { err: String(e?.stack || e) });
          }
        }
        return;
      }

      if (type === 'visitor_message') {
        const sessionUuid = ws.__sessionUuid || msg.sessionUuid || msg.session;
        const text = msg.text || msg.message || '';
        if (!sessionUuid) return;

        if (onVisitorHandler) {
          try {
            await onVisitorHandler({ ws, sessionUuid, text });
          } catch (e) {
            logger?.warn?.('[WS] onVisitor handler error', { err: String(e?.stack || e) });
          }
        }
        return;
      }

      if (type === 'agent_message') {
        const sessionUuid = ws.__sessionUuid || msg.sessionUuid || msg.session;
        const text = msg.text || msg.message || '';
        if (!sessionUuid) return;

        if (onAgentHandler) {
          try {
            await onAgentHandler({ ws, sessionUuid, text });
          } catch (e) {
            logger?.warn?.('[WS] onAgent handler error', { err: String(e?.stack || e) });
          }
        }
        return;
      }
    });

    ws.on('close', () => removeSocket(ws));
    ws.on('error', () => removeSocket(ws));
  }

  return {
    register,
    onHello(fn) { onHelloHandler = fn; },
    onVisitorMessage(fn) { onVisitorHandler = fn; },
    onAgentMessage(fn) { onAgentHandler = fn; },
    broadcastToSession,
    attachSession,
  };
}
