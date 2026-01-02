# Webchat Bridge

Webchat Bridge is a lightweight, open-source live chat gateway with a drop-in widget, Discord relay, and a WordPress plugin. It keeps the feature set small and platform-agnostic so future chat integrations (Slack, Telegram, etc.) can be added cleanly.

## What it includes

- Gateway API + WebSocket relay
- Embeddable widget (`/widget.js`)
- Discord bridge (threads per session)
- WordPress plugin (widget injection + admin dashboard)
- Session tracking + map view (GeoIP)
- Email-based ticket escalation

## Quick start (Docker)

```bash
cp .env.example .env
# edit .env with your Discord, DB, and email settings

docker compose up -d --build
curl -sS http://localhost:3000/healthz
```

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

## Ticket escalation (email)

Set these in `.env`:
- `EMAIL_ENABLED=true`
- `EMAIL_NOTIFY_TO`
- `EMAIL_FROM`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`

Ticket creation is controlled by:
- `TICKET_ALWAYS=true`
- `TICKET_CONTACT_PROMPT_MINUTES=180`
- `TICKET_CONTACT_PROMPT_ONCE=false`

## License

GPL-3.0. See `LICENSE`.
