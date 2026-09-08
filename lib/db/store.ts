/**
 * Storage contract for the heritage vault.
 *
 * Two drivers implement this:
 *   - PostgresStore (Neon)  — used when DATABASE_URL is set
 *   - LocalStore (JSON file) — zero-config fallback for development
 *
 * Both are addressed only through `getStore()` in ./index so the rest
 * of the application never knows which one is active.
 */

import type {
  Attestation,
  HeritageItem,
  ProvenanceRecord,
} from '../types';

export interface HeritageStore {
  /** Human-readable name of the active driver, surfaced by /api/health */
  readonly driver: string;

  init(): Promise<void>;

  listHeritage(): Promise<HeritageItem[]>;
  getHeritage(id: string): Promise<HeritageItem | null>;
  createHeritage(item: HeritageItem): Promise<HeritageItem>;
  updateHeritage(
    id: string,
    patch: Partial<HeritageItem>
  ): Promise<HeritageItem | null>;

  addProvenanceRecord(record: ProvenanceRecord): Promise<ProvenanceRecord>;
  /** Finds any provenance record — across all items — with this fingerprint. */
  findProvenanceByDna(digitalDna: string): Promise<ProvenanceRecord | null>;

  addAttestation(attestation: Attestation): Promise<Attestation>;
  listAttestations(heritageId: string): Promise<Attestation[]>;
}
