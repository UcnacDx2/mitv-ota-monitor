import { env } from 'cloudflare:workers';
import { getRuntimeConfig } from '@/lib/ota/config';
import { writeStatus } from '@/lib/ota/store';
import { checkXiaomiOta } from '@/lib/ota/xiaomi';

export async function POST(request: Request) {
  if (!env.CHECK_TOKEN) {
    return Response.json({ error: 'Manual checks are disabled' }, { status: 404 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${env.CHECK_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const status = await checkXiaomiOta(getRuntimeConfig(env));
  await writeStatus(env.DB, status);
  return Response.json(status, { status: status.ok ? 200 : 502 });
}
