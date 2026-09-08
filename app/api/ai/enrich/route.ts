/**
 * POST /api/ai/enrich — ask the model what it can observe about a file.
 *
 * Returns a SUGGESTION with `status: 'pending'`. Nothing here is stored
 * or treated as fact until a person accepts or edits it on the client
 * and sends it back with the preservation request.
 */

import { enrichHeritage } from '@/lib/server/ai';
import { fail, ok, readString, readUpload, UploadError } from '@/lib/server/http';
import type { HeritageType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('Expected a multipart/form-data body.', 415);
  }

  try {
    const file = await readUpload(form);
    const parsedYear = Number.parseInt(readString(form, 'year'), 10);

    const enrichment = await enrichHeritage({
      fileName: file.originalName,
      contentType: file.contentType,
      heritageType: (readString(form, 'type') || 'Photograph') as HeritageType,
      title: readString(form, 'title') || file.originalName,
      year: Number.isFinite(parsedYear) ? parsedYear : undefined,
      location: readString(form, 'location') || undefined,
      story: readString(form, 'story') || undefined,
      bytes: file.bytes,
    });

    return ok(enrichment);
  } catch (error) {
    if (error instanceof UploadError) return fail(error.message, 422);
    return fail(
      `Enrichment failed: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
}
