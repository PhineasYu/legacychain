/**
 * Answering "is this the original?" for an uploaded file.
 *
 * The uploaded bytes are fingerprinted and looked up across every
 * provenance record in the vault. There are exactly three answers:
 *
 *   authentic — the fingerprint matches a record that was registered
 *   different — no record matches, but the file targets a known item and
 *               can be registered as a derived version
 *   unknown   — nothing in the vault relates to this file
 *
 * "different" is deliberately not a failure. A restored or colorized
 * photograph is a real part of a family's history; it just is not the
 * original, and the chain should say so.
 */

import 'server-only';
import { createDigitalFingerprint } from '../services/hashing';
import type { HeritageItem, VerificationResult } from '../types';
import { getStore } from '../db';

export async function verifyUpload(params: {
  bytes: Uint8Array;
  /** Optional: verify against one specific heritage item */
  heritageId?: string;
}): Promise<VerificationResult> {
  const store = await getStore();
  const { digest: uploadedDna } = await createDigitalFingerprint(params.bytes);

  const target = params.heritageId
    ? await store.getHeritage(params.heritageId)
    : null;

  // A vault-wide match is authoritative even when a specific item was
  // named — the file genuinely is a registered record, just not that one.
  const match = await store.findProvenanceByDna(uploadedDna);

  if (match) {
    const owner = await store.getHeritage(match.heritageId);
    return {
      status: 'authentic',
      message:
        match.kind === 'ORIGINAL'
          ? 'This file is the registered original. Its fingerprint matches the preserved record exactly.'
          : 'This file matches a registered derived version. Its provenance links back to the original.',
      uploadedDna,
      registeredDna: match.digitalDna,
      matchPercentage: 100,
      match: {
        heritageId: match.heritageId,
        heritageTitle: owner?.title ?? match.heritageId,
        provenanceId: match.id,
        provenanceTitle: match.title,
        kind: match.kind,
      },
    };
  }

  if (target) {
    return {
      status: 'different',
      message:
        'This file does not match the registered original. It may be a restored, colorized or otherwise transformed version — register it as a derived version to preserve that history.',
      uploadedDna,
      registeredDna: target.digitalDna,
      matchPercentage: 0,
      candidateOriginal: toCandidate(target),
    };
  }

  return {
    status: 'unknown',
    message:
      'No record in this vault has that fingerprint. If this file is a version of something already preserved, select the heritage item to compare it against.',
    uploadedDna,
    matchPercentage: 0,
  };
}

function toCandidate(item: HeritageItem): VerificationResult['candidateOriginal'] {
  const original =
    item.provenance.find((record) => record.kind === 'ORIGINAL') ?? item.provenance[0];
  return {
    heritageId: item.id,
    heritageTitle: item.title,
    provenanceId: original?.id ?? '',
    digitalDna: original?.digitalDna ?? item.digitalDna,
  };
}
