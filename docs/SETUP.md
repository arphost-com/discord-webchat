# Discord WebChat Setup

This guide covers Discord bot setup, Docker deployment, WordPress integration, and HTML embeds.

## 1) Discord Bot Setup (required first)

Before deploying the gateway, you must create and configure a Discord bot:

### Create the Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section and click "Add Bot"
4. Copy the **Bot Token** (you'll need this for `DISCORD_BOT_TOKEN`)

### Enable Required Intents

In the Bot section, enable these **Privileged Gateway Intents**:
- **SERVER MEMBERS INTENT** - Required for member information
- **MESSAGE CONTENT INTENT** - Required to read message content

### Invite Bot to Your Server

1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot`
3. Select permissions:
   - Send Messages
   - Create Public Threads
   - Create Private Threads
   - Send Messages in Threads
   - Manage Threads
   - Read Message History
   - View Channels
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

### Get Channel and Guild IDs

1. Enable Developer Mode in Discord: User Settings → App Settings → Advanced → Developer Mode
2. Right-click your server name → "Copy Server ID" (this is `DISCORD_GUILD_ID`)
3. Right-click the support channel → "Copy Channel ID" (this is `DISCORD_SUPPORT_CHANNEL_IDS`)

## 2) Docker Deployment (recommended)

1) Copy env config:
   `cp .env.example .env`
2) Set required values in `.env`:
   - `DISCORD_BOT_TOKEN` - Bot token from step 1
   - `DISCORD_GUILD_ID` - Your server ID
   - `DISCORD_SUPPORT_CHANNEL_IDS` - Channel ID(s) where chat threads are created
   - `PUBLIC_BASE_URL` - Public URL of your gateway (e.g., `https://chat.yourdomain.com`)
   - `ADMIN_API_KEY` - Generate with `openssl rand -hex 32`
   - `WIDGET_HMAC_SECRET` - Generate with `openssl rand -hex 32`
   - `PORT` - Gateway port (default: 3000)
3) Start containers:
   `docker compose up -d --build`
4) Verify:
   `curl -sS http://localhost:3000/healthz`

## 3) Local Development (no Docker)

1) Install Node.js 20+ and MySQL 8.x / MariaDB 10.11+
2) Copy env config:
   `cp .env.example .env`
3) Create DB/user that match `DB_*` variables
4) Install deps:
   `cd gateway && npm install`
5) Run:
   `cd gateway && npm start`
6) Verify:
   `curl -sS http://localhost:3000/healthz`

## 4) WordPress Plugin

1) Copy plugin:
   - `wordpress-plugin/discord-webchat/` → `wp-content/plugins/discord-webchat/`
2) Activate plugin in WP Admin.
3) Configure:
   - Gateway Base URL
   - Admin API Key
   - Widget branding (label/logo/colors/position)
4) Verify:
   - Visit a public page and confirm widget appears.

## 5) HTML Embed

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

## 6) Email Ticket Escalation

Set in `.env`:
- `EMAIL_ENABLED=true`
- `EMAIL_NOTIFY_TO`
- `EMAIL_FROM`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`

Escalation behavior:
- `TICKET_ALWAYS=true`
- `TICKET_CONTACT_PROMPT_MINUTES=180`
- `TICKET_CONTACT_PROMPT_ONCE=false`

## 7) Verification Checklist

1) `curl -sS https://<host>/healthz`
2) `curl -sS https://<host>/widget.js?v=5 | head -n 1`
3) Open a page with the widget and send a message
4) Confirm Discord thread created
5) Confirm email ticket delivered (if email enabled)

## 8) Troubleshooting

### Discord Bot Issues

**"Used disallowed intents"**
- Enable SERVER MEMBERS INTENT and MESSAGE CONTENT INTENT in Discord Developer Portal → Bot section

**"Missing Access" or "channel_not_found"**
- Bot is not in the server or doesn't have access to the channel
- Re-invite the bot using the OAuth2 URL with correct permissions
- Verify `DISCORD_SUPPORT_CHANNEL_IDS` contains valid channel IDs the bot can access

**"Invalid token"**
- Regenerate the bot token in Discord Developer Portal and update `DISCORD_BOT_TOKEN`

**Messages sent but no Discord thread created**
- Check gateway logs: `docker compose logs gateway`
- Verify bot is online in your Discord server
- Confirm channel ID is correct and bot has thread creation permissions

### Widget Issues

**Widget not appearing**
- Check browser console for JavaScript errors
- Verify `PUBLIC_BASE_URL` is accessible from the browser
- If using Cloudflare, purge cache after deployment

**Widget appears but messages fail**
- Check CORS: `CORS_ALLOWED_ORIGINS` must include your website domain
- Verify WebSocket connection: browser DevTools → Network → WS

### Database Issues

**Sessions not persisting**
- Check database connection: verify `DB_*` environment variables
- Check gateway logs for connection errors

### Running Tests

Run the end-to-end test script to verify your setup:
```bash
./scripts/e2e-test.sh https://your-gateway.com YOUR_ADMIN_API_KEY
```
