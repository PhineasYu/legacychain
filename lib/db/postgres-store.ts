/**
 * Neon / PostgreSQL implementation of HeritageStore.
 *
 * Uses @neondatabase/serverless, which speaks HTTP rather than holding a
 * TCP pool — the right fit for Next.js route handlers running on
 * serverless platforms where connections cannot be reused.
 */

import 'server-only';
import { neon } from '@neondatabase/serverless';
import { DATABASE_URL } from '../server/config';
import { SCHEMA_STATEMENTS } from './schema';
import type {
  Attestation,
  BlockchainAnchor,
  Contributor,
  HeritageItem,
  HeritageType,
  PqcSignature,
  ProvenanceRecord,
  AiEnrichment,
  VerificationStatus,
} from '../types';
import type { HeritageStore, StoredBlob } from './store';

type Row = Record<string, unknown>;
type SqlClient = ReturnType<typeof neon>;

export class PostgresStore implements HeritageStore {
  readonly driver = 'neon-postgres';
  readonly durable = true;

  private readonly sql: SqlClient;
  private initialised = false;

  constructor(connectionString: string = DATABASE_URL) {
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for PostgresStore');
    }
    this.sql = neon(connectionString);
  }

  async init(): Promise<void> {
    if (this.initialised) return;

    // A cheap round-trip that fails fast on a bad connection string.
    await this.sql`SELECT 1`;

    // Apply the schema on connect. Every statement is idempotent, so pointing
    // at a fresh Neon branch is all the setup there is — no migration step to
    // forget between setting DATABASE_URL and the first request. Sent as one
    // transaction to keep it to a single round trip on a cold start.
    await this.sql.transaction(
      SCHEMA_STATEMENTS.map((statement) => this.sql(statement))
    );

    this.initialised = true;
  }

  async listHeritage(): Promise<HeritageItem[]> {
    const items = (await this.sql`
      SELECT * FROM heritage_items ORDER BY created_at DESC
    `) as Row[];
    if (items.length === 0) return [];

    const ids = items.map((row) => row.id as string);
    const provenance = (await this.sql`
      SELECT * FROM provenance_records
      WHERE heritage_id = ANY(${ids})
      ORDER BY created_at ASC
    `) as Row[];
    const attestations = (await this.sql`
      SELECT * FROM attestations
      WHERE heritage_id = ANY(${ids})
      ORDER BY created_at ASC
    `) as Row[];

    return items.map((row) =>
      toHeritageItem(
        row,
        provenance.filter((p) => p.heritage_id === row.id),
        attestations.filter((a) => a.heritage_id === row.id)
      )
    );
  }

  async getHeritage(id: string): Promise<HeritageItem | null> {
    const rows = (await this.sql`
      SELECT * FROM heritage_items WHERE id = ${id}
    `) as Row[];
    if (rows.length === 0) return null;

    const provenance = (await this.sql`
      SELECT * FROM provenance_records
      WHERE heritage_id = ${id}
      ORDER BY created_at ASC
    `) as Row[];
    const attestations = (await this.sql`
      SELECT * FROM attestations
      WHERE heritage_id = ${id}
      ORDER BY created_at ASC
    `) as Row[];

    return toHeritageItem(rows[0], provenance, attestations);
  }

  async createHeritage(item: HeritageItem): Promise<HeritageItem> {
    await this.sql`
      INSERT INTO heritage_items (
        id, title, year, type, location, story, image_url,
        verification_status, digital_dna, is_original,
        contributor, pqc_signature, blockchain, ai_enrichment, created_at
      ) VALUES (
        ${item.id}, ${item.title}, ${item.year}, ${item.type},
        ${item.location}, ${item.story}, ${item.imageUrl},
        ${item.verificationStatus}, ${item.digitalDna}, ${item.isOriginal},
        ${JSON.stringify(item.contributor)},
        ${JSON.stringify(item.pqcSignature ?? null)},
        ${JSON.stringify(item.blockchain ?? null)},
        ${JSON.stringify(item.aiEnrichment ?? null)},
        ${item.createdAt}
      )
    `;

    for (const record of item.provenance ?? []) {
      await this.addProvenanceRecord(record);
    }
    return item;
  }

  async updateHeritage(
    id: string,
    patch: Partial<HeritageItem>
  ): Promise<HeritageItem | null> {
    // Only the mutable presentation/status columns are patchable; the
    // fingerprint and provenance chain are append-only by design.
    const current = await this.getHeritage(id);
    if (!current) return null;

    const next = { ...current, ...patch, id };
    await this.sql`
      UPDATE heritage_items SET
        title               = ${next.title},
        year                = ${next.year},
        type                = ${next.type},
        location            = ${next.location},
        story               = ${next.story},
        image_url           = ${next.imageUrl},
        verification_status = ${next.verificationStatus},
        pqc_signature       = ${JSON.stringify(next.pqcSignature ?? null)},
        blockchain          = ${JSON.stringify(next.blockchain ?? null)},
        ai_enrichment       = ${JSON.stringify(next.aiEnrichment ?? null)}
      WHERE id = ${id}
    `;
    return next;
  }

  async addProvenanceRecord(record: ProvenanceRecord): Promise<ProvenanceRecord> {
    await this.sql`
      INSERT INTO provenance_records (
        id, heritage_id, year, title, kind, description, digital_dna,
        derived_from_id, transform_type, pqc_signature, blockchain, created_at
      ) VALUES (
        ${record.id}, ${record.heritageId}, ${record.year}, ${record.title},
        ${record.kind}, ${record.description}, ${record.digitalDna},
        ${record.derivedFromId ?? null}, ${record.transformType ?? null},
        ${JSON.stringify(record.pqcSignature ?? null)},
        ${JSON.stringify(record.blockchain ?? null)},
        ${record.createdAt}
      )
    `;
    return record;
  }

  async findProvenanceByDna(digitalDna: string): Promise<ProvenanceRecord | null> {
    const rows = (await this.sql`
      SELECT * FROM provenance_records
      WHERE LOWER(digital_dna) = ${digitalDna.toLowerCase()}
      ORDER BY created_at ASC
      LIMIT 1
    `) as Row[];
    return rows.length > 0 ? toProvenanceRecord(rows[0]) : null;
  }

  async addAttestation(attestation: Attestation): Promise<Attestation> {
    await this.sql`
      INSERT INTO attestations (
        id, heritage_id, provenance_id, attester_name,
        relationship, decision, statement, created_at
      ) VALUES (
        ${attestation.id}, ${attestation.heritageId},
        ${attestation.provenanceId ?? null}, ${attestation.attesterName},
        ${attestation.relationship}, ${attestation.decision},
        ${attestation.statement}, ${attestation.createdAt}
      )
    `;
    return attestation;
  }

  async listAttestations(heritageId: string): Promise<Attestation[]> {
    const rows = (await this.sql`
      SELECT * FROM attestations
      WHERE heritage_id = ${heritageId}
      ORDER BY created_at ASC
    `) as Row[];
    return rows.map(toAttestation);
  }

  // -------------------------------------------------------------------------
  // Preserved originals
  // -------------------------------------------------------------------------

  async putBlob(blob: StoredBlob): Promise<void> {
    // Bytes travel as base64 and are decoded into BYTEA by Postgres, which
    // keeps binary data out of the HTTP driver's text protocol.
    const base64 = Buffer.from(blob.bytes).toString('base64');
    await this.sql`
      INSERT INTO heritage_files (id, content_type, original_name, size, bytes)
      VALUES (
        ${blob.id}, ${blob.contentType}, ${blob.originalName},
        ${blob.size}, decode(${base64}, 'base64')
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async getBlob(id: string): Promise<StoredBlob | null> {
    const rows = (await this.sql`
      SELECT id, content_type, original_name, size,
             encode(bytes, 'base64') AS bytes_base64
      FROM heritage_files
      WHERE id = ${id}
    `) as Row[];
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id as string,
      contentType: (row.content_type as string) ?? 'application/octet-stream',
      originalName: (row.original_name as string) ?? id,
      size: Number(row.size),
      bytes: new Uint8Array(Buffer.from(row.bytes_base64 as string, 'base64')),
    };
  }
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

function toHeritageItem(
  row: Row,
  provenanceRows: Row[],
  attestationRows: Row[]
): HeritageItem {
  return {
    id: row.id as string,
    title: row.title as string,
    year: Number(row.year),
    type: row.type as HeritageType,
    location: (row.location as string) ?? '',
    story: (row.story as string) ?? '',
    imageUrl: (row.image_url as string) ?? '',
    verificationStatus: row.verification_status as VerificationStatus,
    digitalDna: row.digital_dna as string,
    isOriginal: Boolean(row.is_original),
    contributor: parseJson<Contributor>(row.contributor) ?? {
      name: 'Unknown',
      identityStatus: 'Pending',
      relationship: '',
    },
    pqcSignature: parseJson<PqcSignature>(row.pqc_signature) ?? {
      status: 'Unsigned',
      algorithm: 'ML-DSA-44 (FIPS-204)',
      signaturePreview: '',
    },
    blockchain: parseJson<BlockchainAnchor>(row.blockchain) ?? undefined,
    aiEnrichment: parseJson<AiEnrichment>(row.ai_enrichment) ?? undefined,
    provenance: provenanceRows.map(toProvenanceRecord),
    attestations: attestationRows.map(toAttestation),
    createdAt: toIso(row.created_at),
  };
}

function toProvenanceRecord(row: Row): ProvenanceRecord {
  const pqcSignature = parseJson<PqcSignature>(row.pqc_signature) ?? undefined;
  const blockchain = parseJson<BlockchainAnchor>(row.blockchain) ?? undefined;
  return {
    id: row.id as string,
    heritageId: row.heritage_id as string,
    year: Number(row.year),
    title: row.title as string,
    kind: row.kind as ProvenanceRecord['kind'],
    description: (row.description as string) ?? '',
    digitalDna: row.digital_dna as string,
    derivedFromId: (row.derived_from_id as string) ?? undefined,
    transformType: (row.transform_type as string) ?? undefined,
    pqcSignature,
    blockchain,
    createdAt: toIso(row.created_at),
    hasDigitalDna: Boolean(row.digital_dna),
    hasPqc: pqcSignature?.status === 'Verified',
    hasProvenance: true,
  };
}

function toAttestation(row: Row): Attestation {
  return {
    id: row.id as string,
    heritageId: row.heritage_id as string,
    provenanceId: (row.provenance_id as string) ?? undefined,
    attesterName: row.attester_name as string,
    relationship: (row.relationship as string) ?? '',
    decision: row.decision as Attestation['decision'],
    statement: (row.statement as string) ?? '',
    createdAt: toIso(row.created_at),
  };
}

/** JSONB comes back already parsed; a text column comes back as a string. */
function parseJson<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return new Date().toISOString();
}
