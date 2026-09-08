/**
 * Digital fingerprint / hashing service.
 *
 * Uses the Web Crypto API (crypto.subtle.digest) to compute a real
 * SHA-256 hash of the uploaded file's bytes. This works in both the
 * browser and Node.js ≥ 18.
 *
 * The exact bytes of the file are hashed — no metadata (name, size,
 * lastModified) is mixed in — so two files with identical content
 * produce identical fingerprints.
 */

export interface HashResult {
  digest: string;
  algorithm: string;
  createdAt: string;
}

/**
 * Computes a SHA-256 fingerprint of a File (browser) or a string/Buffer.
 *
 * For File inputs the raw file bytes are read via arrayBuffer() and
 * hashed directly. For string inputs the UTF-8 encoded bytes are hashed.
 */
export async function createDigitalFingerprint(
  file: File | ArrayBuffer | Uint8Array | string
): Promise<HashResult> {
  const data = await toHashableData(file);
  const digestBuffer = await crypto.subtle.digest('SHA-256', data);
  const digest = bufferToHex(digestBuffer);

  return {
    digest,
    algorithm: 'SHA-256',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Compares two digital fingerprints.
 * SHA-256 is a cryptographic hash — two files match if and only if
 * their digests are byte-for-byte identical.
 */
export function compareFingerprints(
  uploadedDna: string,
  registeredDna: string
): { matchPercentage: number; isMatch: boolean } {
  const normalizedA = uploadedDna.toLowerCase();
  const normalizedB = registeredDna.toLowerCase();
  if (normalizedA === normalizedB) {
    return { matchPercentage: 100, isMatch: true };
  }
  return { matchPercentage: 0, isMatch: false };
}

/**
 * Truncates a digest for display (e.g., "8ab82f...7cd49").
 */
export function truncateDigest(digest: string, head = 6, tail = 5): string {
  if (digest.length <= head + tail + 3) return digest;
  return `${digest.slice(0, head)}...${digest.slice(-tail)}`;
}

async function toHashableData(
  input: File | ArrayBuffer | Uint8Array | string
): Promise<ArrayBuffer> {
  if (input instanceof File || input instanceof Blob) {
    return input.arrayBuffer();
  }
  if (input instanceof ArrayBuffer) {
    return input;
  }
  if (input instanceof Uint8Array) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
  }
  // string → UTF-8 bytes
  return new TextEncoder().encode(input).buffer as ArrayBuffer;
}

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hexChars: string[] = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    hexChars[i] = bytes[i].toString(16).padStart(2, '0');
  }
  return hexChars.join('');
}
