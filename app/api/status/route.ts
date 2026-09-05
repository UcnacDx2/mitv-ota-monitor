import { env } from 'cloudflare:workers';
import { getPublicConfig } from '@/lib/ota/config';
import { readScheduledCheckState } from '@/lib/ota/scheduled';
import { readStatus } from '@/lib/ota/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [status, scheduler] = await Promise.all([
    readStatus(env.DB),
    readScheduledCheckState(env.DB),
  ]);
  return Response.json(
    { config: getPublicConfig(env), status, scheduler },
    { headers: { 'cache-control': 'no-store' } },
  );
}
