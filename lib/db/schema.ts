/**
 * Database schema, applied automatically when a Postgres connection is made.
 *
 * Every statement is idempotent, so connecting to a fresh Neon branch creates
 * the tables and connecting to an existing one is a no-op. That keeps
 * deployment to a single step: set DATABASE_URL and redeploy.
 *
 * PRIVACY: this database holds the family's private content — stories, names,
 * locations, file bytes. Only hashes ever reach the public blockchain.
 */

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS heritage_items (
     id                  TEXT PRIMARY KEY,
     title               TEXT        NOT NULL,
     year                INTEGER     NOT NULL,
     type                TEXT        NOT NULL,
     location            TEXT        NOT NULL DEFAULT '',
     story               TEXT        NOT NULL DEFAULT '',
     image_url           TEXT        NOT NULL DEFAULT '',
     verification_status TEXT        NOT NULL DEFAULT 'Original Preserved',
     digital_dna         TEXT        NOT NULL,
     is_original         BOOLEAN     NOT NULL DEFAULT TRUE,
     contributor         JSONB       NOT NULL,
     pqc_signature       JSONB,
     blockchain          JSONB,
     ai_enrichment       JSONB,
     created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  `CREATE INDEX IF NOT EXISTS heritage_items_digital_dna_idx
     ON heritage_items (digital_dna)`,

  `CREATE TABLE IF NOT EXISTS provenance_records (
     id              TEXT PRIMARY KEY,
     heritage_id     TEXT        NOT NULL REFERENCES heritage_items (id) ON DELETE CASCADE,
     year            INTEGER     NOT NULL,
     title           TEXT        NOT NULL,
     kind            TEXT        NOT NULL CHECK (kind IN ('ORIGINAL', 'DERIVED')),
     description     TEXT        NOT NULL DEFAULT '',
     digital_dna     TEXT        NOT NULL,
     derived_from_id TEXT        REFERENCES provenance_records (id) ON DELETE SET NULL,
     transform_type  TEXT,
     pqc_signature   JSONB,
     blockchain      JSONB,
     created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  `CREATE INDEX IF NOT EXISTS provenance_records_heritage_id_idx
     ON provenance_records (heritage_id)`,

  `CREATE INDEX IF NOT EXISTS provenance_records_digital_dna_idx
     ON provenance_records (digital_dna)`,

  `CREATE TABLE IF NOT EXISTS attestations (
     id            TEXT PRIMARY KEY,
     heritage_id   TEXT        NOT NULL REFERENCES heritage_items (id) ON DELETE CASCADE,
     provenance_id TEXT        REFERENCES provenance_records (id) ON DELETE SET NULL,
     attester_name TEXT        NOT NULL,
     relationship  TEXT        NOT NULL DEFAULT '',
     decision      TEXT        NOT NULL CHECK (decision IN ('confirm', 'correct', 'dispute')),
     statement     TEXT        NOT NULL DEFAULT '',
     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  `CREATE INDEX IF NOT EXISTS attestations_heritage_id_idx
     ON attestations (heritage_id)`,

  // Preserved original files. Bytes live here rather than on disk so the
  // application can run on a read-only serverless filesystem. The primary key
  // IS the SHA-256 fingerprint, so identical content is stored once.
  `CREATE TABLE IF NOT EXISTS heritage_files (
     id            TEXT PRIMARY KEY,
     content_type  TEXT        NOT NULL DEFAULT 'application/octet-stream',
     original_name TEXT        NOT NULL DEFAULT '',
     size          INTEGER     NOT NULL,
     bytes         BYTEA       NOT NULL,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
];
