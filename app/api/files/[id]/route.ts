/**
 * GET /api/files/[id] — serve a preserved original by its fingerprint.
 *
 * The id IS the SHA-256 digest, so the URL is itself a content claim:
 * re-hashing what this route returns must reproduce the id.
 */

import { readOriginal } from '@/lib/server/files';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const file = await readOriginal(params.id);
  if (!file) {
    return new Response('Not found', { status: 404 });
  }

  const download = new URL(request.url).searchParams.has('download');
  const disposition = download
    ? `attachment; filename="${encodeURIComponent(file.originalName)}"`
    : 'inline';

  return new Response(file.bytes, {
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.bytes.byteLength),
      'Content-Disposition': disposition,
      // Content-addressed bytes can never change, so cache them hard.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
