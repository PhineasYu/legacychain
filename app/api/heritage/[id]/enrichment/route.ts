/**
 * PATCH /api/heritage/[id]/enrichment — record a human verdict on the AI's
 * suggestion.
 *
 * This endpoint exists to enforce the product's central rule: AI discovers,
 * humans decide. A suggestion is stored as `pending` and only a person can
 * move it to `accepted`, `edited` or `rejected`. Nothing here can alter the
 * file, its fingerprint, its signature or its provenance chain — a verdict on
 * a description must never be able to rewrite the record it describes.
 *
 * Body: { status, description?, estimatedEra?, suggestedTags? }
 */

import { getStore } from '@/lib/db';
import { fail, ok } from '@/lib/server/http';
import type { AiEnrichment } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DECISIONS: AiEnrichment['status'][] = ['accepted', 'edited', 'rejected', 'pending'];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('Expected a JSON body.', 415);
  }

  const status = String(body.status ?? '') as AiEnrichment['status'];
  if (!DECISIONS.includes(status)) {
    return fail(`status must be one of: ${DECISIONS.join(', ')}.`, 422);
  }

  const store = await getStore();
  const item = await store.getHeritage(params.id);
  if (!item) return fail(`No heritage item with id ${params.id}.`, 404, 'not_found');
  if (!item.aiEnrichment) {
    return fail('This item has no AI suggestion to review.', 409, 'no_enrichment');
  }

  const enrichment: AiEnrichment = {
    ...item.aiEnrichment,
    status,
    // An edit replaces the wording but keeps the provenance of the suggestion:
    // the source stays recorded, so an edited description is never mistaken
    // for something the model produced.
    description:
      typeof body.description === 'string' && body.description.trim().length > 0
        ? body.description.trim()
        : item.aiEnrichment.description,
    transcript:
      typeof body.transcript === 'string'
        ? body.transcript.trim() || undefined
        : item.aiEnrichment.transcript,
    estimatedEra:
      typeof body.estimatedEra === 'string' && body.estimatedEra.trim().length > 0
        ? body.estimatedEra.trim()
        : item.aiEnrichment.estimatedEra,
    suggestedTags: Array.isArray(body.suggestedTags)
      ? body.suggestedTags.map(String).slice(0, 8)
      : item.aiEnrichment.suggestedTags,
  };

  const updated = await store.updateHeritage(params.id, { aiEnrichment: enrichment });
  if (!updated) return fail('Could not record the decision.', 500);

  return ok(updated.aiEnrichment);
}
