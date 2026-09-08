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
