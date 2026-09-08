/**
 * End-to-end check of the demo narrative, against a running deployment.
 *
 *   npm run test:e2e                      # http://localhost:3000
 *   BASE_URL=https://... npm run test:e2e # a deployment
 *
 * Walks the exact path shown in a demo and asserts each claim:
 *
 *   upload → AI suggestion → SHA-256 → PQC signature → anchor → certificate
 *   → verify original (authentic) → verify modified (different)
 *   → register derived → provenance links to the original
 *   → human accepts/rejects the AI suggestion → attestation
 *
 * Exits non-zero on the first failed assertion.
 */

import { createHash, randomBytes } from 'node:crypto';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

let passed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
    failures.push(label);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function api(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, ok: res.ok, body };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** A deterministic, visibly-labelled test image. */
function makeImage(label, tint) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <rect width="400" height="300" fill="${tint}"/>
  <text x="200" y="150" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="#2b231d">${label}</text>
</svg>
`,
    'utf8'
  );
}

function form(fields) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof Buffer) {
      fd.set(key, new Blob([value], { type: 'image/svg+xml' }), `${key}.svg`);
    } else if (value !== undefined) {
      fd.set(key, String(value));
    }
  }
  return fd;
}

const run = randomBytes(4).toString('hex');
console.log(`LegacyChain end-to-end demo check\nTarget: ${BASE}\nRun id: ${run}`);

// ---------------------------------------------------------------------------
section('0. Service is up');
// ---------------------------------------------------------------------------
const health = await api('/api/health');
check('health responds', health.ok, `HTTP ${health.status}`);
if (!health.ok) process.exit(1);

const mode = health.body.mode ?? {};
console.log(
  `    storage=${health.body.storage?.driver} durable=${health.body.storage?.durable} ` +
    `blockchain=${mode.blockchain} identity=${mode.identity} ai=${mode.ai}`
);
check(
  'storage is durable (uploads survive a restart)',
  health.body.storage?.durable === true,
  'running in memory — a demo will lose uploads'
);

// ---------------------------------------------------------------------------
section('1. AI understands the upload (suggestion only)');
// ---------------------------------------------------------------------------
const original = makeImage(`Original ${run}`, '#f3eee5');
const originalHash = sha256(original);

const enrich = await api('/api/ai/enrich', {
  method: 'POST',
  body: form({ file: original, title: `Wedding ${run}`, type: 'Photograph', year: '1968' }),
});
check('AI enrichment returns a suggestion', enrich.ok, `HTTP ${enrich.status}`);
check(
  'suggestion starts as pending, not fact',
  enrich.body.data?.status === 'pending',
  `got ${enrich.body.data?.status}`
);
check('suggestion records its source', Boolean(enrich.body.data?.source));

// ---------------------------------------------------------------------------
section('2. Preserve: SHA-256 + PQC signature + anchor');
// ---------------------------------------------------------------------------
const created = await api('/api/heritage', {
  method: 'POST',
  body: form({
    file: original,
    title: `Wedding ${run}`,
    year: '1968',
    type: 'Photograph',
    location: 'Addis Ababa, Ethiopia',
    story: 'End-to-end demo check.',
    contributorName: 'Sara Abdi',
    contributorRelationship: 'Granddaughter',
    aiEnrichment: JSON.stringify(enrich.body.data),
  }),
});
check('heritage preserved', created.ok, `HTTP ${created.status}`);
if (!created.ok) process.exit(1);

const item = created.body.data;
check('Digital DNA matches SHA-256 of the bytes sent', item.digitalDna === originalHash);
check('PQC signature is verified', item.pqcSignature?.status === 'Verified');
check('signature algorithm is ML-DSA-44', /ML-DSA-44/.test(item.pqcSignature?.algorithm ?? ''));
check(
  'the signature covers this exact file hash',
  item.pqcSignature?.signedData?.fileHash === originalHash
);
check('an anchor was produced', Boolean(item.blockchain?.recordId));
check(
  'anchor status is truthful',
  ['anchored', 'simulated'].includes(item.blockchain?.status),
  `got ${item.blockchain?.status}`
);
if (item.blockchain?.status === 'simulated') {
  console.log('    note: anchor is simulated — no public chain configured');
}
check('exactly one ORIGINAL provenance record', item.provenance?.length === 1);
check('that record is an ORIGINAL', item.provenance?.[0]?.kind === 'ORIGINAL');

// ---------------------------------------------------------------------------
section('3. The preserved original is served back byte-identical');
// ---------------------------------------------------------------------------
const fileRes = await fetch(`${BASE}/api/files/${item.digitalDna}`);
const served = Buffer.from(await fileRes.arrayBuffer());
check('stored original downloads', fileRes.ok, `HTTP ${fileRes.status}`);
check('served bytes re-hash to the same fingerprint', sha256(served) === originalHash);

// ---------------------------------------------------------------------------
section('4. Certificate carries independently checkable proof');
// ---------------------------------------------------------------------------
const cert = await api(`/api/certificate/${item.id}`);
check('certificate available', cert.ok, `HTTP ${cert.status}`);
const c = cert.body.data ?? {};
check('certificate exposes the signature', Boolean(c.pqcSignature?.signatureBase64));
check('certificate exposes the public key', Boolean(c.pqcSignature?.publicKeyBase64));
check('certificate exposes the signed payload', Boolean(c.pqcSignature?.signedData));
check('certificate reports the three protocols', Boolean(c.protocols));

// ---------------------------------------------------------------------------
section('5. Verify the ORIGINAL → authentic');
// ---------------------------------------------------------------------------
const verifyOriginal = await api('/api/verify', {
  method: 'POST',
  body: form({ file: original }),
});
check('verification runs', verifyOriginal.ok, `HTTP ${verifyOriginal.status}`);
check(
  'original is AUTHENTIC',
  verifyOriginal.body.data?.status === 'authentic',
  `got ${verifyOriginal.body.data?.status}`
);
check('match is 100%', verifyOriginal.body.data?.matchPercentage === 100);
check('it resolves to the right item', verifyOriginal.body.data?.match?.heritageId === item.id);

// ---------------------------------------------------------------------------
section('6. Verify an AI-MODIFIED version → different');
// ---------------------------------------------------------------------------
const restored = makeImage(`Original ${run}`, '#e8dcc8'); // recoloured: different bytes
const restoredHash = sha256(restored);
check('the modified file really has a different hash', restoredHash !== originalHash);

const verifyModified = await api('/api/verify', {
  method: 'POST',
  body: form({ file: restored, heritageId: item.id }),
});
check(
  'modified file is DIFFERENT, not authentic',
  verifyModified.body.data?.status === 'different',
  `got ${verifyModified.body.data?.status}`
);
check(
  'it offers the original to derive from',
  verifyModified.body.data?.candidateOriginal?.heritageId === item.id
);

// ---------------------------------------------------------------------------
section('7. Register the modified file as a DERIVED version');
// ---------------------------------------------------------------------------
const derived = await api(`/api/heritage/${item.id}/derived`, {
  method: 'POST',
  body: form({
    file: restored,
    title: 'AI Restored Version',
    transformType: 'AI Restoration',
    description: 'Colour restored by an AI model.',
  }),
});
check('derived version registered', derived.ok, `HTTP ${derived.status}`);
const record = derived.body.data?.record ?? {};
check('it is marked DERIVED', record.kind === 'DERIVED');
check('it has its own fingerprint', record.digitalDna === restoredHash);
check('it has its own PQC signature', record.pqcSignature?.status === 'Verified');
check('it links back to the original', record.derivedFromId === item.provenance[0].id);
check(
  'the signature binds the parent version',
  record.pqcSignature?.signedData?.parentVersion === originalHash
);

// The original must be untouched — this is the product's central promise.
const afterDerive = await api(`/api/heritage/${item.id}`);
const originalRecord = afterDerive.body.data.provenance.find((p) => p.kind === 'ORIGINAL');
check('the ORIGINAL record is unchanged', originalRecord.digitalDna === originalHash);
check('the chain now has 2 records', afterDerive.body.data.provenance.length === 2);

const stillAuthentic = await api('/api/verify', { method: 'POST', body: form({ file: original }) });
check(
  'the original still verifies as authentic after deriving',
  stillAuthentic.body.data?.status === 'authentic'
);

check(
  'an identical file is rejected as a derived version',
  (await api(`/api/heritage/${item.id}/derived`, {
    method: 'POST',
    body: form({ file: original, title: 'Copy', transformType: 'AI Restoration' }),
  })).status === 409
);

// ---------------------------------------------------------------------------
section('8. A human rules on the AI suggestion');
// ---------------------------------------------------------------------------
const accepted = await api(`/api/heritage/${item.id}/enrichment`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'accepted' }),
});
check('acceptance recorded', accepted.ok && accepted.body.data?.status === 'accepted');

const editedText = 'Confirmed by the family: a wedding in Addis Ababa, spring 1968.';
const edited = await api(`/api/heritage/${item.id}/enrichment`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'edited', description: editedText }),
});
check(
  'an edit replaces the wording',
  edited.body.data?.status === 'edited' && edited.body.data?.description === editedText
);
check('the source of the suggestion is still recorded', Boolean(edited.body.data?.source));

// ---------------------------------------------------------------------------
section('9. Family attestation');
// ---------------------------------------------------------------------------
const attested = await api(`/api/heritage/${item.id}/attestations`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    attesterName: 'Almaz Abdi',
    relationship: 'Grandmother',
    decision: 'confirm',
    statement: 'This was our wedding in 1968.',
  }),
});
check('attestation recorded', attested.ok && attested.body.data?.decision === 'confirm');

const attestAnchor = attested.body.data?.anchor;
check('the attestation was anchored too', Boolean(attestAnchor?.attestationHash));
check(
  'its anchor status is truthful',
  ['anchored', 'simulated', 'failed'].includes(attestAnchor?.status),
  `got ${attestAnchor?.status}`
);
check(
  'only a hash of the statement is anchored',
  typeof attestAnchor?.attestationHash === 'string' &&
    !JSON.stringify(attestAnchor).includes('wedding in 1968'),
  'the statement text leaked into the anchor'
);

const final = await api(`/api/heritage/${item.id}`);
check('the attestation appears on the record', final.body.data?.attestations?.length >= 1);
check(
  'nothing about the original file changed',
  final.body.data?.digitalDna === originalHash
);

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(58)}`);
if (failures.length === 0) {
  console.log(`ALL ${passed} CHECKS PASSED`);
  console.log(`Demo item: ${BASE}/certificate/${item.id}`);
} else {
  console.log(`${passed} passed, ${failures.length} FAILED:`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
