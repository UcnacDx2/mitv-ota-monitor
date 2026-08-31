import { env } from 'cloudflare:workers';
import { getPublicConfig, getRuntimeConfig } from '@/lib/ota/config';
import { readStatus, writeStatus } from '@/lib/ota/store';
import { checkXiaomiOta } from '@/lib/ota/xiaomi';

export const dynamic = 'force-dynamic';

export async function GET() {
  let status = await readStatus(env.DB);
  if (!status) {
    status = await checkXiaomiOta(getRuntimeConfig(env));
    await writeStatus(env.DB, status);
  }
  return Response.json(
    { config: getPublicConfig(env), status },
    { headers: { 'cache-control': 'no-store' } },
  );
}
