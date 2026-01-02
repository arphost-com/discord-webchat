# Webchat Bridge Setup

This guide covers Docker, local dev, WordPress, and HTML embeds.

## 1) Docker (recommended)

1) Copy env config:
   `cp .env.example .env`
2) Set required values in `.env`:
   - `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_SUPPORT_CHANNEL_IDS`
   - `PUBLIC_BASE_URL`
   - `ADMIN_API_KEY`
   - `WIDGET_HMAC_SECRET` (optional unless using signed client mode)
   - `EMAIL_*` + `SMTP_*` for email tickets
3) Start containers:
   `docker compose up -d --build`
4) Verify:
   `curl -sS http://localhost:3000/healthz`

## 2) Local dev (no Docker)

1) Install Node.js 18+ and MySQL 8.x.
2) Copy env config:
   `cp .env.example .env`
3) Create DB/user that match `DB_*`.
4) Install deps:
   `cd gateway && npm install`
5) Run:
   `cd gateway && npm start`
6) Verify:
   `curl -sS http://localhost:3000/healthz`

## 3) WordPress plugin

1) Copy plugin:
   - `wordpress-plugin/arphost-livechat/` → `wp-content/plugins/arphost-livechat/`
2) Activate plugin in WP Admin.
3) Configure:
   - Gateway Base URL
   - Admin API Key
   - Widget branding (label/logo/colors/position)
4) Verify:
   - Visit a public page and confirm widget appears.

## 4) HTML embed

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

## 5) Ticket escalation (email)

Set in `.env`:
- `EMAIL_ENABLED=true`
- `EMAIL_NOTIFY_TO`
- `EMAIL_FROM`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`

Escalation behavior:
- `TICKET_ALWAYS=true`
- `TICKET_CONTACT_PROMPT_MINUTES=180`
- `TICKET_CONTACT_PROMPT_ONCE=false`

## 6) Verification checklist

1) `curl -sS https://<host>/healthz`
2) `curl -sS https://<host>/widget.js?v=5 | head -n 1`
3) Open a page with the widget and send a message
4) Confirm Discord thread created
5) Confirm email ticket delivered
