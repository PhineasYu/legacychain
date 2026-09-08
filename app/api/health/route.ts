/** Reports which subsystems are live and which are running in local mode. */

import { NextResponse } from 'next/server';
import { getStore } from '@/lib/db';
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
    storeDriver: store.driver,
    heritageCount: items.length,
    pqc: {
      algorithm: 'ML-DSA-44 (FIPS-204)',
      guardianPublicKey: getGuardianPublicKey().slice(0, 32) + '…',
    },
  });
}
