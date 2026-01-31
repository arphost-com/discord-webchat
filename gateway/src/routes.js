// gateway/src/routes.js
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import {
  startGuestSession,
  startClientSession,
  resumeSession,
  handleVisitorMessage,
  handleHello,
} from "./sessions.js";
import {
  insertPageView,
  updateSessionTracking,
  getAdminSessions,
  getSessionDetail,
  getTranscript,
  getPageViewsForSession,
  getRecentPageViews,
  insertMessage,
  getSession,
} from "./db.js";
import { lookupGeo } from "./geoip.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache widget.js content in memory at module load time to avoid
// synchronous file I/O on every request
let widgetJsCache = null;
let widgetJsCacheError = null;
let widgetJsPrelude = "";

try {
  const widgetPath = path.join(__dirname, "public", "widget.js");
  if (fs.existsSync(widgetPath)) {
    widgetJsCache = fs.readFileSync(widgetPath, "utf-8");
  } else {
    widgetJsCacheError = "widget.js not found";
  }
} catch (e) {
  widgetJsCacheError = e?.message || "widget.js read error";
}

function buildWidgetPrelude() {
  const themeVars = {
    WIDGET_CHAT_LABEL: process.env.WIDGET_CHAT_LABEL,
    WIDGET_LOGO_URL: process.env.WIDGET_LOGO_URL,
    WIDGET_POSITION: process.env.WIDGET_POSITION,
    WIDGET_ACCENT: process.env.WIDGET_ACCENT,
    WIDGET_BG: process.env.WIDGET_BG,
    WIDGET_PANEL_BG: process.env.WIDGET_PANEL_BG,
    WIDGET_TEXT: process.env.WIDGET_TEXT,
    WIDGET_MUTED: process.env.WIDGET_MUTED,
    WIDGET_BUBBLE_VISITOR: process.env.WIDGET_BUBBLE_VISITOR,
    WIDGET_BUBBLE_AGENT: process.env.WIDGET_BUBBLE_AGENT,
    WIDGET_ERROR: process.env.WIDGET_ERROR,
  };

  const lines = [];
  const baseUrl = process.env.PUBLIC_BASE_URL || "";
  if (baseUrl) {
    lines.push(
      `window.DWC_BASE_URL = window.DWC_BASE_URL || ${JSON.stringify(baseUrl)};`,
    );
  }

  for (const [key, value] of Object.entries(themeVars)) {
    if (!value) continue;
    lines.push(`window.${key} = window.${key} || ${JSON.stringify(value)};`);
  }

  return lines.length ? `${lines.join("\n")}\n` : "";
}

widgetJsPrelude = buildWidgetPrelude();

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeJson(res, status, body) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function base64urlToBuffer(input) {
  const str = String(input || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str + pad, "base64");
}

