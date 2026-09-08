/**
 * Server-side configuration for LegacyChain.
 *
 * Every external system (database, blockchain, AI) is OPTIONAL. When a
 * service is not configured the application falls back to a local mode
 * that still exercises the full flow, so `npm run dev` works with zero
 * setup and the demo never depends on a network call succeeding.
 *
 * Read `getRuntimeMode()` to find out which mode each subsystem is in.
 */

import 'server-only';

export type SubsystemMode = 'live' | 'local';

export interface RuntimeMode {
  database: SubsystemMode;
  blockchain: SubsystemMode;
  ai: SubsystemMode;
  identity: SubsystemMode;
}

/** Names checked first, in order, before falling back to a scan. */
const PREFERRED_DATABASE_VARS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'NEON_DATABASE_URL',
  'STORAGE_URL',
];

function isPostgresUrl(value: string | undefined): value is string {
  return typeof value === 'string' && /^postgres(ql)?:\/\//.test(value.trim());
}

function resolveDatabaseUrl(): string {
  for (const name of PREFERRED_DATABASE_VARS) {
    const value = process.env[name];
    if (isPostgresUrl(value)) return value.trim();
  }

  // Any *_URL variable holding a Postgres connection string. Pooled
  // connections are preferred over the "unpooled" variants some providers
  // add alongside them, which are not suited to serverless.
  const candidates = Object.entries(process.env)
    .filter(([name, value]) => name.endsWith('_URL') && isPostgresUrl(value))
    .sort(([a], [b]) => Number(a.includes('UNPOOLED')) - Number(b.includes('UNPOOLED')));

  return candidates.length > 0 ? (candidates[0][1] as string).trim() : '';
}

/**
 * Neon / Postgres connection string. Falls back to the local file store.
 *
 * Hosting providers name this variable differently — Vercel's Neon
 * integration lets you choose a prefix, producing STORAGE_URL, NEON_URL and
 * so on — so rather than requiring one exact name, any environment variable
 * holding a Postgres connection string is accepted.
 */
export const DATABASE_URL = resolveDatabaseUrl();

/** Anthropic API key for AI heritage enrichment. Falls back to heuristics. */
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

/** Ethereum JSON-RPC endpoint (Dwellir, Infura, Alchemy, ...). */
export const ETH_RPC_URL = process.env.ETH_RPC_URL ?? '';
/** Private key of the wallet that pays for anchoring transactions. */
export const ETH_PRIVATE_KEY = process.env.ETH_PRIVATE_KEY ?? '';
/** Address of the deployed HeritageRegistry contract. */
export const HERITAGE_REGISTRY_ADDRESS = process.env.HERITAGE_REGISTRY_ADDRESS ?? '';
export const ETH_CHAIN_ID = Number(process.env.ETH_CHAIN_ID ?? '11155111');
export const ETH_NETWORK_NAME = process.env.ETH_NETWORK_NAME ?? 'Ethereum Sepolia';
export const ETH_EXPLORER_BASE =
  process.env.ETH_EXPLORER_BASE ?? 'https://sepolia.etherscan.io';

/**
 * 32-byte hex seed for the guardian's ML-DSA-44 signing key.
 *
 * SECURITY: this seed derives the private signing key and must never be
 * sent to the browser. In production it belongs in a secrets manager.
 * When unset, a fixed development seed is used so demo signatures are
 * reproducible across restarts.
 */
export const PQC_GUARDIAN_SEED = process.env.PQC_GUARDIAN_SEED ?? '';

// --- Neuro (identity) -----------------------------------------------------
// Provisioned once by `npm run neuro:provision`, which prints these values.
// SECURITY: the account password authorizes signed requests — server-side only.

/** Neuron host, e.g. sandbox1.neuro-tech.io — no scheme, no path. */
export const NEURO_HOST = process.env.NEURO_HOST ?? '';
export const NEURO_USERNAME = process.env.NEURO_USERNAME ?? '';
export const NEURO_ACCOUNT_PASSWORD = process.env.NEURO_ACCOUNT_PASSWORD ?? '';
/** The approved Legal Identity representing the vault's guardian. */
export const NEURO_LEGAL_ID = process.env.NEURO_LEGAL_ID ?? '';

/** Directory where uploaded original files are stored in local mode. */
export const LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR ?? '.data';

/**
 * Public base URL, used for QR codes, certificate links and the Referer the
 * Neuro Agent API requires.
 *
 * Falls back to the deployment URL the host provides, so a Vercel deploy does
 * not need this set by hand — one less thing to get wrong.
 */
export const PUBLIC_BASE_URL = resolvePublicBaseUrl();

function resolvePublicBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit && explicit.length > 0) return explicit.replace(/\/$/, '');

  // Vercel sets the stable production domain, and VERCEL_URL for the
  // per-deployment domain. Neither includes a scheme.
  const hosted =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (hosted && hosted.length > 0) return `https://${hosted}`;

  return 'http://localhost:3000';
}

export function isDatabaseConfigured(): boolean {
  return DATABASE_URL.length > 0;
}

export function isBlockchainConfigured(): boolean {
  return (
    ETH_RPC_URL.length > 0 &&
    ETH_PRIVATE_KEY.length > 0 &&
    HERITAGE_REGISTRY_ADDRESS.length > 0
  );
}

export function isAiConfigured(): boolean {
  return ANTHROPIC_API_KEY.length > 0;
}

/**
 * The Agent API requires a Referer identifying this application, and
 * validates it when applying for an identity.
 */
export function neuroAppUrl(): string {
  return PUBLIC_BASE_URL.endsWith('/') ? PUBLIC_BASE_URL : `${PUBLIC_BASE_URL}/`;
}

export function isNeuroConfigured(): boolean {
  return (
    NEURO_HOST.length > 0 &&
    NEURO_USERNAME.length > 0 &&
    NEURO_ACCOUNT_PASSWORD.length > 0 &&
    NEURO_LEGAL_ID.length > 0
  );
}

export function getRuntimeMode(): RuntimeMode {
  return {
    database: isDatabaseConfigured() ? 'live' : 'local',
    blockchain: isBlockchainConfigured() ? 'live' : 'local',
    ai: isAiConfigured() ? 'live' : 'local',
    identity: isNeuroConfigured() ? 'live' : 'local',
  };
}
