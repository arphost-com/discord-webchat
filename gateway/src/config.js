function bool(v, d=false) {
  if (v === undefined || v === null || v === "") return d;
  const s = String(v).toLowerCase();
  return ["1","true","yes","y","on"].includes(s);
}

function csv(v) {
  if (!v) return [];
  return String(v).split(",").map(s => s.trim()).filter(Boolean);
}

export function loadConfig(env = process.env) {
  const cfg = {
    port: Number(env.PORT || 3000),
    publicBaseUrl: (env.PUBLIC_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, ""),
    corsAllowedOrigins: csv(env.CORS_ALLOWED_ORIGINS),
    widget: {
      chatLabel: env.WIDGET_CHAT_LABEL || "Live Help",
      logoUrl: env.WIDGET_LOGO_URL || "",
      theme: env.WIDGET_THEME || "dark",
      accent: env.WIDGET_ACCENT || "#3b82f6",
      bg: env.WIDGET_BG || "#0b0f14",
      panelBg: env.WIDGET_PANEL_BG || "#0f172a",
      text: env.WIDGET_TEXT || "#e5e7eb",
      muted: env.WIDGET_MUTED || "#94a3b8",
      bubbleVisitor: env.WIDGET_BUBBLE_VISITOR || "#1f2937",
      bubbleAgent: env.WIDGET_BUBBLE_AGENT || "#111827",
      error: env.WIDGET_ERROR || "#ef4444",
    },
    security: {
      widgetHmacSecret: env.WIDGET_HMAC_SECRET || ""
    },
    db: {
      host: env.DB_HOST || env.MYSQL_HOST || "mysql",
      port: Number(env.DB_PORT || env.MYSQL_PORT || 3306),
      name: env.DB_NAME || env.MYSQL_DATABASE || "webchat_bridge",
      user: env.DB_USER || env.MYSQL_USER || "webchat_bridge",
      pass: env.DB_PASS || env.MYSQL_PASSWORD || "password"
    },
    discord: {
      token: env.DISCORD_BOT_TOKEN || "",
      guildId: env.DISCORD_GUILD_ID || "",
      supportChannelIds: csv(env.DISCORD_SUPPORT_CHANNEL_IDS),
      threadType: (env.DISCORD_THREAD_TYPE || "public").toLowerCase() // public|private
    },
    email: {
      enabled: bool(env.EMAIL_ENABLED, false),
      provider: (env.EMAIL_PROVIDER || "smtp").toLowerCase(),
      notifyTo: env.EMAIL_NOTIFY_TO || "",
      from: env.EMAIL_FROM || "",
      smtp: {
        host: env.SMTP_HOST || "",
        port: Number(env.SMTP_PORT || 25),
        secure: bool(env.SMTP_SECURE, false),
        user: env.SMTP_USER || "",
        pass: env.SMTP_PASS || ""
      }
    },
    log: {
      debug: bool(env.DEBUG, false),
      level: env.LOG_LEVEL || "info"
    }
  };

  return cfg;
}

// Backwards compatibility: some files import { cfg } from './config.js'
export const cfg = loadConfig();
export default cfg;
