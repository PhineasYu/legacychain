/**
 * Neuro Agent API client — Legal Identity for heritage guardians.
 *
 * WHY THIS EXISTS
 *   A certificate that says "Verified Identity" next to a name it never
 *   checked is decoration. Neuro issues a reviewed Legal Identity, so the
 *   badge can point at something real: an identity id, its issuing Neuron,
 *   and a state that this application re-reads rather than asserts.
 *
 * WHAT IT DOES NOT CLAIM
 *   A sandbox identity is approved automatically. It proves the identity
 *   exists and is approved on that Neuron — not that a real person was
 *   verified. `isSandbox` is carried through so the UI can say which it is.
 *
 * AUTH MODEL
 *   Requests are signed with HMAC-SHA-256 over ':'-joined field values, per
 *   the Agent API. Three separate secrets — the API secret (account
 *   creation), the account password (requests), and the key password (the
 *   signing key) — all stay server-side.
 *
 * Reference: https://docs.neuro-tech.io/neuron-api/quickstart
 */

import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import {
  NEURO_ACCOUNT_PASSWORD,
  NEURO_HOST,
  NEURO_LEGAL_ID,
  NEURO_USERNAME,
  isNeuroConfigured,
  neuroAppUrl,
} from './config';

export interface NeuroIdentity {
  legalId: string;
  state: string;
  /** True once the issuing Neuron reports the identity as Approved */
  approved: boolean;
  /** Host of the Neuron that issued it, e.g. sandbox1.neuro-tech.io */
  issuer: string;
  /** Sandbox identities are auto-approved and verify no real person */
  isSandbox: boolean;
  properties: Record<string, string>;
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Signing helpers
// ---------------------------------------------------------------------------

export function neuroNonce(): string {
  return randomBytes(32).toString('base64');
}

/** HMAC-SHA-256 over the UTF-8 message, keyed by the UTF-8 secret, Base64. */
export function neuroSign(secret: string, message: string): string {
  return createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(Buffer.from(message, 'utf8'))
    .digest('base64');
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export interface NeuroResponse<T = Record<string, unknown>> {
  status: number;
  ok: boolean;
  body: T;
}

/**
 * Posts to a Neuron.
 *
 * `Referer` is required by the Agent API — identity application validates it —
 * so it must be a reachable HTTPS URL identifying this deployment.
 */
export async function neuroPost<T = Record<string, unknown>>(
  path: string,
  body: unknown,
  options: { host?: string; jwt?: string; appUrl?: string } = {}
): Promise<NeuroResponse<T>> {
  const host = options.host ?? NEURO_HOST;
  const response = await fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      Referer: options.appUrl ?? neuroAppUrl(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.jwt ? { Authorization: `Bearer ${options.jwt}` } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  return { status: response.status, ok: response.ok, body: parsed as T };
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

interface CachedSession {
  jwt: string;
  expiresAt: number;
}

let session: CachedSession | null = null;

/**
 * Signs in and caches the JWT.
 *
 * The token is reused until shortly before it expires, so a page render does
 * not cost a login round trip.
 */
async function login(): Promise<string | null> {
  if (session && session.expiresAt > Date.now() + 30_000) {
    return session.jwt;
  }

  const nonce = neuroNonce();
  const signature = neuroSign(
    NEURO_ACCOUNT_PASSWORD,
    `${NEURO_USERNAME}:${NEURO_HOST}:${nonce}`
  );

  const result = await neuroPost<{ jwt?: string }>('/Agent/Account/Login', {
    userName: NEURO_USERNAME,
    nonce,
    signature,
    seconds: 3600,
  });

  if (!result.ok || !result.body.jwt) return null;

  session = { jwt: result.body.jwt, expiresAt: Date.now() + 3_000_000 };
  return session.jwt;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

interface IdentityResponse {
  Identity?: {
    id?: string;
    status?: { state?: string };
    Properties?: { name: string; value: string }[];
  };
}

/**
 * Reads the configured guardian identity back from its Neuron.
 *
 * Returns null when Neuro is not configured or unreachable — the certificate
 * then falls back to showing the identity as unverified rather than
 * inventing a badge.
 */
export async function getGuardianIdentity(): Promise<NeuroIdentity | null> {
  if (!isNeuroConfigured()) return null;

  try {
    const jwt = await login();
    if (!jwt) return null;

    const result = await neuroPost<IdentityResponse>(
      '/Agent/Legal/GetIdentity',
      { legalId: NEURO_LEGAL_ID },
      { jwt }
    );
    if (!result.ok || !result.body.Identity) return null;

    const identity = result.body.Identity;
    const state = identity.status?.state ?? 'Unknown';

    const properties: Record<string, string> = {};
    for (const property of identity.Properties ?? []) {
      properties[property.name] = property.value;
    }

    return {
      legalId: identity.id ?? NEURO_LEGAL_ID,
      state,
      approved: state === 'Approved',
      issuer: NEURO_HOST,
      isSandbox: NEURO_HOST.includes('sandbox'),
      properties,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    // Identity lookup must never break preservation — the fingerprint and
    // the PQC signature are the proof that matters.
    return null;
  }
}

/** Human-readable name from the identity's FN/LN properties, if present. */
export function identityDisplayName(identity: NeuroIdentity): string | null {
  const first = identity.properties.FN;
  const last = identity.properties.LN;
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full.length > 0 ? full : null;
}
