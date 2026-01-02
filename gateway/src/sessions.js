// gateway/src/sessions.js
import crypto from 'crypto';
import { getSession, upsertSession, insertMessage, updateSessionIdentity, getTranscript } from './db.js';

function pickSupportChannelId(seed) {
  const ids = String(process.env.DISCORD_SUPPORT_CHANNEL_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0];
  const key = String(seed || '');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash || Date.now()) % ids.length;
  return ids[idx];
}

function getThreadType() {
  const t = String(process.env.DISCORD_THREAD_TYPE || 'public').toLowerCase();
  return t === 'private' ? 'private' : 'public';
}

function threadName(sessionUuid, visitorName) {
  const safeName = String(visitorName || 'Guest').slice(0, 60).replace(/\s+/g, ' ').trim();
  return `Chat - ${safeName || 'Guest'} (${sessionUuid.slice(0, 6)})`;
}

export async function startGuestSession({ pool, discord, logger, body }) {
  const sessionUuid = crypto.randomBytes(18).toString('base64url');

  const sess = {
    sessionUuid,
    mode: 'guest',
    visitorName: body.visitorName || 'Guest',
    visitorEmail: body.visitorEmail || null,
    entryUrl: body.entryUrl || null,
    referrer: body.referrer || null,
    clientId: body.clientId || 'Guest',
    visitorId: body.visitorId || null,
    discordChannelId: pickSupportChannelId(body.visitorId || sessionUuid),
    discordThreadId: null,
  };

  await upsertSession(pool, sess);

  // Create the Discord thread immediately so the FIRST message never gets lost.
  if (discord && sess.discordChannelId) {
    try {
      const th = await discord.ensureThread({
        sessionUuid,
        channelId: String(sess.discordChannelId),
        threadType: getThreadType(),
        name: threadName(sessionUuid, sess.visitorName),
        visitorName: sess.visitorName,
      });

      if (th?.ok && th.threadId) {
        sess.discordThreadId = th.threadId;
        await upsertSession(pool, sess);

        await discord.postToThread({
          threadId: String(sess.discordThreadId),
          content:
            `**New Live Chat Session**\n` +
            `Session: \`${sessionUuid}\`\n` +
            `Visitor: **${sess.visitorName}**${sess.visitorEmail ? ` <${sess.visitorEmail}>` : ''}\n` +
            `Entry: ${sess.entryUrl || '(unknown)'}`,
        });
      } else {
        logger?.warn?.('[DISCORD] thread not created for new session', { sessionUuid, reason: th?.reason, err: th?.err });
      }
    } catch (e) {
      logger?.error?.('[DISCORD] failed to create thread for new session', { err: String(e?.stack || e) });
    }
  }

  return { sessionUuid };
}

export async function startClientSession({ pool, discord, logger, body, payload }) {
  const sessionUuid = crypto.randomBytes(18).toString('base64url');
  const loggedIn = Boolean(payload?.loggedIn) && payload?.clientId;
  const visitorName = payload?.name || body?.visitorName || 'Guest';
  const visitorEmail = payload?.email || body?.visitorEmail || null;
  const clientId = loggedIn ? String(payload.clientId) : null;

  const sess = {
    sessionUuid,
    mode: 'client',
    visitorName,
    visitorEmail,
    entryUrl: body.entryUrl || null,
    referrer: body.referrer || null,
    clientId,
    visitorId: body.visitorId || null,
    discordChannelId: pickSupportChannelId(payload?.clientId || sessionUuid),
    discordThreadId: null,
  };

  await upsertSession(pool, sess);

  if (discord && sess.discordChannelId) {
    try {
      const th = await discord.ensureThread({
        sessionUuid,
        channelId: String(sess.discordChannelId),
        threadType: getThreadType(),
        name: threadName(sessionUuid, sess.visitorName),
        visitorName: sess.visitorName,
      });

      if (th?.ok && th.threadId) {
        sess.discordThreadId = th.threadId;
        await upsertSession(pool, sess);

        await discord.postToThread({
          threadId: String(sess.discordThreadId),
          content:
            `**New Live Chat Session**\n` +
            `Session: \`${sessionUuid}\`\n` +
            `Authenticated: **${loggedIn ? 'Yes' : 'No'}**\n` +
            `Client ID: ${clientId ? `#${clientId}` : '(guest)'}\n` +
            `Visitor: **${sess.visitorName}**${sess.visitorEmail ? ` <${sess.visitorEmail}>` : ''}\n` +
            `Entry: ${sess.entryUrl || '(unknown)'}`,
        });
      } else {
        logger?.warn?.('[DISCORD] thread not created for client session', { sessionUuid, reason: th?.reason, err: th?.err });
      }
    } catch (e) {
      logger?.error?.('[DISCORD] failed to create thread for client session', { err: String(e?.stack || e) });
    }
  }

  return { sessionUuid };
}

export async function resumeSession({ pool, discord, logger, body }) {
  const sessionUuid = body.sessionUuid;
  if (!sessionUuid) throw new Error('missing sessionUuid');

  const sess = await getSession(pool, sessionUuid);
  if (!sess) throw new Error('unknown session');

  if (discord && sess.discord_channel_id && !sess.discord_thread_id) {
    try {
      const th = await discord.ensureThread({
        sessionUuid,
        channelId: String(sess.discord_channel_id),
        threadType: getThreadType(),
        name: threadName(sessionUuid, sess.visitor_name || 'Guest'),
        visitorName: sess.visitor_name || 'Guest',
      });

      if (th?.ok && th.threadId) {
        await upsertSession(pool, {
          sessionUuid,
          mode: sess.mode || 'guest',
          visitorName: sess.visitor_name,
          visitorEmail: sess.visitor_email,
          entryUrl: sess.entry_url,
          referrer: sess.referrer,
          clientId: sess.client_id || 'Guest',
          visitorId: body.visitorId || sess.visitor_id || null,
                discordChannelId: sess.discord_channel_id,
          discordThreadId: th.threadId,
        });
      } else {
        logger?.warn?.('[DISCORD] resume: thread not created', { sessionUuid, reason: th?.reason, err: th?.err });
      }
    } catch (e) {
      logger?.error?.('[DISCORD] failed ensure thread on resume', { err: String(e?.stack || e) });
    }
  }

  return { sessionUuid };
}