function normalizeWidgetToken(token) {
  let t = String(token || "").trim();
  if (!t) return "";
  // Remove surrounding quotes
  t = t.replace(/^['"]+|['"]+$/g, "");
  // Replace various encoded periods with regular periods
  t = t.replace(/&amp;period;|&period;/gi, ".");
  t = t.replace(/&amp;#0*46;?|&#0*46;?/gi, ".");
  t = t.replace(/&amp;#x0*2e;?|&#x0*2e;?/gi, ".");
  t = t.replace(/%2e/gi, ".");
  // Split by whitespace and take first part (in case of malicious tokens)
  t = t.split(/\s+/)[0] || "";
  // Additional security: limit token length to prevent abuse
  t = t.substring(0, 2048);
  return t.trim();
}

function summarizeToken(token) {
  const t = String(token || "");
  const dots = (t.match(/\./g) || []).length;
  return {
    len: t.length,
    dots,
    hasAmpPeriod: /&amp;period;|&period;/i.test(t),
    hasNumericEntity: /&#0*46;?|&#x0*2e;?/i.test(t),
    hasUrlEncoded: /%2e/i.test(t),
  };
}

function verifyWidgetToken(token, secret, maxAgeSeconds) {
  const normalized = normalizeWidgetToken(token);
  if (!normalized) throw new Error("missing_token");
  if (!secret) throw new Error("missing_secret");
  const parts = normalized.split(".");
  if (parts.length !== 2) throw new Error("invalid_format");
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest();
  const providedSig = base64urlToBuffer(sigB64);
  if (
    expectedSig.length !== providedSig.length ||
    !crypto.timingSafeEqual(expectedSig, providedSig)
  ) {
    throw new Error("invalid_signature");
  }
  const payloadRaw = base64urlToBuffer(payloadB64).toString("utf-8");
  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    throw new Error("invalid_payload");
  }
  const now = Math.floor(Date.now() / 1000);
  const iat = Number(payload?.iat || 0);
  if (!iat || Number.isNaN(iat)) throw new Error("missing_iat");
  if (iat > now + 60) throw new Error("iat_in_future");
  if (now - iat > maxAgeSeconds) throw new Error("token_expired");
  return payload;
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === "::1") return true;
  if (ip.startsWith("::ffff:")) ip = ip.replace(/^::ffff:/, "");
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.2") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.")
  )
    return true;
  return false;
}

function getClientIp(req) {
  const candidates = [];
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    xff.split(",").forEach((part) => {
      const ip = part.trim();
      if (ip) candidates.push(ip);
    });
  }
  const xri = req.headers["x-real-ip"];
  if (typeof xri === "string" && xri.trim()) candidates.push(xri.trim());
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) candidates.push(cf.trim());
  const tci = req.headers["true-client-ip"];
  if (typeof tci === "string" && tci.trim()) candidates.push(tci.trim());

  for (const ipRaw of candidates) {
    const ip = ipRaw.replace(/^::ffff:/, "");
    if (!isPrivateIp(ip)) return ip;
  }
  if (candidates.length > 0) return candidates[0].replace(/^::ffff:/, "");
  return String(req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
}

function parseRangeDays(value) {
  const v = String(value || "").toLowerCase();
  if (!v || v === "all") return 0;
  if (v === "day") return 1;
  if (v === "week") return 7;
  if (v === "month") return 30;
  if (v === "year") return 365;
  const n = Number(v);
  if (!Number.isNaN(n) && n > 0) return Math.min(Math.floor(n), 3650);
  return 0;
}

