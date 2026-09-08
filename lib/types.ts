/**
 * Heritage domain types for LegacyChain.
 *
 * These types model the core concepts of the family heritage vault:
 * heritage items, provenance records, blockchain anchors, family
 * attestations, verification results, and AI enrichment.
 *
 * The central idea: an ORIGINAL is preserved forever, and every
 * transformation of it becomes a DERIVED record that links back to its
 * parent. AI can transform the artifact; it cannot rewrite the chain.
 */

export type HeritageType = 'Photograph' | 'Audio' | 'Document' | 'Video' | 'Letter';

export type VerificationStatus =
  | 'Original Preserved'
  | 'Verified'
  | 'Pending Verification'
  | 'Derived Version'
  | 'Unverified';

export type ProvenanceKind = 'ORIGINAL' | 'DERIVED';

// ---------------------------------------------------------------------------
// The three Alexandria protocols
// ---------------------------------------------------------------------------

/**
 * Protocol status for a single record. Every heritage record aims to
 * satisfy all three: a SHA-256 fingerprint, an ML-DSA post-quantum
 * signature, and an immutable on-chain anchor.
 */
export interface ProtocolStatus {
  digitalDna: boolean;
  pqcSignature: boolean;
  blockchain: boolean;
}

export interface PqcSignature {
  status: 'Verified' | 'Pending' | 'Unsigned';
  algorithm: string;
  /** First bytes of the signature, hex encoded, for compact display */
  signaturePreview: string;
  /** Base64-encoded ML-DSA-44 signature — empty if not yet signed */
  signatureBase64?: string;
  /** Base64-encoded ML-DSA-44 public key used to verify the signature */
  publicKeyBase64?: string;
  /** The exact provenance payload that was signed */
  signedData?: SignedProvenanceData;
}

export interface SignedProvenanceData {
  heritageId: string;
  fileHash: string;
  timestamp: string;
  guardian: string;
  parentVersion?: string;
}

/**
 * Proof that a record's hash was written to a public blockchain.
 *
 * `anchored` means a real transaction was mined. `simulated` means the
 * node has no wallet configured, so the anchor was computed locally and
 * is clearly labelled as such in the UI — never presented as on-chain.
 */
export type AnchorStatus = 'anchored' | 'simulated' | 'pending' | 'failed';

export interface BlockchainAnchor {
  status: AnchorStatus;
  network: string;
  chainId: number;
  /** keccak256 of the canonical record payload — what is stored on-chain */
  recordId: string;
  /** SHA-256 file fingerprint, as bytes32 */
  fileHash: string;
  contractAddress?: string;
  txHash?: string;
  blockNumber?: number;
  explorerUrl?: string;
  anchoredAt: string;
  /** Present when status is 'failed' or 'simulated' — why it is not on-chain */
  note?: string;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/**
 * The person who preserved a record.
 *
 * `identityStatus` defaults to 'Unverified' and only becomes verified when an
 * identity provider actually backs it. A badge the application cannot check
 * is worse than no badge.
 */
export interface Contributor {
  name: string;
  identityStatus: 'Verified Identity' | 'Pending' | 'Unverified';
  relationship: string;
  /** Neuro Legal Identity id, when the guardian has one */
  legalId?: string;
  /** Neuron that issued the identity, e.g. sandbox1.neuro-tech.io */
  identityProvider?: string;
}

export type AttestationDecision = 'confirm' | 'correct' | 'dispute';

/**
 * A human statement about what a heritage item actually is.
 *
 * Cryptography answers "has this file changed?". Only people can answer
 * "who is this?" — attestations record those human claims alongside the
 * proof, without ever overwriting the original record.
 */
export interface Attestation {
  id: string;
  heritageId: string;
  /** Optional: attests to one specific provenance record */
  provenanceId?: string;
  attesterName: string;
  relationship: string;
  decision: AttestationDecision;
  statement: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export interface ProvenanceRecord {
  id: string;
  heritageId: string;
  year: number;
  title: string;
  kind: ProvenanceKind;
  description: string;
  /** SHA-256 of the file this record describes */
  digitalDna: string;
  /** ID of the provenance record this was derived from */
  derivedFromId?: string;
  /** e.g. "AI Restoration", "AI Colorization", "Scan" */
  transformType?: string;
  pqcSignature?: PqcSignature;
  blockchain?: BlockchainAnchor;
  createdAt: string;

  // Convenience flags used by the timeline UI
  hasDigitalDna: boolean;
  hasPqc: boolean;
  hasProvenance: boolean;
}

export interface AiEnrichment {
  /**
   * What the AI read off the artifact — the handwriting in a letter, the
   * words in a recording. This is the point of AI here: it makes an
   * unreadable source readable. It is a *reading of* the source, never a
   * replacement for it, so it is stored beside the original and always
   * traceable back to the exact bytes it was read from.
   */
  transcript?: string;
  estimatedEra: string;
  suggestedTags: string[];
  description: string;
  status: 'pending' | 'accepted' | 'edited' | 'rejected';
  note: string;
  /** Which model produced this, or 'heuristic' when AI is not configured */
  source: string;
}

// ---------------------------------------------------------------------------
// Heritage items
// ---------------------------------------------------------------------------

export interface HeritageItem {
  id: string;
  title: string;
  year: number;
  type: HeritageType;
  location: string;
  story: string;
  /** URL the UI renders — either an uploaded file route or a remote image */
  imageUrl: string;
  verificationStatus: VerificationStatus;
  digitalDna: string;
  pqcSignature: PqcSignature;
  blockchain?: BlockchainAnchor;
  contributor: Contributor;
  provenance: ProvenanceRecord[];
  attestations: Attestation[];
  aiEnrichment?: AiEnrichment;
  isOriginal: boolean;
  createdAt: string;
}

/** Compact shape used by list views — omits provenance and attestations. */
export interface HeritageSummary {
  id: string;
  title: string;
  year: number;
  type: HeritageType;
  location: string;
  imageUrl: string;
  verificationStatus: VerificationStatus;
  digitalDna: string;
  isOriginal: boolean;
  protocols: ProtocolStatus;
  derivedCount: number;
  attestationCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type VerificationStatusCode = 'authentic' | 'different' | 'unknown';

export interface VerificationResult {
  status: VerificationStatusCode;
  message: string;
  uploadedDna: string;
  /** The fingerprint compared against, when a specific item was targeted */
  registeredDna?: string;
  matchPercentage: number;
  /** Set when the uploaded file matched a record somewhere in the vault */
  match?: {
    heritageId: string;
    heritageTitle: string;
    provenanceId: string;
    provenanceTitle: string;
    kind: ProvenanceKind;
  };
  /** Set when the file did not match — the original it can be derived from */
  candidateOriginal?: {
    heritageId: string;
    heritageTitle: string;
    provenanceId: string;
    digitalDna: string;
  };
}

export interface ProcessingStep {
  id: number;
  label: string;
  status: 'pending' | 'active' | 'complete';
}

export interface TimelineEntry {
  year: number;
  title: string;
  type: string;
}
