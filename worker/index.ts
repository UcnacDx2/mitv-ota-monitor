import handler from 'vinext/server/fetch-handler';
import { getRuntimeConfig } from '@/lib/ota/config';
import { writeStatus } from '@/lib/ota/store';
import type { RuntimeEnv } from '@/lib/ota/types';
import { checkXiaomiOta } from '@/lib/ota/xiaomi';

async function runCheck(env: RuntimeEnv) {
  const status = await checkXiaomiOta(getRuntimeConfig(env));
  await writeStatus(env.DB, status);
  if (!status.ok) throw new Error(status.error || 'OTA check failed');
}

export default {
  fetch(request: Request, env: RuntimeEnv, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, env: RuntimeEnv, ctx: ExecutionContext) {
    ctx.waitUntil(runCheck(env));
  },
};
