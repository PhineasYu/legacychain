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
}

/** Neon / Postgres connection string. Falls back to the local file store. */
export const DATABASE_URL = process.env.DATABASE_URL ?? '';

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

/** Directory where uploaded original files are stored in local mode. */
export const LOCAL_DATA_DIR = process.env.LOCAL_DATA_DIR ?? '.data';

/** Public base URL, used to build QR / certificate links. */
export const PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

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

export function getRuntimeMode(): RuntimeMode {
  return {
    database: isDatabaseConfigured() ? 'live' : 'local',
    blockchain: isBlockchainConfigured() ? 'live' : 'local',
    ai: isAiConfigured() ? 'live' : 'local',
  };
}
