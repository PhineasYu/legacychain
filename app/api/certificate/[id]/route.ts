/**
 * GET /api/certificate/[id] — the public, verifiable certificate.
 *
 * Everything needed to check the claims independently is included: the
 * fingerprint, the ML-DSA-44 signature with its public key and the exact
 * signed payload, and the on-chain anchor read back from the registry.
 *
 * The family's private story and location are deliberately NOT here —
 * this document is meant to be shareable.
 */

import { getStore } from '@/lib/db';
import { readAnchor } from '@/lib/server/blockchain';
import { PUBLIC_BASE_URL } from '@/lib/server/config';
import { fail, ok } from '@/lib/server/http';
import { getProtocolStatus } from '@/lib/server/heritage-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const store = await getStore();
  const item = await store.getHeritage(params.id);
  if (!item) return fail(`No heritage item with id ${params.id}.`, 404, 'not_found');

  const anchor = item.blockchain;
  const onChain = anchor
    ? await readAnchor(anchor.recordId, item.digitalDna)
    : { onChain: false, matches: false, note: 'This record was never anchored.' };

  return ok({
    certificateId: item.id,
    title: item.title,
    year: item.year,
    type: item.type,
    issuedAt: item.createdAt,
    guardian: {
      name: item.contributor.name,
      relationship: item.contributor.relationship,
      identityStatus: item.contributor.identityStatus,
    },
    protocols: getProtocolStatus(item),
    digitalDna: {
      algorithm: 'SHA-256',
      digest: item.digitalDna,
    },
    pqcSignature: {
      algorithm: item.pqcSignature.algorithm,
      signatureBase64: item.pqcSignature.signatureBase64,
      publicKeyBase64: item.pqcSignature.publicKeyBase64,
      signedData: item.pqcSignature.signedData,
    },
    blockchain: anchor
      ? { ...anchor, readBack: onChain }
      : null,
    provenance: item.provenance.map((record) => ({
      id: record.id,
      title: record.title,
      kind: record.kind,
      year: record.year,
      transformType: record.transformType,
      digitalDna: record.digitalDna,
      derivedFromId: record.derivedFromId,
      anchorStatus: record.blockchain?.status ?? 'none',
    })),
    attestationCount: item.attestations.length,
    verifyUrl: `${PUBLIC_BASE_URL}/certificate/${item.id}`,
  });
}
