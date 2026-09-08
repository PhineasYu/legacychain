/**
 * Server-side custody of the guardian's post-quantum signing key.
 *
 * SECURITY MODEL
 *   The ML-DSA-44 secret key is derived from PQC_GUARDIAN_SEED and never
 *   leaves this module. Route handlers call `signRecord()`; only the
 *   signature and the public key are persisted or sent to the browser,
 *   which can verify them with `verifyProvenance()` from lib/services/pqc.
 *
 *   When PQC_GUARDIAN_SEED is unset a fixed development seed is used so
 *   signatures stay reproducible across restarts. That seed is public —
 *   set a real one before deploying anywhere that matters.
 */

import 'server-only';
import {
  createPublicKeyRef,
  generatePQCKeyPair,
  signProvenance,
  type PqcKeyPair,
  type PqcSignatureResult,
} from '../services/pqc';
import type { PqcSignature, SignedProvenanceData } from '../types';
import { PQC_GUARDIAN_SEED } from './config';

/** Fixed development seed — NOT a secret, and not for production use. */
const DEV_SEED = new Uint8Array(32).map((_, i) => (i * 7 + 13) % 256);

let cachedKeyPair: PqcKeyPair | null = null;

function getKeyPair(): PqcKeyPair {
  if (!cachedKeyPair) {
    cachedKeyPair = generatePQCKeyPair(resolveSeed());
  }
  return cachedKeyPair;
}

/**
 * Set when PQC_GUARDIAN_SEED is present but malformed. Reported by
 * /api/health so a mistyped seed is visible rather than silent.
 */
let seedError: string | null = null;

export function getSeedError(): string | null {
  return seedError;
}

/** True when signing is using the public development seed. */
export function isUsingDevSeed(): boolean {
  return !PQC_GUARDIAN_SEED || seedError !== null;
}

function resolveSeed(): Uint8Array {
  if (!PQC_GUARDIAN_SEED) return DEV_SEED;

  const hex = PQC_GUARDIAN_SEED.trim().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    // A malformed seed must not take the whole vault down: preservation
    // matters more than key provenance, and health reports the downgrade.
    seedError =
      `PQC_GUARDIAN_SEED must be 64 hex characters (got ${hex.length}). ` +
      'Falling back to the public development seed — signatures are forgeable ' +
      'until this is corrected.';
    console.warn(`[legacychain] ${seedError}`);
    return DEV_SEED;
  }

  const seed = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    seed[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return seed;
}

/** The public half of the guardian key — safe to publish. */
export function getGuardianPublicKey(): string {
  return createPublicKeyRef(getKeyPair()).publicKeyBase64;
}

/**
 * Signs a provenance payload and returns the storable signature record.
 *
 * The payload binds the heritage ID, the file fingerprint, the timestamp,
 * the guardian and the parent version together — changing any one of
 * them invalidates the signature.
 */
export function signRecord(data: SignedProvenanceData): PqcSignature {
  const result: PqcSignatureResult = signProvenance(data, getKeyPair().secretKey);

  return {
    status: 'Verified',
    algorithm: result.algorithm,
    signaturePreview: result.signaturePreview,
    signatureBase64: result.signatureBase64,
    publicKeyBase64: getGuardianPublicKey(),
    signedData: data,
  };
}
