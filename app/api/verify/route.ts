/**
 * POST /api/verify — is this file the original?
 *
 * multipart/form-data:
 *   file        the bytes to check (required)
 *   heritageId  optional, to compare against one specific item
 */

import { fail, ok, readString, readUpload, UploadError } from '@/lib/server/http';
import { verifyUpload } from '@/lib/server/verification-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('Expected a multipart/form-data body.', 415);
  }

  try {
    const file = await readUpload(form);
    const result = await verifyUpload({
      bytes: file.bytes,
      heritageId: readString(form, 'heritageId') || undefined,
    });
    return ok(result);
  } catch (error) {
    if (error instanceof UploadError) return fail(error.message, 422);
    return fail(
      `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
}