export function setupRoutes(app, deps = {}) {
  const { pool, wsHub, discord, logger } = deps;

  const publicBaseUrl = process.env.PUBLIC_BASE_URL || "";
  const allowedOrigins = parseCsv(process.env.CORS_ALLOWED_ORIGINS);
  const widgetSecret = process.env.WIDGET_HMAC_SECRET || "";
  const tokenMaxAgeSeconds = Number(
    process.env.WIDGET_TOKEN_MAX_AGE_SECONDS || 300,
  );
  const adminApiKey = process.env.ADMIN_API_KEY || "";

  // NOTE: CSRF middleware removed.
  //
  // This gateway's public widget endpoints are not cookie-authenticated, and the
  // admin endpoints use an explicit `X-Admin-Key` header. Enabling csurf here
  // causes breakage (and requires cookie-parser/session plumbing).
  //
  // If you later switch to cookie-based auth, re-introduce CSRF with proper
  // cookie/session middleware and a token bootstrap flow for the widget.

  const corsMiddleware = cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"), false);
    },
    credentials: false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "X-Widget-Token",
      "X-Widget-Signature",
      "X-Widget-Timestamp",
      "X-CSRF-Token",
    ],
    maxAge: 600,
  });

  app.use("/api", corsMiddleware);
  app.options("/api/*", corsMiddleware);

  // CSRF intentionally not applied here (see note above).

  // Serve widget from memory cache (loaded at module init time)
  app.get("/widget.js", (req, res) => {
    if (widgetJsCacheError) {
      logger?.error?.("[HTTP] widget.js cache error", {
        err: widgetJsCacheError,
      });
      return res.status(404).type("text/plain").send(widgetJsCacheError);
    }
    res.setHeader("content-type", "application/javascript; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=300");
    res.status(200).send(widgetJsPrelude + widgetJsCache);
  });

  app.get("/healthz", (req, res) =>
    res.status(200).type("text/plain").send("ok"),
  );

  app.post(
    "/api/session/start-guest",
    express.json({ limit: "64kb" }),
    async (req, res) => {
      try {
        const out = await startGuestSession({
          pool,
          discord,
          logger,
          body: req.body || {},
        });
        safeJson(res, 200, { ok: true, ...out, publicBaseUrl });
      } catch (e) {
        logger?.error?.("[HTTP] start-guest failed", {
          err: String(e?.stack || e),
        });
        safeJson(res, 500, { ok: false, error: "start_failed" });
      }
    },
  );

  app.post(
    "/api/session/start-client",
    express.json({ limit: "64kb" }),
    async (req, res) => {
      try {
        const payload = verifyWidgetToken(
          req.body?.token,
          widgetSecret,
          tokenMaxAgeSeconds,
        );
        const out = await startClientSession({
          pool,
          discord,
          logger,
          body: req.body || {},
          payload,
        });
        safeJson(res, 200, { ok: true, ...out, publicBaseUrl });
      } catch (e) {
        logger?.warn?.("[HTTP] start-client failed", {
          err: String(e?.message || e),
          token: summarizeToken(req.body?.token),
        });
        safeJson(res, 401, { ok: false, error: "invalid_token" });
      }
    },
  );

  app.post(
    "/api/session/resume",
    express.json({ limit: "64kb" }),
    async (req, res) => {
      try {
        const out = await resumeSession({
          pool,
          discord,
          logger,
          body: req.body || {},
        });
        safeJson(res, 200, { ok: true, ...out, publicBaseUrl });
      } catch (e) {
        logger?.error?.("[HTTP] resume failed", { err: String(e?.stack || e) });
        safeJson(res, 500, { ok: false, error: "resume_failed" });
      }
    },
  );

  app.post(
    "/api/track/page",
    express.json({ limit: "64kb" }),
    async (req, res) => {
      try {
        const body = req.body || {};
        const url = String(body.url || "").slice(0, 2048);
        if (!url)
          return safeJson(res, 400, { ok: false, error: "missing_url" });

        const view = {
          visitorId: String(body.visitorId || "").slice(0, 64) || null,
          sessionUuid: String(body.sessionUuid || "").slice(0, 64) || null,
          url,
          title: body.title ? String(body.title).slice(0, 512) : null,
          referrer: body.referrer ? String(body.referrer).slice(0, 2048) : null,
          ip: getClientIp(req),
          userAgent:
            String(req.headers["user-agent"] || "").slice(0, 512) || null,
        };

        const geo = await lookupGeo(view.ip);
        if (geo) {
          view.geoCountry = geo.country || null;
          view.geoRegion = geo.region || null;
          view.geoCity = geo.city || null;
          view.geoLat = geo.lat || null;
          view.geoLng = geo.lng || null;
          view.geoTimezone = geo.timezone || null;
        }

        await insertPageView(pool, view);

        if (view.sessionUuid) {
          await updateSessionTracking(pool, {
            sessionUuid: view.sessionUuid,
            visitorId: view.visitorId,
            lastPageUrl: view.url,
            lastSeenAt: new Date(),
            geoCountry: view.geoCountry,
            geoRegion: view.geoRegion,
            geoCity: view.geoCity,
            geoLat: view.geoLat,
            geoLng: view.geoLng,
            geoTimezone: view.geoTimezone,
          });
        }

        safeJson(res, 200, { ok: true });
      } catch (e) {
        logger?.warn?.("[HTTP] track page failed", {
          err: String(e?.message || e),
        });
        safeJson(res, 500, { ok: false, error: "track_failed" });
      }
    },
  );

  app.post(
    "/api/session/close",
    express.json({ limit: "32kb" }),
    async (req, res) => {
      try {
        const sessionUuid = String(req.body?.sessionUuid || "").trim();
        if (!sessionUuid)
          return safeJson(res, 400, { ok: false, error: "missing_session" });
        const sess = await getSession(pool, sessionUuid);
        if (!sess) return safeJson(res, 404, { ok: false, error: "not_found" });
        await insertMessage(pool, {
          sessionUuid,
          direction: "system",
          authorName: "System",
          body: "Chat closed by visitor.",
        });
        if (discord?.archiveThread && sess.discord_thread_id) {
          await discord.archiveThread(String(sess.discord_thread_id));
        }
        safeJson(res, 200, { ok: true });
      } catch (e) {
        logger?.warn?.("[HTTP] close session failed", {
          err: String(e?.message || e),
        });
        safeJson(res, 500, { ok: false, error: "close_failed" });
      }
    },
  );

  // Wire WS -> DB + Discord
  if (wsHub?.onHello) {
    wsHub.onHello(async ({ ws, sessionUuid, payload }) => {
      await handleHello({ ws, sessionUuid, payload, pool, discord, logger });
    });
  }
  if (wsHub?.onVisitorMessage) {
    wsHub.onVisitorMessage(async ({ ws, sessionUuid, text }) => {
      await handleVisitorMessage({
        ws,
        sessionUuid,
        text,
        pool,
        discord,
        logger,
      });
    });
  }

  function requireAdmin(req, res, next) {
    if (!adminApiKey)
      return safeJson(res, 403, { ok: false, error: "admin_disabled" });
    const key = req.headers["x-admin-key"];
    if (key && key === adminApiKey) return next();
    return safeJson(res, 401, { ok: false, error: "unauthorized" });
  }

  app.get("/api/admin/sessions", requireAdmin, async (req, res) => {
    try {
      const limit = req.query?.limit;
      const range = req.query?.range;
      const days = parseRangeDays(range);
      const sessions = await getAdminSessions(pool, limit, days);
      safeJson(res, 200, { ok: true, sessions, range: range || "all" });
    } catch (e) {
      logger?.warn?.("[HTTP] admin sessions failed", {
        err: String(e?.message || e),
      });
      safeJson(res, 500, { ok: false, error: "admin_failed" });
    }
  });

  app.get("/api/admin/session/:sessionUuid", requireAdmin, async (req, res) => {
    try {
      const sessionUuid = req.params.sessionUuid;
      const session = await getSessionDetail(pool, sessionUuid);
      if (!session)
        return safeJson(res, 404, { ok: false, error: "not_found" });
      const messages = await getTranscript(pool, sessionUuid);
      const range = req.query?.range;
      const days = parseRangeDays(range);
      const pageViews = await getPageViewsForSession(
        pool,
        sessionUuid,
        req.query?.limit,
        days,
      );
      safeJson(res, 200, {
        ok: true,
        session,
        messages,
        pageViews,
        range: range || "all",
      });
    } catch (e) {
      logger?.warn?.("[HTTP] admin session failed", {
        err: String(e?.message || e),
      });
      safeJson(res, 500, { ok: false, error: "admin_failed" });
    }
  });

  app.get("/api/admin/pageviews", requireAdmin, async (req, res) => {
    try {
      const limit = req.query?.limit;
      const pageViews = await getRecentPageViews(pool, limit);
      safeJson(res, 200, { ok: true, pageViews });
    } catch (e) {
      logger?.warn?.("[HTTP] admin pageviews failed", {
        err: String(e?.message || e),
      });
      safeJson(res, 500, { ok: false, error: "admin_failed" });
    }
  });

  logger?.info?.("[ROUTES] ready", {
    allowedOriginsCount: allowedOrigins.length,
  });
}
