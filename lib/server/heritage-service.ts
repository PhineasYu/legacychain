/**
 * The preservation pipeline.
 *
 * This is the one place that turns an uploaded file into a preserved,
 * provable heritage record, in a fixed order:
 *
 *     bytes → SHA-256 fingerprint → stored original
 *           → ML-DSA-44 signature → blockchain anchor → database
 *
 * Registering a derived version runs the same pipeline but links the new
 * record to its parent instead of starting a new chain. The original
 * record is never modified — that is the whole point of the product.
 */

import 'server-only';
import { createDigitalFingerprint } from '../services/hashing';
import type {
  AiEnrichment,
  Attestation,
  AttestationDecision,
  Contributor,
  HeritageItem,
  HeritageSummary,
  HeritageType,
  ProtocolStatus,
  ProvenanceRecord,
  SignedProvenanceData,
} from '../types';
import { getStore } from '../db';
import { anchorRecord } from './blockchain';
import { storeOriginal } from './files';
import { signRecord } from './pqc-server';

export interface CreateHeritageInput {
  title: string;
  year: number;
  type: HeritageType;
  location?: string;
  story?: string;
  contributor?: Partial<Contributor>;
  aiEnrichment?: AiEnrichment;
  file: {
    bytes: Uint8Array;
    contentType: string;
    originalName: string;
  };
}

export interface RegisterDerivedInput {
  heritageId: string;
  /** Provenance record this version was derived from; defaults to the original */
  parentProvenanceId?: string;
  title: string;
  transformType: string;
  description?: string;
  file: {
    bytes: Uint8Array;
    contentType: string;
    originalName: string;
  };
}

const DEFAULT_CONTRIBUTOR: Contributor = {
  name: 'Family Guardian',
  identityStatus: 'Verified Identity',
  relationship: 'Guardian',
};

// ---------------------------------------------------------------------------
// Preserving an original
// ---------------------------------------------------------------------------

export async function preserveHeritage(
  input: CreateHeritageInput
): Promise<HeritageItem> {
  const store = await getStore();
  const now = new Date().toISOString();

  // 1. Digital DNA — the fingerprint of the exact bytes supplied.
  const { digest } = await createDigitalFingerprint(input.file.bytes);

  // 2. Preserve the original file itself, addressed by its fingerprint.
  const stored = await storeOriginal({
    digest,
    bytes: input.file.bytes,
    contentType: input.file.contentType,
    originalName: input.file.originalName,
  });

  const heritageId = newId('heritage');
  const provenanceId = newId('prov');
  const contributor: Contributor = { ...DEFAULT_CONTRIBUTOR, ...input.contributor };

  // 3. Post-quantum signature over the provenance claim.
  const signedData: SignedProvenanceData = {
    heritageId,
    fileHash: digest,
    timestamp: now,
    guardian: contributor.name,
  };
  const pqcSignature = signRecord(signedData);

  // 4. Public witness. Never fatal — see anchorRecord.
  const blockchain = await anchorRecord({
    provenanceId,
    signedData,
    pqcSignatureBase64: pqcSignature.signatureBase64,
  });

  const originalRecord: ProvenanceRecord = {
    id: provenanceId,
    heritageId,
    year: input.year,
    title: `Original ${input.title}`,
    kind: 'ORIGINAL',
    description:
      input.story?.trim() ||
      `The original ${input.type.toLowerCase()} was preserved with a SHA-256 fingerprint, a post-quantum signature, and an immutable anchor.`,
    digitalDna: digest,
    pqcSignature,
    blockchain,
    createdAt: now,
    hasDigitalDna: true,
    hasPqc: pqcSignature.status === 'Verified',
    hasProvenance: blockchain.status === 'anchored' || blockchain.status === 'simulated',
  };

  const item: HeritageItem = {
    id: heritageId,
    title: input.title,
    year: input.year,
    type: input.type,
    location: input.location ?? '',
    story: input.story ?? '',
    imageUrl: stored.url,
    verificationStatus: 'Original Preserved',
    digitalDna: digest,
    pqcSignature,
    blockchain,
    contributor,
    provenance: [originalRecord],
    attestations: [],
    aiEnrichment: input.aiEnrichment,
    isOriginal: true,
    createdAt: now,
  };

  // 5. Persist last, so nothing half-preserved is ever recorded.
  await store.createHeritage(item);
  return item;
}

// ---------------------------------------------------------------------------
// Registering a derived version
// ---------------------------------------------------------------------------

/**
 * Adds a transformed version — an AI restoration, a colorization, a crop —
 * to an existing item's chain.
 *
 * The derived file gets its own fingerprint, its own signature and its own
 * anchor, and points back at its parent. The original record is untouched.
 */
