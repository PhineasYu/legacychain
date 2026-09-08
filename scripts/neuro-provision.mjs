/**
 * One-time Neuro provisioning.
 *
 *   npm run neuro:provision
 *
 * Creates a Neuro account, enables it on the sandbox, creates a signing key,
 * applies for a Legal Identity, waits for approval, and prints the four
 * environment variables the application needs.
 *
 * Run this once. The application never creates accounts at runtime — a
 * serverless deployment would otherwise mint a new identity on every cold
 * start.
 *
 * Credentials come from the FIRSTBLOCK-ATHON sandbox page:
 *   https://blockathon.neuro-tech.io/sandbox.html#api-access
 * They are participant credentials, not secrets to commit.
 */

import { createHmac, randomBytes } from 'node:crypto';
import 'dotenv/config';

const HOST = process.env.NEURO_HOST || 'sandbox1.neuro-tech.io';
const API_KEY = process.env.NEURO_API_KEY || '';
const API_SECRET = process.env.NEURO_API_SECRET || '';
const APP_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const FIRST_NAME = process.env.NEURO_FIRST_NAME || 'Heritage';
const LAST_NAME = process.env.NEURO_LAST_NAME || 'Guardian';

if (!API_KEY || !API_SECRET) {
  console.error(`
Missing NEURO_API_KEY / NEURO_API_SECRET.

Open https://blockathon.neuro-tech.io/sandbox.html#api-access, copy the API key
and secret for your Sandbox, then run:

  NEURO_API_KEY=<key> NEURO_API_SECRET=<secret> npm run neuro:provision
`);
  process.exit(1);
}

const referer = APP_URL.endsWith('/') ? APP_URL : `${APP_URL}/`;
const nonce = () => randomBytes(32).toString('base64');
const sign = (secret, message) =>
  createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(Buffer.from(message, 'utf8'))
    .digest('base64');

async function post(path, body, jwt) {
  const res = await fetch(`https://${HOST}${path}`, {
    method: 'POST',
    headers: {
      Referer: referer,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, ok: res.ok, body: parsed };
}

function fail(step, result) {
  console.error(`\n${step} failed (HTTP ${result.status}):`);
  console.error(JSON.stringify(result.body, null, 2).slice(0, 800));
  process.exit(1);
}

const stamp = Date.now().toString(36);
const userName = process.env.NEURO_USERNAME || `legacychain_${stamp}`;
const eMail = process.env.NEURO_EMAIL || `legacychain+${stamp}@example.com`;
const password = randomBytes(18).toString('base64url');
const keyPassword = randomBytes(18).toString('base64url');
const keyId = 'legacychain-guardian-key';

console.log(`Neuron : ${HOST}`);
console.log(`Referer: ${referer}`);
console.log(`Account: ${userName}\n`);

// 1. Create the account
const n1 = nonce();
const created = await post('/Agent/Account/Create', {
  userName,
  eMail,
  password,
  apiKey: API_KEY,
  nonce: n1,
  signature: sign(API_SECRET, `${userName}:${HOST}:${eMail}:${password}:${API_KEY}:${n1}`),
  seconds: 3600,
  language: 'en',
});
if (!created.ok) fail('1. Account/Create', created);
console.log('1. Account created');

// 2. Enable it (sandbox helper; no auth required)
const enabled = await post('/hackathon-contract-approver/account/enable', { account: userName });
if (!enabled.ok) fail('2. account/enable', enabled);
console.log(`2. Account enabled (already_enabled=${enabled.body.already_enabled})`);

// 3. Sign in
const n2 = nonce();
const login = await post('/Agent/Account/Login', {
  userName,
  nonce: n2,
  signature: sign(password, `${userName}:${HOST}:${n2}`),
  seconds: 3600,
});
if (!login.ok || !login.body.jwt) fail('3. Account/Login', login);
const jwt = login.body.jwt;
console.log('3. Signed in');

// 4. Choose the strongest algorithm the Neuron marks as safe
const algorithms = await post('/Agent/Crypto/GetAlgorithms', {}, jwt);
if (!algorithms.ok) fail('4. Crypto/GetAlgorithms', algorithms);
const safe = (algorithms.body.Algorithms ?? [])
  .filter((a) => a.safe)
  .sort((a, b) => b.score - a.score);
if (safe.length === 0) fail('4. Crypto/GetAlgorithms', algorithms);
const algorithm = safe[0];
console.log(`4. Algorithm: ${algorithm.localName} (score ${algorithm.score}, pqc=${algorithm.pqc})`);

// 5. Create the signing key
const keyMessage = `${userName}:${HOST}:${algorithm.localName}:${algorithm.namespace}:${keyId}`;
const keySignature = sign(keyPassword, keyMessage);
const n3 = nonce();
const key = await post(
  '/Agent/Crypto/CreateKey',
  {
    localName: algorithm.localName,
    namespace: algorithm.namespace,
    id: keyId,
    nonce: n3,
    keySignature,
    requestSignature: sign(password, `${keyMessage}:${keySignature}:${n3}`),
  },
  jwt
);
if (!key.ok) fail('5. Crypto/CreateKey', key);
console.log('5. Signing key created');

// 6. Apply for the Legal Identity
const n4 = nonce();
const applied = await post(
  '/Agent/Legal/ApplyId',
  {
    keyId,
    nonce: n4,
    keySignature,
    requestSignature: sign(
      password,
      `${keyMessage}:${keySignature}:${n4}:FN:${FIRST_NAME}:LN:${LAST_NAME}`
    ),
    Properties: [
      { name: 'FN', value: FIRST_NAME },
      { name: 'LN', value: LAST_NAME },
    ],
  },
  jwt
);
if (!applied.ok || !applied.body.Identity) fail('6. Legal/ApplyId', applied);
const legalId = applied.body.Identity.id;
console.log(`6. Identity applied: ${legalId}`);

// 7. Wait for approval — the sandbox approves automatically, but not instantly
let state = applied.body.Identity.status?.state;
for (let attempt = 0; attempt < 15 && state !== 'Approved'; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const got = await post('/Agent/Legal/GetIdentity', { legalId }, jwt);
  state = got.body.Identity?.status?.state ?? state;
  process.stdout.write(`\r7. Identity state: ${state}        `);
}
console.log('');

if (state !== 'Approved') {
  console.error(`\nIdentity did not reach Approved (last state: ${state}).`);
  console.error(`Keep this legalId and contact the sandbox operator: ${legalId}`);
  process.exit(1);
}

console.log('\n' + '='.repeat(70));
console.log('Add these to your environment (Vercel > Settings > Environment Variables):');
console.log('='.repeat(70) + '\n');
console.log(`NEURO_HOST=${HOST}`);
console.log(`NEURO_USERNAME=${userName}`);
console.log(`NEURO_ACCOUNT_PASSWORD=${password}`);
console.log(`NEURO_LEGAL_ID=${legalId}`);
console.log(`
Then redeploy. The certificate will show the guardian identity as verified
against ${HOST}, re-read live on every render.

NEURO_ACCOUNT_PASSWORD authorizes signed requests as this account — treat it
as a secret and do not commit it.`);
