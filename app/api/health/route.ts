/** Reports which subsystems are live and whether writes actually persist. */

import { NextResponse } from 'next/server';
import { getDatabaseError, getStore } from '@/lib/db';
import { getRuntimeMode } from '@/lib/server/config';
import { getGuardianPublicKey } from '@/lib/server/pqc-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const mode = getRuntimeMode();
  const store = await getStore();
  const items = await store.listHeritage();

  return NextResponse.json({
    ok: true,
    service: 'legacychain',
    mode,
    storage: {
      driver: store.driver,
      durable: store.durable,
      note: store.durable
        ? 'Writes persist.'
        : 'Running in memory — set DATABASE_URL so uploads survive a restart.',
      // Present only when DATABASE_URL was set but could not be used.
      databaseError: getDatabaseError(),
    },
    // Which settings the running process can actually see. NAMES ONLY —
    // never values. This is the difference between "the variable is missing"
    // and "the variable is set but wrong", which is otherwise invisible from
    // outside the hosting dashboard.
    config: describeEnvironment(),
    heritageCount: items.length,
    pqc: {
      algorithm: 'ML-DSA-44 (FIPS-204)',
      guardianPublicKey: `${getGuardianPublicKey().slice(0, 32)}…`,
    },
  });
}

const EXPECTED_VARS = [
  'DATABASE_URL',
  'NEURO_HOST',
  'NEURO_USERNAME',
  'NEURO_ACCOUNT_PASSWORD',
  'NEURO_LEGAL_ID',
  'PQC_GUARDIAN_SEED',
  'ANTHROPIC_API_KEY',
  'ETH_RPC_URL',
  'ETH_PRIVATE_KEY',
  'HERITAGE_REGISTRY_ADDRESS',
  'NEXT_PUBLIC_BASE_URL',
];

function describeEnvironment() {
  const present: string[] = [];
  const missing: string[] = [];

  for (const name of EXPECTED_VARS) {
    const value = process.env[name];
    if (typeof value === 'string' && value.length > 0) present.push(name);
    else missing.push(name);
  }

  // Any other *_URL variable the host injected, so a database connected under
  // a custom prefix (STORAGE_URL, NEON_URL, ...) is visible here by name.
  const otherUrlVars = Object.keys(process.env)
    .filter((name) => name.endsWith('_URL') && !EXPECTED_VARS.includes(name))
    .sort();

  return { present, missing, otherUrlVars, vercelEnv: process.env.VERCEL_ENV ?? null };
}
