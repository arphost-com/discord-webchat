import nodemailer from 'nodemailer';

export function formatTranscript(session, transcript) {
  const lines = [];
  lines.push(`Session: ${session.session_uuid}`);
  if (session.visitor_name) lines.push(`Visitor: ${session.visitor_name}`);
  if (session.visitor_email) lines.push(`Email: ${session.visitor_email}`);
  if (session.entry_url) lines.push(`Entry URL: ${session.entry_url}`);
  if (session.referrer) lines.push(`Referrer: ${session.referrer}`);
  lines.push('');
  for (const m of transcript) {
    const who = m.direction === 'visitor' ? 'Visitor' : (m.direction === 'agent' ? (m.author || 'Agent') : 'System');
    lines.push(`[${new Date(m.created_at).toISOString()}] ${who}: ${m.body}`);
  }
  return lines.join('\n');
}

export function buildTransport(cfg) {
  const smtp = cfg.email.smtp;
  const useAuth = !!(smtp.user && smtp.pass);
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: useAuth ? { user: smtp.user, pass: smtp.pass } : undefined
  });
}

export async function sendChatEmail({ cfg, logger, to, subject, text }) {
  if (!cfg.email.enabled) return { ok:false, skipped:true, reason:'EMAIL_ENABLED=false' };
  if (!cfg.email.smtp.host) return { ok:false, skipped:true, reason:'SMTP_HOST missing' };

  const transport = buildTransport(cfg);
  const from = cfg.email.from || 'Live Chat <no-reply@localhost>';
  const info = await transport.sendMail({ from, to, subject, text });
  logger.info('[EMAIL] sent', { to, messageId: info.messageId });
  return { ok:true, messageId: info.messageId };
}
