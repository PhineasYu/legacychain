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
    heritageCount: items.length,
    pqc: {
      algorithm: 'ML-DSA-44 (FIPS-204)',
      guardianPublicKey: `${getGuardianPublicKey().slice(0, 32)}…`,
    },
  });
}
