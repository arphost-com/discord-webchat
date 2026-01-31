# Developer Documentation

This guide covers the architecture, API, and development workflow for Discord WebChat.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   WordPress     │     │    Gateway      │     │    Discord      │
│   Plugin        │────▶│    (Node.js)    │────▶│    Bot          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       ▼
        │               ┌─────────────────┐
        └──────────────▶│    MariaDB      │
                        └─────────────────┘
```

### Components

1. **Gateway** (`gateway/`) - Node.js Express server
   - REST API for session management
   - WebSocket server for real-time messaging
   - Discord.js bot integration
   - Widget.js generation

2. **WordPress Plugin** (`wordpress-plugin/`) - PHP plugin
   - Admin settings page
   - Analytics dashboard
   - Widget injection

3. **Widget** (`gateway/src/widget.js`) - Embeddable chat widget
   - Self-contained ES5 JavaScript
   - Customizable via data attributes

## Project Structure

```
discord-webchat/
├── gateway/
│   ├── src/
│   │   ├── index.js          # Entry point
│   │   ├── routes.js         # API routes
│   │   ├── sessions.js       # Session management
│   │   ├── discord.js        # Discord bot logic
│   │   ├── db.js             # Database layer
│   │   ├── ws.js             # WebSocket server
│   │   ├── widget.js         # Widget source (ES5)
│   │   └── plugins/          # Plugin system
│   ├── Dockerfile
│   └── package.json
├── wordpress-plugin/
│   └── discord-webchat/
│       └── discord-webchat.php
├── scripts/
│   ├── e2e-test.sh           # End-to-end tests
│   └── smoke-test.sh         # Quick smoke tests
├── docker-compose.yml
└── .env.example
```

## API Reference

### Public Endpoints

#### `GET /healthz`
Health check endpoint.

**Response:** `ok`

#### `GET /widget.js`
Serves the embeddable chat widget.

#### `POST /api/session/start-guest`
Create a new guest chat session.

**Request:**
```json
{
  "visitorName": "John Doe",
  "visitorEmail": "john@example.com"
}
```

**Response:**
```json
{
  "ok": true,
  "sessionUuid": "abc123...",
  "publicBaseUrl": "https://your-gateway.com"
}
```

#### `POST /api/session/start-client`
Create a session for authenticated users (requires signed token).

**Request:**
```json
{
  "token": "signed-jwt-token"
}
```

#### `POST /api/session/resume`
Resume an existing session.

**Request:**
```json
{
  "sessionUuid": "abc123..."
}
```

#### `POST /api/track/page`
Track page views for analytics.

**Request:**
```json
{
  "sessionUuid": "abc123...",
  "url": "https://example.com/page",
  "title": "Page Title"
}
```

### Admin Endpoints

All admin endpoints require the `X-Admin-Key` header.

#### `GET /api/admin/sessions`
List sessions with optional filtering.

**Query Parameters:**
- `limit` - Number of results (default: 50)
- `range` - Time range: `day`, `week`, `month`, `year`, `all`

#### `GET /api/admin/session/:sessionUuid`
Get detailed session info including messages.

#### `GET /api/admin/pageviews`
List recent page views.

### WebSocket

Connect to `/ws?session=SESSION_UUID` for real-time messaging.

**Message Types:**
```javascript
// Send message
{ "type": "message", "text": "Hello" }

// Receive message
{ "type": "message", "text": "Hi!", "from": "agent" }

// Typing indicator
{ "type": "typing", "isTyping": true }
```

## Widget Integration

### Basic HTML Embed

```html
<script
  src="https://your-gateway.com/widget.js"
  defer
  data-mode="guest"
  data-base="https://your-gateway.com"
></script>
```

### Customization Options

| Attribute | Description | Default |
|-----------|-------------|---------|
| `data-mode` | `guest` or `client` | `guest` |
| `data-base` | Gateway base URL | Required |
| `data-position` | `left` or `right` | `right` |
| `data-label` | Button label text | `Chat` |
| `data-logo` | Logo URL | None |
| `data-accent` | Accent color | `#3b82f6` |
| `data-bg` | Background color | `#1e293b` |
| `data-panel-bg` | Panel background | `#0f172a` |
| `data-text` | Text color | `#ffffff` |
| `data-muted` | Muted text color | `#94a3b8` |
| `data-bubble-visitor` | Visitor bubble color | `#334155` |
| `data-bubble-agent` | Agent bubble color | `#3b82f6` |
| `data-error` | Error color | `#ef4444` |

## Development Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- MySQL/MariaDB (or use Docker)

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/arphost-com/discord-webchat.git
   cd discord-webchat
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. Start with Docker:
   ```bash
   docker compose up -d
   ```

4. Or run locally:
   ```bash
   cd gateway
   npm install
   npm start
   ```

### Running Tests

```bash
# End-to-end tests
./scripts/e2e-test.sh http://localhost:3000 YOUR_ADMIN_KEY

# Smoke tests
./scripts/smoke-test.sh
```

## Plugin Development

The gateway supports a plugin system for extending functionality.

### Creating a Plugin

Create a file in `gateway/src/plugins/`:

```javascript
// my-plugin.js
export default function myPlugin({ cfg, logger, pool }) {
  return {
    name: 'my-plugin',

    // Called when a new session starts
    onSessionStart: async (session) => {
      logger.info('New session', { uuid: session.sessionUuid });
    },

    // Called when a message is received
    onMessage: async (message, session) => {
      // Process message
    },

    // Called when a session ends
    onSessionEnd: async (session) => {
      // Cleanup
    }
  };
}
```

### Plugin Hooks

| Hook | Parameters | Description |
|------|------------|-------------|
| `onSessionStart` | `(session)` | New session created |
| `onMessage` | `(message, session)` | Message received |
| `onSessionEnd` | `(session)` | Session ended |
| `onTyping` | `(isTyping, session)` | Typing indicator |

## Database Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_uuid VARCHAR(64) UNIQUE NOT NULL,
  mode ENUM('guest', 'client') DEFAULT 'guest',
  client_id VARCHAR(64),
  visitor_name VARCHAR(255),
  visitor_email VARCHAR(255),
  visitor_id VARCHAR(64),
  discord_thread_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_uuid VARCHAR(64) NOT NULL,
  sender ENUM('visitor', 'agent', 'system') NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Page Views Table
```sql
CREATE TABLE page_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_uuid VARCHAR(64),
  visitor_id VARCHAR(64),
  url VARCHAR(2048),
  title VARCHAR(512),
  ip VARCHAR(45),
  geo_country VARCHAR(2),
  geo_region VARCHAR(64),
  geo_city VARCHAR(64),
  geo_lat DECIMAL(10, 7),
  geo_lng DECIMAL(10, 7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables

See `.env.example` for all available options.

### Required
- `PUBLIC_BASE_URL` - Public gateway URL
- `DISCORD_BOT_TOKEN` - Discord bot token
- `DISCORD_GUILD_ID` - Discord server ID
- `DISCORD_SUPPORT_CHANNEL_IDS` - Channel IDs for support

### Security
- `WIDGET_HMAC_SECRET` - Secret for signing client tokens
- `ADMIN_API_KEY` - API key for admin endpoints

### Database
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `./scripts/e2e-test.sh`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
