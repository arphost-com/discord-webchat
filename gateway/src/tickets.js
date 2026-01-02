import { formatTranscript, sendChatEmail } from './email.js';
import { cfg } from './config.js';

function normalize(value) {
  return String(value || '').trim();
}

export function needsContactDetails(session) {
  const name = normalize(session?.visitor_name);
  const email = normalize(session?.visitor_email);
  return !name || !email;
}

export async function openTicket({ session, transcript, logger }) {
  const to = process.env.EMAIL_NOTIFY_TO || cfg?.email?.notifyTo || 'support@localhost';
  const subject = `Live Chat Escalation ${session.session_uuid}`;
  const message = formatTranscript(session, transcript);
  const res = await sendChatEmail({ cfg, logger, to, subject, text: message });
  if (res?.ok) return { ok: true, ticketId: null };
  return { ok: false, response: res };
}
