/** GET /api/heritage/[id] — full record with provenance and attestations. */

import { getStore } from '@/lib/db';
import { getProtocolStatus } from '@/lib/server/heritage-service';
import { fail, ok } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const store = await getStore();
  const item = await store.getHeritage(params.id);
  if (!item) return fail(`No heritage item with id ${params.id}.`, 404, 'not_found');

  return ok({ ...item, protocols: getProtocolStatus(item) });
}

/**
 * DELETE /api/heritage/[id] — remove an item from the private vault.
 *
 * Exists so a guardian can withdraw their own material, and so a demo can be
 * reset between rehearsals. Anything already anchored on a public chain stays
 * anchored — this removes the private record, not the public proof.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const store = await getStore();
  const removed = await store.deleteHeritage(params.id);
  if (!removed) return fail(`No heritage item with id ${params.id}.`, 404, 'not_found');
  return ok({ id: params.id, removed: true });
}