export async function registerDerivedVersion(
  input: RegisterDerivedInput
): Promise<{ item: HeritageItem; record: ProvenanceRecord }> {
  const store = await getStore();
  const item = await store.getHeritage(input.heritageId);
  if (!item) {
    throw new HeritageNotFoundError(input.heritageId);
  }

  const parent =
    item.provenance.find((record) => record.id === input.parentProvenanceId) ??
    item.provenance.find((record) => record.kind === 'ORIGINAL') ??
    item.provenance[0];
  if (!parent) {
    throw new Error(`Heritage item ${input.heritageId} has no provenance to derive from`);
  }

  const now = new Date().toISOString();
  const { digest } = await createDigitalFingerprint(input.file.bytes);

  if (digest.toLowerCase() === parent.digitalDna.toLowerCase()) {
    throw new IdenticalToParentError(parent.id);
  }

  await storeOriginal({
    digest,
    bytes: input.file.bytes,
    contentType: input.file.contentType,
    originalName: input.file.originalName,
  });

  const provenanceId = newId('prov');
  const signedData: SignedProvenanceData = {
    heritageId: item.id,
    fileHash: digest,
    timestamp: now,
    guardian: item.contributor.name,
    parentVersion: parent.digitalDna,
  };
  const pqcSignature = signRecord(signedData);

  const blockchain = await anchorRecord({
    provenanceId,
    signedData,
    pqcSignatureBase64: pqcSignature.signatureBase64,
    parentProvenanceId: parent.id,
  });

  const record: ProvenanceRecord = {
    id: provenanceId,
    heritageId: item.id,
    year: new Date().getFullYear(),
    title: input.title,
    kind: 'DERIVED',
    description:
      input.description?.trim() ||
      `A ${input.transformType.toLowerCase()} of "${parent.title}". This version has its own fingerprint and links back to the original, which remains the source of truth.`,
    digitalDna: digest,
    derivedFromId: parent.id,
    transformType: input.transformType,
    pqcSignature,
    blockchain,
    createdAt: now,
    hasDigitalDna: true,
    hasPqc: pqcSignature.status === 'Verified',
    hasProvenance: true,
  };

  await store.addProvenanceRecord(record);

  const updated = await store.getHeritage(item.id);
  return { item: updated ?? item, record };
}

// ---------------------------------------------------------------------------
// Attestations
// ---------------------------------------------------------------------------

export async function addAttestation(input: {
  heritageId: string;
  provenanceId?: string;
  attesterName: string;
  relationship: string;
  decision: AttestationDecision;
  statement: string;
}): Promise<Attestation> {
  const store = await getStore();
  const item = await store.getHeritage(input.heritageId);
  if (!item) throw new HeritageNotFoundError(input.heritageId);

  const attestation: Attestation = {
    id: newId('att'),
    heritageId: input.heritageId,
    provenanceId: input.provenanceId,
    attesterName: input.attesterName,
    relationship: input.relationship,
    decision: input.decision,
    statement: input.statement,
    createdAt: new Date().toISOString(),
  };

  return store.addAttestation(attestation);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function listHeritageSummaries(): Promise<HeritageSummary[]> {
  const store = await getStore();
  const items = await store.listHeritage();
  return items.map(toSummary);
}

export function toSummary(item: HeritageItem): HeritageSummary {
  return {
    id: item.id,
    title: item.title,
    year: item.year,
    type: item.type,
    location: item.location,
    imageUrl: item.imageUrl,
    verificationStatus: item.verificationStatus,
    digitalDna: item.digitalDna,
    isOriginal: item.isOriginal,
    protocols: getProtocolStatus(item),
    derivedCount: item.provenance.filter((r) => r.kind === 'DERIVED').length,
    attestationCount: item.attestations.length,
    createdAt: item.createdAt,
  };
}

/** The three Alexandria protocols, as satisfied by this item's original record. */
export function getProtocolStatus(item: HeritageItem): ProtocolStatus {
  return {
    digitalDna: Boolean(item.digitalDna),
    pqcSignature: item.pqcSignature?.status === 'Verified',
    blockchain:
      item.blockchain?.status === 'anchored' || item.blockchain?.status === 'simulated',
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class HeritageNotFoundError extends Error {
  constructor(id: string) {
    super(`Heritage item not found: ${id}`);
    this.name = 'HeritageNotFoundError';
  }
}

export class IdenticalToParentError extends Error {
  constructor(parentId: string) {
    super(
      `This file is byte-for-byte identical to ${parentId} — it is the same version, not a derived one.`
    );
    this.name = 'IdenticalToParentError';
  }
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
