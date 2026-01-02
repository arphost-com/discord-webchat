// gateway/src/db.js
// MariaDB helpers (mysql2/promise). Kept intentionally small + stable for modularity.

import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let _pool;

/**
 * Create (or reuse) a MySQL connection pool.
 * @param {object} cfg - config object with cfg.db.{host,port,user,pass,name}
 */
export function getPool(cfg) {
  if (_pool) return _pool;
  if (!cfg?.db) {
    throw new Error('getPool: missing cfg.db (host/port/user/pass/name)');
  }
  _pool = mysql.createPool({
    host: cfg.db.host,
    port: cfg.db.port,
    user: cfg.db.user,
    password: cfg.db.pass,
    database: cfg.db.name,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
  });
  return _pool;
}

export async function initSchema(pool) {
  if (!pool?.query && !pool?.execute) throw new Error('initSchema: pool is not initialized');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  // Split on semicolon followed by newline (schema.sql is controlled in-repo).
  for (const stmt of sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)) {
    if (pool.query) await pool.query(stmt);
    else await pool.execute(stmt);
  }
}

/**
 * Back-compat: older code imported initDb().
 * This now accepts either a pool OR cfg, and returns the pool used.
 */
export async function initDb(cfgOrPool, logger) {
  const pool =
    (cfgOrPool?.query || cfgOrPool?.execute)
      ? cfgOrPool
      : getPool(cfgOrPool);

  await initSchema(pool);
  logger?.info?.('[DB] schema ready');
  return pool;
}

/**
 * Insert or update a session record.
 * Uses camelCase keys in input, maps to snake_case DB cols.
 */
export async function upsertSession(pool, sess) {
  const sql = `
INSERT INTO sessions
  (session_uuid, mode, visitor_name, visitor_email, entry_url, referrer, client_id, discord_channel_id, discord_thread_id, visitor_id, last_page_url, last_seen_at, geo_country, geo_region, geo_city, geo_lat, geo_lng, geo_timezone)
VALUES
  (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  mode=VALUES(mode),
  visitor_name=VALUES(visitor_name),
  visitor_email=VALUES(visitor_email),
  entry_url=VALUES(entry_url),
  referrer=VALUES(referrer),
  client_id=VALUES(client_id),
  discord_channel_id=VALUES(discord_channel_id),
  discord_thread_id=VALUES(discord_thread_id),
  visitor_id=VALUES(visitor_id),
  last_page_url=VALUES(last_page_url),
  last_seen_at=VALUES(last_seen_at),
  geo_country=VALUES(geo_country),
  geo_region=VALUES(geo_region),
  geo_city=VALUES(geo_city),
  geo_lat=VALUES(geo_lat),
  geo_lng=VALUES(geo_lng),
  geo_timezone=VALUES(geo_timezone)
`;
  const params = [
    sess.sessionUuid,
    sess.mode || 'guest',
    sess.visitorName || null,
    sess.visitorEmail || null,
    sess.entryUrl || null,
    sess.referrer || null,
    sess.clientId || null,
    sess.discordChannelId || null,
    sess.discordThreadId || null,
    sess.visitorId || null,
    sess.lastPageUrl || null,
    sess.lastSeenAt || null,
    sess.geoCountry || null,
    sess.geoRegion || null,
    sess.geoCity || null,
    sess.geoLat || null,
    sess.geoLng || null,
    sess.geoTimezone || null,
  ];
  await pool.execute(sql, params);
}

/** Fetch a session row by UUID */
export async function getSession(pool, sessionUuid) {
  const [rows] = await pool.execute(
    'SELECT * FROM sessions WHERE session_uuid=? LIMIT 1',
    [sessionUuid]
  );
  return rows?.[0] || null;
}

/**
 * Persist a chat message.
 * Accepts either `author` or `authorName` for compatibility with older code.
 */
export async function insertMessage(pool, { sessionUuid, direction, author, authorName, body }) {
  const a = author ?? authorName ?? null;
  await pool.execute(
    'INSERT INTO messages (session_uuid, direction, author, body) VALUES (?, ?, ?, ?)',
    [sessionUuid, direction, a, body]
  );
}

export async function updateSessionIdentity(pool, { sessionUuid, visitorName, visitorEmail }) {
  await pool.execute(
    `UPDATE sessions SET
      visitor_name = COALESCE(?, visitor_name),
      visitor_email = COALESCE(?, visitor_email)
     WHERE session_uuid = ?`,
    [visitorName || null, visitorEmail || null, sessionUuid]
  );
}

