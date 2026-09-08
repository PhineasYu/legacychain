/**
 * GET /api/certificate/[id]/qr — QR code pointing at the public certificate.
 *
 * Printed on the certificate so a physical copy — an album page, a framed
 * print — can be checked against the vault by anyone holding it.
 */

import QRCode from 'qrcode';
import { getStore } from '@/lib/db';
import { PUBLIC_BASE_URL } from '@/lib/server/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const store = await getStore();
  const item = await store.getHeritage(params.id);
  if (!item) return new Response('Not found', { status: 404 });

  const svg = await QRCode.toString(`${PUBLIC_BASE_URL}/certificate/${item.id}`, {
    type: 'svg',
    margin: 1,
    width: 240,
    color: { dark: '#2b231d', light: '#00000000' },
  });

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
