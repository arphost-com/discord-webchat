// gateway/src/index.js
import express from "express";
import http from "node:http";
import { cfg } from "./config.js";
import { logger } from "./logger.js";
import { initDb, cleanupOldTracking } from "./db.js";
import { setupRoutes } from "./routes.js";
import { attachWs } from "./ws.js";
import { startDiscord } from "./discord.js";
import { loadPlugins } from "./plugins/index.js";
import rateLimit from "express-rate-limit";

async function main() {
  logger.info("[BOOT] starting", {
    node: process.version,
    env: process.env.NODE_ENV || "development",
  });

  // initDb accepts either cfg or an existing pool; passing cfg keeps boot simple.
  const pool = await initDb(cfg, logger);

  const app = express();

  // Rate limiting middleware
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting to all requests
  app.use(limiter);

  const plugins = await loadPlugins({ cfg, logger, pool });
  app.locals.plugins = plugins;

  // Start Discord bridge first so we can pass it to routes
  const discord = await startDiscord({ cfg, logger, pool, plugins });

  const server = http.createServer(app);

  // Attach WebSocket and capture the wsHub for wiring to routes
  const { wsHub } = attachWs(server, { cfg, logger, pool, plugins });

  // Wire wsHub to Discord bridge so it can relay messages to browser
  if (discord?.setWsHub) {
    discord.setWsHub(wsHub);
  }

  // Pass wsHub and discord to routes so handlers can be wired up
  setupRoutes(app, { cfg, logger, pool, plugins, wsHub, discord });

  const port = Number(process.env.PORT || cfg.port || 3000);
  server.listen(port, () => {
    logger.info("Gateway listening", {
      port,
      publicBaseUrl: cfg.publicBaseUrl,
    });
  });
  const retentionDays = Number(process.env.TRACKING_RETENTION_DAYS || 0);
  if (retentionDays > 0) {
    try {
      const removed = await cleanupOldTracking(pool, retentionDays);
      logger.info("[TRACKING] cleanup complete", { removed, retentionDays });
    } catch (e) {
      logger.warn("[TRACKING] cleanup failed", {
        err: String(e?.message || e),
      });
    }
    setInterval(
      async () => {
        try {
          await cleanupOldTracking(pool, retentionDays);
        } catch (e) {
          logger.warn("[TRACKING] cleanup failed", {
            err: String(e?.message || e),
          });
        }
      },
      6 * 60 * 60 * 1000,
    );
  }
}

main().catch((err) => {
  logger.error("[BOOT] fatal", {
    err: err && err.stack ? err.stack : String(err),
  });
  process.exitCode = 1;
});
