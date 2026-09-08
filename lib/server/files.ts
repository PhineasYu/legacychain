/**
 * Blob storage for original heritage files.
 *
 * Originals are stored outside the database and served back through
 * /api/files/[id]. They are addressed by their SHA-256 fingerprint, so
 * the same bytes are never stored twice and the stored name is itself
 * a proof of content.
 *
 * This local-disk implementation is the MVP. Swapping in S3, R2 or
 * IPFS means replacing only the three functions below.
 */

import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LOCAL_DATA_DIR } from './config';

const UPLOAD_DIR = path.join(process.cwd(), LOCAL_DATA_DIR, 'originals');

export interface StoredFile {
  /** SHA-256 hex digest — also the storage key */
  id: string;
  contentType: string;
  size: number;
  originalName: string;
  url: string;
}

/**
 * Persists file bytes under their fingerprint.
 * Storing the same content twice is a no-op, not an error.
 */
export async function storeOriginal(params: {
  digest: string;
  bytes: Uint8Array;
  contentType: string;
  originalName: string;
}): Promise<StoredFile> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const blobPath = path.join(UPLOAD_DIR, params.digest);
  const metaPath = `${blobPath}.json`;

  const meta = {
    id: params.digest,
    contentType: params.contentType || 'application/octet-stream',
    size: params.bytes.byteLength,
    originalName: params.originalName,
  };

  if (!(await exists(blobPath))) {
    await fs.writeFile(blobPath, params.bytes);
  }
  await fs.writeFile(metaPath, JSON.stringify(meta), 'utf8');

  return { ...meta, url: `/api/files/${params.digest}` };
}

export async function readOriginal(
  digest: string
): Promise<{ bytes: Buffer; contentType: string; originalName: string } | null> {
  // The digest is used as a path segment, so reject anything that is not
  // a plain hex digest before touching the filesystem.
  if (!/^[0-9a-f]{64}$/i.test(digest)) return null;

  const blobPath = path.join(UPLOAD_DIR, digest.toLowerCase());
  try {
    const bytes = await fs.readFile(blobPath);
    let contentType = 'application/octet-stream';
    let originalName = digest;
    try {
      const meta = JSON.parse(await fs.readFile(`${blobPath}.json`, 'utf8'));
      contentType = meta.contentType ?? contentType;
      originalName = meta.originalName ?? originalName;
    } catch {
      // Metadata is optional — fall back to the generic content type.
    }
    return { bytes, contentType, originalName };
  } catch {
    return null;
  }
}

export async function hasOriginal(digest: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/i.test(digest)) return false;
  return exists(path.join(UPLOAD_DIR, digest.toLowerCase()));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
