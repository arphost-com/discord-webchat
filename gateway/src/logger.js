/**
 * Simple structured logger.
 * - LOG_LEVEL: error|warn|info|debug|trace
 * - DEBUG=true enables debug logs even if LOG_LEVEL is higher
 */
const levels = ["error","warn","info","debug","trace"];

function now() { return new Date().toISOString(); }

function safe(obj) {
  try {
    return JSON.stringify(obj);
  } catch (_) {
    return "[unserializable]";
  }
}

export function makeLogger({ level="info", debug=false } = {}) {
  const idx = Math.max(0, levels.indexOf(level));
  const enabled = (name) => levels.indexOf(name) <= idx || (debug && name === "debug");

  function log(name, msg, meta) {
    if (!enabled(name)) return;
    const line = meta
      ? `${now()} [${name.toUpperCase()}] ${msg} ${safe(meta)}`
      : `${now()} [${name.toUpperCase()}] ${msg}`;
    // eslint-disable-next-line no-console
    console.log(line);
  }

  return {
    error: (m, meta)=>log("error", m, meta),
    warn:  (m, meta)=>log("warn",  m, meta),
    info:  (m, meta)=>log("info",  m, meta),
    debug: (m, meta)=>log("debug", m, meta),
    trace: (m, meta)=>log("trace", m, meta),
  };
}

// Convenience singleton used by most modules
const _level = process.env.LOG_LEVEL || "info";
const _debug = String(process.env.DEBUG || "").toLowerCase() === "true";
export const logger = makeLogger({ level: _level, debug: _debug });
