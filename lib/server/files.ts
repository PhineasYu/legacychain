/**
 * Preserved originals.
 *
 * Files are addressed by their SHA-256 fingerprint, so identical content is
 * stored once and the storage key is itself a claim about the contents.
 * The bytes go wherever the active store puts them — Postgres when a
 * database is configured, otherwise local disk (or memory on a read-only
 * filesystem) — so this module never touches the filesystem directly.
 */

import 'server-only';
import { getStore } from '../db';

export interface StoredFile {
  /** SHA-256 hex digest — also the storage key */
  id: string;
  contentType: string;
  size: number;
  originalName: string;
  url: string;
}

/** Rejects anything that is not a plain SHA-256 digest before it is used as a key. */
export function isFingerprint(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

export async function storeOriginal(params: {
  digest: string;
  bytes: Uint8Array;
  contentType: string;
  originalName: string;
}): Promise<StoredFile> {
  const store = await getStore();

  const blob = {
    id: params.digest.toLowerCase(),
    contentType: params.contentType || 'application/octet-stream',
    originalName: params.originalName,
    size: params.bytes.byteLength,
    bytes: params.bytes,
  };

  await store.putBlob(blob);

  return {
    id: blob.id,
    contentType: blob.contentType,
    size: blob.size,
    originalName: blob.originalName,
    url: `/api/files/${blob.id}`,
  };
}

export async function readOriginal(
  digest: string
): Promise<{ bytes: Uint8Array; contentType: string; originalName: string } | null> {
  if (!isFingerprint(digest)) return null;

  const store = await getStore();
  const blob = await store.getBlob(digest.toLowerCase());
  if (!blob) return null;

  return {
    bytes: blob.bytes,
    contentType: blob.contentType,
    originalName: blob.originalName,
  };
}
