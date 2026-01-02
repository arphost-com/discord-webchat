import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';
import { insertMessage } from './db.js';

/**
 * Discord bridge
 * - Does NOT crash gateway on login failures
 * - Accepts multiple call signatures for backwards-compatibility:
 *   ensureThread({channelId, threadType, name})  // old
 *   ensureThread({channelId, threadType, visitorName, sessionUuid}) // newer
 *   postToThread(threadId, content) // old
 *   postToThread({threadId, content}) // newer
 */
export function createDiscordBridge({ cfg, logger, pool }) {
  const state = {
    client: null,
    ready: false,
    enabled: false,
    reason: null,
    wsHub: null  // Will be set later via setWsHub()
  };

  async function start() {
    const token = cfg?.discord?.token;
    if (!token || token === 'PUT_YOUR_TOKEN_HERE') {
      state.enabled = false;
      state.reason = 'DISCORD_BOT_TOKEN missing';
      logger?.warn?.('[DISCORD] disabled', { reason: state.reason });
      return state;
    }

    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
      partials: [Partials.Channel, Partials.Message]
    });

    client.once('clientReady', () => {
      state.ready = true;
      logger?.info?.('[DISCORD] ready', { user: client.user?.tag });
    });

    // Listen for Discord messages and relay to browser
    client.on('messageCreate', async (message) => {
      // Skip bot messages and DMs
      if (message.author.bot || !message.guild) return;

      // Check if message is in a thread we're tracking
      if (message.channel.isThread()) {
        try {
          // Find session by Discord thread ID
          const [rows] = await pool.execute(
            'SELECT session_uuid FROM sessions WHERE discord_thread_id = ?',
            [message.channel.id]
          );

          if (rows.length > 0) {
            const sessionUuid = rows[0].session_uuid;

            // Insert message into database
            await insertMessage(pool, {
              sessionUuid,
              direction: 'agent',
              authorName: message.author.username,
              body: message.content
            });

            // Send to browser via WebSocket
            if (state.wsHub) {
              state.wsHub.broadcastToSession(sessionUuid, {
                type: 'agent_message',
                text: message.content,
                author: message.author.username
              });
            }
          }
        } catch (e) {
          logger?.error?.('[DISCORD] failed to relay message', { err: String(e?.stack || e) });
        }
      }
    });

    try {
      await client.login(token);
      state.client = client;
      state.enabled = true;
      return state;
    } catch (e) {
      // IMPORTANT: do not crash the gateway; keep HTTP/widget running
      state.enabled = false;
      state.reason = e?.code || e?.name || 'login_failed';
      logger?.error?.('[DISCORD] disabled: login failed', { err: String(e?.message || e), code: state.reason });
      return state;
    }
  }

  function allowedChannel(id) {
    const allow = cfg?.discord?.supportChannelIds || [];
    return allow.length === 0 || allow.includes(String(id));
  }

  function buildThreadName({ name, visitorName, sessionUuid }) {
    const base = (name || visitorName || 'Guest').toString().trim().slice(0, 60) || 'Guest';
    const suffix = sessionUuid ? String(sessionUuid).slice(0, 8) : '';
    const full = suffix ? `Chat - ${base} - ${suffix}` : `Chat - ${base}`;
    // Discord max thread name length is 100
    return full.slice(0, 100);
  }

  async function ensureThread(opts) {
    const channelId = opts?.channelId;
    const threadType = opts?.threadType || 'public';
    const name = buildThreadName({ name: opts?.name, visitorName: opts?.visitorName, sessionUuid: opts?.sessionUuid });

    if (!state.enabled || !state.client) return { ok: false, reason: 'discord_disabled' };
    const ch = await state.client.channels.fetch(channelId).catch(() => null);
    if (!ch) return { ok: false, reason: 'channel_not_found' };
    if (!allowedChannel(channelId)) return { ok: false, reason: 'channel_not_allowed' };

    // If it's already a thread channel, just use it
    if (ch.type === ChannelType.PublicThread || ch.type === ChannelType.PrivateThread) {
      return { ok: true, threadId: ch.id, channelId: ch.parentId || channelId };
    }

    // Create thread under a text channel
    if (ch.type !== ChannelType.GuildText) {
      return { ok: false, reason: 'channel_not_text' };
    }

    const type = (threadType === 'private') ? ChannelType.PrivateThread : ChannelType.PublicThread;

    try {
      const thread = await ch.threads.create({
        name,
        autoArchiveDuration: 1440,
        type
      });
      return { ok: true, threadId: thread.id, channelId: ch.id, threadType };
    } catch (e) {
      // fallback: if private fails, retry public
      if (threadType === 'private') {
        logger?.warn?.('[DISCORD] private thread failed, falling back to public', { err: String(e?.message || e) });
        try {
          const thread = await ch.threads.create({
            name,
            autoArchiveDuration: 1440,
            type: ChannelType.PublicThread
          });
          return { ok: true, threadId: thread.id, channelId: ch.id, threadType: 'public', fallback: true };
        } catch (e2) {
          return { ok: false, reason: 'thread_create_failed', err: String(e2?.message || e2) };
        }
      }
      return { ok: false, reason: 'thread_create_failed', err: String(e?.message || e) };
    }
  }

  async function postToThread(arg1, arg2) {
    // Support both signatures: (threadId, content) and ({threadId, content})
    const threadId = (arg1 && typeof arg1 === 'object') ? arg1.threadId : arg1;
    const content  = (arg1 && typeof arg1 === 'object') ? arg1.content  : arg2;

    if (!state.enabled || !state.client) return { ok: false, reason: 'discord_disabled' };
    const th = await state.client.channels.fetch(String(threadId)).catch(() => null);
    if (!th) return { ok: false, reason: 'thread_not_found' };
    try {
      await th.send({ content: String(content ?? '') });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'send_failed', err: String(e?.message || e) };
    }
  }

  async function archiveThread(threadId) {
    if (!state.enabled || !state.client) return { ok: false, reason: 'discord_disabled' };
    const th = await state.client.channels.fetch(String(threadId)).catch(() => null);
    if (!th || !th.isThread?.()) return { ok: false, reason: 'thread_not_found' };
    try {
      await th.setArchived(true, 'Chat closed');
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'archive_failed', err: String(e?.message || e) };
    }
  }

  function setWsHub(wsHub) {
    state.wsHub = wsHub;
  }

  return {
    state,
    start,
    ensureThread,
    postToThread,
    archiveThread,
    setWsHub
  };
}

// Backwards-compatible helper: index.js expects startDiscord()
export async function startDiscord({ cfg, logger, pool }) {
  const bridge = createDiscordBridge({ cfg, logger, pool });
  await bridge.start();
  return bridge;
}
