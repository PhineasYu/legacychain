/**
 * POST /api/heritage/[id]/derived — register a transformed version.
 *
 * A derived version is anything made *from* a source: a transcript, a
 * translation, a restoration. It is fingerprinted, signed and anchored in
 * its own right and linked to what it was made from, so a reading can never
 * quietly take the place of the thing it read. The parent is never touched.
 *
 * multipart/form-data:
 *   file           the transformed bytes (required)
 *   title          (required) e.g. "AI Restored Version"
 *   transformType  (required) e.g. "AI Restoration"
 *   description, parentProvenanceId
 */

import {
  HeritageNotFoundError,
  IdenticalToParentError,
  registerDerivedVersion,
} from '@/lib/server/heritage-service';
import { fail, ok, readString, readUpload, UploadError } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('Expected a multipart/form-data body.', 415);
  }

  try {
    const file = await readUpload(form);

    const title = readString(form, 'title');
    const transformType = readString(form, 'transformType');
    if (!title) return fail('A title for the derived version is required.', 422);
    if (!transformType) return fail('A transform type is required.', 422);

    const result = await registerDerivedVersion({
      heritageId: params.id,
      parentProvenanceId: readString(form, 'parentProvenanceId') || undefined,
      title,
      transformType,
      description: readString(form, 'description') || undefined,
      file,
    });

    return ok({ item: result.item, record: result.record }, 201);
  } catch (error) {
    if (error instanceof UploadError) return fail(error.message, 422);
    if (error instanceof HeritageNotFoundError) return fail(error.message, 404, 'not_found');
    if (error instanceof IdenticalToParentError) {
      return fail(error.message, 409, 'identical_to_parent');
    }
    return fail(
      `Could not register derived version: ${
        error instanceof Error ? error.message : String(error)
      }`,
      500
    );
  }
}
