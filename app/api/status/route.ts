import { env } from 'cloudflare:workers';
import { getPublicConfig } from '@/lib/ota/config';
import { readStatus } from '@/lib/ota/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await readStatus(env.DB);
  return Response.json(
    { config: getPublicConfig(env), status },
    { headers: { 'cache-control': 'no-store' } },
  );
}
