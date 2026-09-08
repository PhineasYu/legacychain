/**
 * Post-quantum cryptography (PQC) signature service.
 *
 * REAL IMPLEMENTATION using ML-DSA-44 (FIPS-204 / Dilithium).
 *
 * Library: @noble/post-quantum — auditable, minimal JS implementation
 * of NIST-standardized post-quantum algorithms. No native dependencies.
 * Works in both browser and Node.js.
 *
 * SECURITY MODEL:
 *   - Private keys are NEVER exposed to the frontend or stored on-chain.
 *   - Only the public key and signature are persisted for verification.
 *   - Signing operations should run server-side (e.g., in a Supabase
 *     Edge Function or API route) where the private key lives in a secret.
 *   - For this MVP, keypairs are generated deterministically from a seed
 *     so the demo data is reproducible. In production, the seed would be
 *     a server-side secret and the private key would never leave the
 *     signing service.
 *
 * SIGNED DATA:
 *   The signed payload is a canonical JSON encoding of ProvenanceData,
 *   which includes at minimum:
 *     - heritageId:   unique identifier of the heritage item
 *     - fileHash:     SHA-256 digest of the original file bytes
 *     - timestamp:    ISO 8601 string of when the signature was created
 *     - guardian:     name/identity of the contributor
 *     - parentVersion: ID of the parent provenance record (if derived)
 */

import { ml_dsa44 } from '@noble/post-quantum/ml-dsa.js';
import { randomBytes } from '@noble/post-quantum/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PqcKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  algorithm: string;
}

export interface PqcPublicKeyRef {
  /** Base64-encoded public key — safe to store and share */
  publicKeyBase64: string;
  algorithm: string;
}

export interface ProvenanceData {
  heritageId: string;
  fileHash: string;
  timestamp: string;
  guardian: string;
  parentVersion?: string;
}

export interface PqcSignatureResult {
  verified: boolean;
  algorithm: string;
  /** Base64-encoded signature */
  signatureBase64: string;
  /** First 12 hex chars of the signature, for UI display */
  signaturePreview: string;
  signedData: ProvenanceData;
  signedAt: string;
}

// ---------------------------------------------------------------------------
// Key management
// ---------------------------------------------------------------------------

/**
 * Generates a real ML-DSA-44 keypair.
 *
 * The secret key must be kept server-side and never sent to the browser.
 * Only the public key reference should be persisted for verification.
 *
 * @param seed Optional 32-byte seed for deterministic key generation.
 *             In production, this would be a server-side secret.
 */
export function generatePQCKeyPair(seed?: Uint8Array): PqcKeyPair {
  const actualSeed = seed ?? randomBytes(32);
  const keys = ml_dsa44.keygen(actualSeed);
  return {
    publicKey: keys.publicKey,
    secretKey: keys.secretKey,
    algorithm: 'ML-DSA-44 (FIPS-204)',
  };
}

/**
 * Creates a serializable reference to a public key (safe to store/persist).
 * The secret key is not included.
 */
export function createPublicKeyRef(keyPair: PqcKeyPair): PqcPublicKeyRef {
  return {
    publicKeyBase64: bytesToBase64(keyPair.publicKey),
    algorithm: keyPair.algorithm,
  };
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/**
 * Signs provenance data using ML-DSA-44.
 *
 * The provenance data is canonicalized to a deterministic JSON string
 * and then signed. This ensures that any modification to the heritage
 * ID, file hash, timestamp, guardian, or parent version will invalidate
 * the signature.
 *
 * SECURITY: This function requires the secret key and should only be
 * called server-side. Never expose the secret key to the frontend.
 */
export function signProvenance(
  data: ProvenanceData,
  secretKey: Uint8Array
): PqcSignatureResult {
  const message = canonicalizeProvenanceData(data);
  const signature = ml_dsa44.sign(message, secretKey);

  return {
    verified: true, // freshly signed — implicitly valid
    algorithm: 'ML-DSA-44 (FIPS-204)',
    signatureBase64: bytesToBase64(signature),
    signaturePreview: bytesToHex(signature.slice(0, 6)),
    signedData: data,
    signedAt: data.timestamp,
  };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Verifies a PQC signature against provenance data using the public key.
 *
 * Returns true ONLY if the signature was produced by the corresponding
 * private key over exactly this provenance data. Any modification to
 * the data, or use of a different public key, will cause verification
 * to fail.
 */
export function verifyProvenance(
  data: ProvenanceData,
  signatureBase64: string,
  publicKeyBase64: string
): boolean {
  try {
    const signature = base64ToBytes(signatureBase64);
    const publicKey = base64ToBytes(publicKeyBase64);
    const message = canonicalizeProvenanceData(data);
    return ml_dsa44.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Canonicalization
// ---------------------------------------------------------------------------

/**
 * Serializes ProvenanceData into a deterministic byte sequence for signing.
 *
 * Fields are emitted in a fixed order so that the same logical data
 * always produces the same message bytes. This prevents ambiguity in
 * JSON key ordering from invalidating signatures.
 */
export function canonicalizeProvenanceData(data: ProvenanceData): Uint8Array {
  const parts = [
    `heritageId:${data.heritageId}`,
    `fileHash:${data.fileHash}`,
    `timestamp:${data.timestamp}`,
    `guardian:${data.guardian}`,
    data.parentVersion ? `parentVersion:${data.parentVersion}` : 'parentVersion:null',
  ];
  return new TextEncoder().encode(parts.join('\n'));
}

// ---------------------------------------------------------------------------
// Encoding utilities
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
