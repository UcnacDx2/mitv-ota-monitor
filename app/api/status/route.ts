import { env } from 'cloudflare:workers';
import { getPublicConfig, getRuntimeConfig } from '@/lib/ota/config';
import { readStatus, writeStatus } from '@/lib/ota/store';
import { checkXiaomiOta } from '@/lib/ota/xiaomi';

export const dynamic = 'force-dynamic';

export async function GET() {
  const config = getPublicConfig(env);
  let status = await readStatus(env.DB);
  if (!status || status.currentVersion !== config.currentVersion) {
    status = await checkXiaomiOta(getRuntimeConfig(env));
    await writeStatus(env.DB, status);
  }
  return Response.json(
    { config, status },
    { headers: { 'cache-control': 'no-store' } },
  );
}
