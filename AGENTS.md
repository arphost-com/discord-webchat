# Repository Guidelines

## Project Structure & Module Organization
- `gateway/` contains the Node.js gateway (Discord bridge, API, WebSocket, widget delivery) with source in `gateway/src/`.
- `gateway/src/public/` holds the browser widget bundle served at `/widget.js`.
- `wordpress-plugin/` contains the WordPress plugin (widget injection + admin dashboard).
- `caddy/` and `docker-compose*.yml` provide reverse proxy and container orchestration examples.

## Build, Test, and Development Commands
- `docker compose up -d --build`: build and start gateway + DB containers using `docker-compose.yml`.
- `docker compose logs -f`: tail container logs (useful for Discord and WebSocket debugging).
- `npm start` (from `gateway/`): run the gateway directly with Node for local dev.
- `curl -sS https://<host>/healthz`: verify the gateway health endpoint is up.
- `./scripts/smoke-test.sh`: quick health/widget/session check (expects `BASE_URL`, uses `WIDGET_HMAC_SECRET` if set).

### Local Dev (without Docker)
- Prereqs: Node.js 18+ and MySQL 8.x on the host.
- Copy env config: `cp .env.example .env` and set `DISCORD_*`, `MYSQL_*`, `PUBLIC_BASE_URL`, `WIDGET_HMAC_SECRET` (if using signed client mode).
- Install deps: `cd gateway && npm install`.
- Run the gateway: `cd gateway && npm start` (defaults to port `3000` unless `PORT` is set).
- Validate: `curl -sS http://localhost:3000/healthz`.

### Deploy on Vanilla Debian (no containers)
- Install packages: `apt install nodejs npm mysql-server` (or use NodeSource for newer Node).
- Create a DB and user that match `MYSQL_*` in `.env`.
- Configure a reverse proxy (Caddy/Nginx) to forward `/` and `/ws` to `http://127.0.0.1:3000`.
- Run as a service (example: systemd) with `WorkingDirectory` set to `gateway/` and `EnvironmentFile` pointing to the repo `.env`.

### Docker Smoke Test
- Confirm containers are up: `docker compose ps`.
- Check gateway: `curl -sS http://localhost:3000/healthz` (expect `ok`).
- Check widget delivery: `curl -sS http://localhost:3000/widget.js | head -n 1`.
- When testing locally, use `data-base="http://localhost:3000"` in the embed so the widget points at the local gateway.
- Reset local DB between tests: `docker compose down` then `rm -rf data/mysql` (do not do this in production).

## Coding Style & Naming Conventions
- JavaScript uses ES modules and 2‑space indentation (`gateway/src/*.js`).
- PHP files in `wordpress-plugin/` use 4‑space indentation.
- Keep filenames and exported functions in lower_snake or lowerCamel style as already used (e.g., `discord_webchat_*`, `setupRoutes`).
- No formatter/linter is configured; match surrounding style when editing.

## Testing Guidelines
- No automated test suite is present. Validate changes with:
  - `docker compose up -d --build` then exercise `/health`, `/widget.js`, and `/ws`.
  - Manual WordPress embed check by loading a page that injects the widget.
- If you add tests, document the command(s) here and keep them runnable in CI.

## Commit & Pull Request Guidelines
- Recent commits follow a conventional pattern like `fix: <summary>`; keep that style unless instructed otherwise.
- PRs should include: clear description, linked issue (if any), and test/verification notes.
- Add screenshots or short GIFs for widget UI changes when feasible.

## Security & Configuration Tips
- Secrets live in `.env` (see `.env.example`); never commit tokens or `WIDGET_HMAC_SECRET`.
- When changing Discord or email settings, verify the gateway logs reflect successful connections.
- Admin dashboards require `ADMIN_API_KEY` and call the gateway Admin API with `X-Admin-Key`.
