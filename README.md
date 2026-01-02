# Discord WebChat

Discord Webchat allows you to embed livechat in your website and use discord thread as your client.

## What it includes

- Gateway API + WebSocket relay
- Embeddable widget (`/widget.js`)
- Discord bridge (threads per session)
- WordPress plugin (widget injection + admin dashboard)
- Session tracking + map view (GeoIP)

## Architecture

The system consists of three main components:

1.  **Gateway:** A Node.js application that handles WebSocket connections from web clients, manages chat sessions, and relays messages to and from chat backends (like Discord).
2.  **Web Widget:** A javascript client that can be embedded on any website. It connects to the gateway and provides the user-facing chat interface.
3.  **Chat-Backend Bridges:** These modules connect the gateway to various chat platforms. Currently, only Discord is implemented.

## Quick start (Docker)

```bash
cp .env.example .env
# edit .env with your Discord, DB, and email settings

docker compose up -d --build
curl -sS http://localhost:3000/healthz
```

## Configuration

All configuration is done via environment variables, loaded from the `.env` file.

### Server
- `PORT`: Gateway listen port (default: `3000`).
- `PUBLIC_BASE_URL`: Public URL browsers should use to connect to the gateway.

### Database
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`: Credentials for the MySQL/MariaDB database.

### Discord
- `DISCORD_BOT_TOKEN`: Your Discord bot token.
- `DISCORD_GUILD_ID`: The ID of your Discord server.
- `DISCORD_SUPPORT_CHANNEL_IDS`: Comma-separated list of channel IDs where new chat sessions will be posted.
- `DISCORD_THREAD_TYPE`: `public` or `private` threads for chat sessions.

### Widget Security

Generate a HMAC Secret with the following command.
```
openssl rand -hex 32
```
- `WIDGET_HMAC_SECRET`: A long, random string used for signing client tokens.
- `WIDGET_TOKEN_MAX_AGE_SECONDS`: Max age of tokens in seconds (default: `300`).


Generate a HMAC Secret with the following command.
```
openssl rand -hex 32
```
### Admin API
- `ADMIN_API_KEY`: A long, random string for authenticating with the admin API (used by the WordPress plugin).

### Tracking & GeoIP
- `TRACKING_RETENTION_DAYS`: How long to keep tracking data (0 = forever).
- `GEOIP_PROVIDER`: `ipapi` or `ipinfo`.
- `GEOIP_API_KEY`: API key for the GeoIP provider.

## HTML embed

```html
<script src="https://chat.yourdomain.com/widget.js?v=5"
  defer
  data-mode="guest"
  data-base="https://chat.yourdomain.com"
  data-label="Live Help"
  data-logo="https://example.com/logo.png"
  data-accent="#3b82f6"
  data-bg="#0b0f14"
  data-panel-bg="#0f172a"
  data-text="#e5e7eb"
  data-muted="#94a3b8"
  data-bubble-visitor="#1f2937"
  data-bubble-agent="#111827"
  data-error="#ef4444"></script>
```

## WordPress plugin

Copy `wordpress-plugin/arphost-livechat/` into `wp-content/plugins/` and activate **ARPHost LiveChat**. Configure the gateway base URL, admin API key, and widget branding in the plugin settings.

## API Endpoints

_(Coming soon)_

## Development

_(Coming soon)_

## License

GPL-3.0. See `LICENSE`.