export async function handleHello({ ws, sessionUuid, payload, pool, discord, logger }) {
  try {
    ws.sessionUuid = sessionUuid;
    ws.send(JSON.stringify({ type: 'hello_ack', sessionUuid }));
  } catch {}

  // Persist identity if provided
  try {
    const existing = await getSession(pool, sessionUuid);
    if (!existing) return;

    await upsertSession(pool, {
      sessionUuid,
      mode: existing.mode || 'guest',
      visitorName: payload?.visitorName ?? existing.visitor_name,
      visitorEmail: payload?.visitorEmail ?? existing.visitor_email,
      entryUrl: payload?.entryUrl ?? existing.entry_url,
      referrer: payload?.referrer ?? existing.referrer,
      clientId: existing.client_id || 'Guest',
      visitorId: payload?.visitorId ?? existing.visitor_id,
      discordChannelId: existing.discord_channel_id || pickSupportChannelId(existing.visitor_id || sessionUuid),
      discordThreadId: existing.discord_thread_id || null,
    });
  } catch (e) {
    logger?.debug?.('[WS] hello persist failed', { err: String(e?.stack || e) });
  }
}

async function sendAgentMessage({ ws, pool, discord, session, text }) {
  await insertMessage(pool, { sessionUuid: session.session_uuid, direction: 'agent', authorName: 'System', body: text });
  try {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'agent_message', text, author: 'System' }));
  } catch {}

  try {
    let threadId = session.discord_thread_id;
    const channelId = session.discord_channel_id;
    if (discord && channelId && !threadId) {
      const th = await discord.ensureThread({
        sessionUuid: session.session_uuid,
        channelId: String(channelId),
        threadType: getThreadType(),
        name: threadName(session.session_uuid, session.visitor_name || 'Guest'),
        visitorName: session.visitor_name || 'Guest',
      });
      if (th?.ok && th.threadId) {
        threadId = th.threadId;
        await upsertSession(pool, {
          sessionUuid: session.session_uuid,
          mode: session.mode || 'guest',
          visitorName: session.visitor_name,
          visitorEmail: session.visitor_email,
          entryUrl: session.entry_url,
          referrer: session.referrer,
          clientId: session.client_id || 'Guest',
          discordChannelId: channelId,
          discordThreadId: threadId,
        });
      }
    }
    if (discord && threadId) {
      await discord.postToThread({ threadId: String(threadId), content: `**Agent:** ${text}` });
    }
  } catch (e) {
    logger?.warn?.('[DISCORD] agent post failed', { err: String(e?.message || e) });
  }
}

export async function handleVisitorMessage({ ws, sessionUuid, text, pool, discord, logger, ai }) {
  if (!sessionUuid) return;
  const msg = String(text || '').trim();
  if (!msg) return;

  try {
    const emailMatch = msg.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) {
      await updateSessionIdentity(pool, { sessionUuid, visitorEmail: emailMatch[0] });
    }
    const nameMatch = msg.match(/\bmy name is\s+([a-z ,.'-]{2,80})/i);
    if (nameMatch) {
      const name = nameMatch[1].trim().replace(/\s+/g, ' ');
      if (name) {
        await updateSessionIdentity(pool, { sessionUuid, visitorName: name });
      }
    }
    await insertMessage(pool, { sessionUuid, direction: 'visitor', authorName: null, body: msg });
  } catch (e) {
    logger?.error?.('[DB] insertMessage failed', { err: String(e?.stack || e) });
  }

  try {
    const sess = await getSession(pool, sessionUuid);
    if (!sess) return;

    let threadId = sess.discord_thread_id;
    const channelId = sess.discord_channel_id || pickSupportChannelId();

    if (discord && channelId && !threadId) {
      const th = await discord.ensureThread({
        sessionUuid,
        channelId: String(channelId),
        threadType: getThreadType(),
        name: threadName(sessionUuid, sess.visitor_name || 'Guest'),
        visitorName: sess.visitor_name || 'Guest',
      });

      if (th?.ok && th.threadId) {
        threadId = th.threadId;

        await upsertSession(pool, {
          sessionUuid,
          mode: sess.mode || 'guest',
          visitorName: sess.visitor_name,
          visitorEmail: sess.visitor_email,
          entryUrl: sess.entry_url,
          referrer: sess.referrer,
          clientId: sess.client_id || 'Guest',
          discordChannelId: channelId,
          discordThreadId: threadId,
        });
      } else {
        logger?.warn?.('[DISCORD] cannot create thread', { sessionUuid, reason: th?.reason, err: th?.err });
      }
    }

    if (discord && threadId) {
      await discord.postToThread({ threadId: String(threadId), content: `**Visitor:** ${msg}` });
    } else {
      logger?.warn?.('[DISCORD] cannot post (missing thread/channel)', { sessionUuid });
    }
  } catch (e) {
    logger?.error?.('[DISCORD] post visitor message failed', { err: String(e?.stack || e) });
  }
}
