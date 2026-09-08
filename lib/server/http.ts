/**
 * Shared helpers for route handlers: consistent JSON envelopes and
 * multipart parsing with a size ceiling.
 */

import 'server-only';
import { NextResponse } from 'next/server';

/** Largest upload accepted. Heritage files are documents and photographs. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, code?: string): NextResponse {
  return NextResponse.json({ ok: false, error: { message, code } }, { status });
}

export interface UploadedFile {
  bytes: Uint8Array;
  contentType: string;
  originalName: string;
}

export class UploadError extends Error {}

/**
 * Reads one file field out of a multipart form.
 * Throws UploadError with a message meant for the user.
 */
export async function readUpload(
  form: FormData,
  field = 'file'
): Promise<UploadedFile> {
  const value = form.get(field);
  if (!value || typeof value === 'string') {
    throw new UploadError(`Missing "${field}" upload.`);
  }

  const file = value as File;
  if (file.size === 0) {
    throw new UploadError('The uploaded file is empty.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `File is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`
    );
  }

  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type || 'application/octet-stream',
    originalName: file.name || 'upload',
  };
}

export function readString(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
