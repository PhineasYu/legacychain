/**
 * Applies lib/db/schema.sql to the database in DATABASE_URL.
 *
 *   DATABASE_URL=postgres://... npm run db:init
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(path.join(root, 'lib', 'db', 'schema.sql'), 'utf8');

// The HTTP driver runs one statement per call, so split on statement
// boundaries after stripping comment-only lines.
const statements = schema
  .split(/;\s*$/m)
  .map((chunk) =>
    chunk
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim()
  )
  .filter(Boolean);

for (const statement of statements) {
  const label = statement.split('\n')[0].slice(0, 68);
  process.stdout.write(`  ${label}… `);
  await sql.query(statement);
  console.log('ok');
}

console.log(`\nApplied ${statements.length} statements.`);
