// One-time setup: authorizes the Google account that can see the OpenBooth folder and saves the
// refresh token to .env.local. Run: node scripts/get-refresh-token.mjs
// Uses drive.readonly (not drive.file): the session folders are made by the booth, not by this app,
// and drive.file only sees files the app created itself.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ENV_PATH = path.resolve('.env.local');
const PORT = 53682;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

function readEnv() {
  const out = {};
  if (!fs.existsSync(ENV_PATH)) return out;
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function writeEnv(key, value) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) text = text.replace(re, () => `${key}=${value}`);
  else text += (text === '' || text.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
  fs.writeFileSync(ENV_PATH, text);
}

const env = readEnv();
if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
  console.error('Fill GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first.');
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');
const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: env.GOOGLE_CLIENT_ID,
  redirect_uri: REDIRECT,
  response_type: 'code',
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPE,
  state,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT);
  if (url.pathname !== '/callback') { res.writeHead(404); return res.end(); }
  try {
    if (url.searchParams.get('state') !== state) throw new Error('State mismatch.');
    const code = url.searchParams.get('code');
    if (!code) throw new Error(url.searchParams.get('error') || 'No code returned.');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(`${tokens.error}: ${tokens.error_description ?? ''}`);
    if (!tokens.refresh_token) {
      throw new Error('No refresh token returned. Remove the app at myaccount.google.com/permissions and run again.');
    }
    if (!tokens.scope?.split(' ').includes(SCOPE)) {
      throw new Error(`Drive read access was not granted (got: ${tokens.scope}). Run again and tick the Drive checkbox.`);
    }
    writeEnv('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);
    console.log('Saved GOOGLE_REFRESH_TOKEN to .env.local. Setup complete.');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Done. You can close this tab and return to the terminal.</h2>');
  } catch (e) {
    console.error('Setup failed:', e.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Setup failed: ' + e.message);
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log('\nOpen this URL in your browser and approve access:\n');
  console.log(authUrl + '\n');
  console.log('(An "unverified app" warning is expected. Click Advanced, then continue.)');
});
