/**
 * Browser-side client for the LegacyChain API.
 *
 * Every call goes through `request()` so the `{ ok, data | error }`
 * envelope is unwrapped in one place and failures always surface as an
 * ApiError carrying the server's own message.
 */

import type {
  AiEnrichment,
  Attestation,
  AttestationDecision,
  HeritageItem,
  HeritageSummary,
  HeritageType,
  ProtocolStatus,
  ProvenanceRecord,
  VerificationResult,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      `${response.status} ${response.statusText || 'Request failed'}`,
      response.status
    );
  }

  const envelope = payload as
    | { ok: true; data: T }
    | { ok: false; error: { message: string; code?: string } };

  if (!response.ok || !envelope.ok) {
    const error = 'error' in envelope ? envelope.error : undefined;
    throw new ApiError(
      error?.message ?? `Request failed with ${response.status}`,
      response.status,
      error?.code
    );
  }

  return envelope.data;
}

// ---------------------------------------------------------------------------
// Heritage
// ---------------------------------------------------------------------------

export function listHeritage(): Promise<HeritageSummary[]> {
  return request('/api/heritage', { cache: 'no-store' });
}

export function getHeritage(
  id: string
): Promise<HeritageItem & { protocols: ProtocolStatus }> {
  return request(`/api/heritage/${id}`, { cache: 'no-store' });
}

export interface PreserveParams {
  file: File;
  title: string;
  year: string;
  type: HeritageType;
  location?: string;
  story?: string;
  contributorName?: string;
  contributorRelationship?: string;
  aiEnrichment?: AiEnrichment | null;
}

export function preserveHeritage(params: PreserveParams): Promise<HeritageItem> {
  const form = new FormData();
  form.set('file', params.file);
  form.set('title', params.title);
  form.set('year', params.year);
  form.set('type', params.type);
  if (params.location) form.set('location', params.location);
  if (params.story) form.set('story', params.story);
  if (params.contributorName) form.set('contributorName', params.contributorName);
  if (params.contributorRelationship) {
    form.set('contributorRelationship', params.contributorRelationship);
  }
  if (params.aiEnrichment) {
    form.set('aiEnrichment', JSON.stringify(params.aiEnrichment));
  }

  return request('/api/heritage', { method: 'POST', body: form });
}

// ---------------------------------------------------------------------------
// AI enrichment
// ---------------------------------------------------------------------------

export function enrichFile(params: {
  file: File;
  title: string;
  type: HeritageType;
  year?: string;
  location?: string;
  story?: string;
}): Promise<AiEnrichment> {
  const form = new FormData();
  form.set('file', params.file);
  form.set('title', params.title);
  form.set('type', params.type);
  if (params.year) form.set('year', params.year);
  if (params.location) form.set('location', params.location);
  if (params.story) form.set('story', params.story);

  return request('/api/ai/enrich', { method: 'POST', body: form });
}

// ---------------------------------------------------------------------------
// Verification and derived versions
// ---------------------------------------------------------------------------

export function verifyFile(params: {
  file: File;
  heritageId?: string;
}): Promise<VerificationResult> {
  const form = new FormData();
  form.set('file', params.file);
  if (params.heritageId) form.set('heritageId', params.heritageId);

  return request('/api/verify', { method: 'POST', body: form });
}

export function registerDerived(params: {
  heritageId: string;
  file: File;
  title: string;
  transformType: string;
  description?: string;
  parentProvenanceId?: string;
}): Promise<{ item: HeritageItem; record: ProvenanceRecord }> {
  const form = new FormData();
  form.set('file', params.file);
  form.set('title', params.title);
  form.set('transformType', params.transformType);
  if (params.description) form.set('description', params.description);
  if (params.parentProvenanceId) {
    form.set('parentProvenanceId', params.parentProvenanceId);
  }

  return request(`/api/heritage/${params.heritageId}/derived`, {
    method: 'POST',
    body: form,
  });
}

// ---------------------------------------------------------------------------
// Attestations
// ---------------------------------------------------------------------------

export function addAttestation(params: {
  heritageId: string;
  attesterName: string;
  relationship: string;
  decision: AttestationDecision;
  statement: string;
  provenanceId?: string;
}): Promise<Attestation> {
  const { heritageId, ...body } = params;
  return request(`/api/heritage/${heritageId}/attestations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