export async function getTranscript(pool, sessionUuid) {
  const [rows] = await pool.execute(
    'SELECT direction, author, body, created_at FROM messages WHERE session_uuid=? ORDER BY created_at ASC, id ASC',
    [sessionUuid]
  );
  return rows || [];
}

export async function insertPageView(pool, view) {
  const sql = `
INSERT INTO page_views
  (visitor_id, session_uuid, url, title, referrer, ip, user_agent, geo_country, geo_region, geo_city, geo_lat, geo_lng, geo_timezone)
VALUES
  (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
  const params = [
    view.visitorId || null,
    view.sessionUuid || null,
    view.url,
    view.title || null,
    view.referrer || null,
    view.ip || null,
    view.userAgent || null,
    view.geoCountry || null,
    view.geoRegion || null,
    view.geoCity || null,
    view.geoLat || null,
    view.geoLng || null,
    view.geoTimezone || null,
  ];
  await pool.execute(sql, params);
}

export async function updateSessionTracking(pool, sess) {
  const sql = `
UPDATE sessions SET
  visitor_id = COALESCE(visitor_id, ?),
  last_page_url = ?,
  last_seen_at = ?,
  geo_country = COALESCE(geo_country, ?),
  geo_region = COALESCE(geo_region, ?),
  geo_city = COALESCE(geo_city, ?),
  geo_lat = COALESCE(geo_lat, ?),
  geo_lng = COALESCE(geo_lng, ?),
  geo_timezone = COALESCE(geo_timezone, ?)
WHERE session_uuid = ?
`;
  const params = [
    sess.visitorId || null,
    sess.lastPageUrl || null,
    sess.lastSeenAt || null,
    sess.geoCountry || null,
    sess.geoRegion || null,
    sess.geoCity || null,
    sess.geoLat || null,
    sess.geoLng || null,
    sess.geoTimezone || null,
    sess.sessionUuid,
  ];
  await pool.execute(sql, params);
}

export async function markSessionTicketed(pool, sessionUuid) {
  await pool.execute(
    'UPDATE sessions SET ticket_escalated = 1 WHERE session_uuid = ?',
    [sessionUuid]
  );
}

export async function getAdminSessions(pool, limit = 100, sinceDays = 0) {
  const lim = Math.max(1, Math.min(Number(limit) || 100, 500));
  const days = Number(sinceDays || 0);
  let sql = `SELECT session_uuid, mode, client_id, visitor_name, visitor_email, visitor_id, entry_url, referrer,
            discord_thread_id, created_at, updated_at, last_page_url, last_seen_at,
            geo_country, geo_region, geo_city, geo_lat, geo_lng, geo_timezone
     FROM sessions`;
  const params = [];
  if (days > 0) {
    sql += ' WHERE COALESCE(last_seen_at, created_at) >= (NOW() - INTERVAL ? DAY)';
    params.push(days);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(lim);
  const [rows] = await pool.execute(sql, params);
  return rows || [];
}

export async function getSessionDetail(pool, sessionUuid) {
  const [rows] = await pool.execute(
    'SELECT * FROM sessions WHERE session_uuid=? LIMIT 1',
    [sessionUuid]
  );
  return rows?.[0] || null;
}

export async function getPageViewsForSession(pool, sessionUuid, limit = 200, sinceDays = 0) {
  const lim = Math.max(1, Math.min(Number(limit) || 200, 1000));
  const days = Number(sinceDays || 0);
  let sql = `SELECT * FROM page_views WHERE session_uuid=?`;
  const params = [sessionUuid];
  if (days > 0) {
    sql += ' AND created_at >= (NOW() - INTERVAL ? DAY)';
    params.push(days);
  }
  sql += ' ORDER BY created_at DESC, id DESC LIMIT ?';
  params.push(lim);
  const [rows] = await pool.execute(sql, params);
  return rows || [];
}

export async function getRecentPageViews(pool, limit = 200) {
  const lim = Math.max(1, Math.min(Number(limit) || 200, 1000));
  const [rows] = await pool.execute(
    `SELECT * FROM page_views
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [lim]
  );
  return rows || [];
}

export async function cleanupOldTracking(pool, days) {
  const d = Number(days || 0);
  if (!d || d < 1) return 0;
  const [res] = await pool.execute(
    'DELETE FROM page_views WHERE created_at < (NOW() - INTERVAL ? DAY)',
    [d]
  );
  return res?.affectedRows || 0;
}
