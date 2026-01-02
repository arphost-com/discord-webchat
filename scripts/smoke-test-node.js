#!/usr/bin/env node
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const mod = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {},
    };
    if (data) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = mod.request(opts, (res) => {
      let buf = '';
      res.on('data', (chunk) => { buf += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function main() {
  console.log(`Smoke test: ${baseUrl}`);

  const health = await request('GET', '/healthz');
  if (health.body.trim() !== 'ok') {
    throw new Error(`healthz failed: ${health.status} ${health.body}`);
  }
  console.log('healthz ok');

  const widget = await request('GET', '/widget.js');
  const head = String(widget.body || '').split('\n')[0];
  console.log('widget.js head:', head);

  const guest = await request('POST', '/api/session/start-guest', {
    visitorName: 'Smoke Test',
    entryUrl: 'smoke',
    visitorId: 'smoke-visitor'
  });
  if (!guest.body.includes('"sessionUuid"')) {
    throw new Error(`start-guest failed: ${guest.status} ${guest.body}`);
  }
  console.log('start-guest ok');

  const track = await request('POST', '/api/track/page', {
    visitorId: 'smoke-visitor',
    url: 'https://example.com/smoke',
    title: 'Smoke',
    referrer: ''
  });
  if (!track.body.includes('"ok":true')) {
    throw new Error(`track-page failed: ${track.status} ${track.body}`);
  }
  console.log('track-page ok');

  const secret = process.env.WIDGET_HMAC_SECRET || '';
  if (secret) {
    const payload = {
      clientId: 123,
      name: 'Smoke User',
      email: 'smoke@example.com',
      loggedIn: true,
      iat: Math.floor(Date.now() / 1000),
    };
    const payloadB64 = base64url(JSON.stringify(payload));
    const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    const token = `${payloadB64}.${sig}`;
    const encoded = token.replace(/\./g, '&period;');
    const encodedUrl = token.replace(/\./g, '%2E');

    const clientOk = await request('POST', '/api/session/start-client', { token });
    if (!clientOk.body.includes('"sessionUuid"')) {
      throw new Error(`start-client failed: ${clientOk.status} ${clientOk.body}`);
    }
    console.log('start-client ok');

    const clientEncoded = await request('POST', '/api/session/start-client', { token: encoded });
    if (!clientEncoded.body.includes('"sessionUuid"')) {
      throw new Error(`start-client encoded failed: ${clientEncoded.status} ${clientEncoded.body}`);
    }
    console.log('start-client encoded ok');

    const clientEncodedUrl = await request('POST', '/api/session/start-client', { token: encodedUrl });
    if (!clientEncodedUrl.body.includes('"sessionUuid"')) {
      throw new Error(`start-client encoded-url failed: ${clientEncodedUrl.status} ${clientEncodedUrl.body}`);
    }
    console.log('start-client encoded-url ok');
  } else {
    console.log('start-client skipped (set WIDGET_HMAC_SECRET to test)');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
