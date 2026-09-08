/**
 * Family attestations — the human layer of truth.
 *
 * GET  /api/heritage/[id]/attestations
 * POST /api/heritage/[id]/attestations  (JSON)
 *        { attesterName, relationship, decision, statement, provenanceId? }
 *
 * Cryptography proves the file did not change. Only a person can say who
 * is in the photograph. Attestations are stored alongside the record and
 * never overwrite it, so a correction adds to the history rather than
 * replacing it.
 */

import { getStore } from '@/lib/db';
import { addAttestation, HeritageNotFoundError } from '@/lib/server/heritage-service';
import { fail, ok } from '@/lib/server/http';
import type { AttestationDecision } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DECISIONS: AttestationDecision[] = ['confirm', 'correct', 'dispute'];

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const store = await getStore();
  return ok(await store.listAttestations(params.id));
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('Expected a JSON body.', 415);
  }

  const attesterName = String(body.attesterName ?? '').trim();
  const statement = String(body.statement ?? '').trim();
  const decision = String(body.decision ?? '') as AttestationDecision;

  if (!attesterName) return fail('Who is making this attestation?', 422);
  if (!statement) return fail('An attestation needs a statement.', 422);
  if (!DECISIONS.includes(decision)) {
    return fail(`Decision must be one of: ${DECISIONS.join(', ')}.`, 422);
  }

  try {
    const attestation = await addAttestation({
      heritageId: params.id,
      provenanceId: body.provenanceId ? String(body.provenanceId) : undefined,
      attesterName,
      relationship: String(body.relationship ?? '').trim(),
      decision,
      statement,
    });
    return ok(attestation, 201);
  } catch (error) {
    if (error instanceof HeritageNotFoundError) return fail(error.message, 404, 'not_found');
    return fail(
      `Could not record attestation: ${
        error instanceof Error ? error.message : String(error)
      }`,
      500
    );
  }
}

/**
 * DELETE /api/heritage/[id]/attestations?attestationId=... — withdraw a
 * statement from the vault.
 *
 * Anything already anchored stays anchored: the chain records that the
 * statement was made, which is not the vault's to retract.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const attestationId = new URL(request.url).searchParams.get('attestationId');
  if (!attestationId) {
    return fail('Pass ?attestationId= to say which statement to withdraw.', 422);
  }

  const store = await getStore();
  const existing = await store.listAttestations(params.id);
  if (!existing.some((a) => a.id === attestationId)) {
    return fail(`No attestation ${attestationId} on ${params.id}.`, 404, 'not_found');
  }

  await store.deleteAttestation(attestationId);
  return ok({ id: attestationId, removed: true });
}
