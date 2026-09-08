/**
 * GET  /api/heritage — list every preserved item (summary shape)
 * POST /api/heritage — preserve a new original
 *
 * POST is multipart/form-data:
 *   file           the original bytes (required)
 *   title          (required)
 *   year, type, location, story, contributorName, contributorRelationship
 *   aiEnrichment   JSON blob from /api/ai/enrich, already reviewed by a human
 */

import { getStore } from '@/lib/db';
import {
  listHeritageSummaries,
  preserveHeritage,
} from '@/lib/server/heritage-service';
import { fail, ok, readString, readUpload, UploadError } from '@/lib/server/http';
import type { AiEnrichment, HeritageType } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HERITAGE_TYPES: HeritageType[] = [
  'Photograph',
  'Audio',
  'Document',
  'Video',
  'Letter',
];

export async function GET() {
  const summaries = await listHeritageSummaries();
  return ok(summaries);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('Expected a multipart/form-data body.', 415);
  }

  try {
    const file = await readUpload(form);

    const title = readString(form, 'title');
    if (!title) return fail('A title is required.', 422);

    const rawType = readString(form, 'type');
    const type = HERITAGE_TYPES.includes(rawType as HeritageType)
      ? (rawType as HeritageType)
      : 'Photograph';

    const parsedYear = Number.parseInt(readString(form, 'year'), 10);
    const year = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();

    const item = await preserveHeritage({
      title,
      year,
      type,
      location: readString(form, 'location'),
      story: readString(form, 'story'),
      contributor: {
        name: readString(form, 'contributorName') || undefined,
        relationship: readString(form, 'contributorRelationship') || undefined,
      },
      aiEnrichment: parseEnrichment(readString(form, 'aiEnrichment')),
      file,
    });

    return ok(item, 201);
  } catch (error) {
    if (error instanceof UploadError) return fail(error.message, 422);
    return fail(
      `Preservation failed: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
}

/** The client sends back the AI suggestion together with the user's verdict. */
function parseEnrichment(raw: string): AiEnrichment | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as AiEnrichment;
    if (parsed.status === 'rejected') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

// Touching the store here keeps a cold serverless instance from paying
// the seed cost inside the first user-facing request.
void getStore();
