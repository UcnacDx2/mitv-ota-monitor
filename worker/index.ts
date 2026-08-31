import handler from 'vinext/server/fetch-handler';
import { runAllChecks } from '@/lib/ota/monitor';
import type { RuntimeEnv } from '@/lib/ota/types';

async function runCheck(env: RuntimeEnv) {
  const result = await runAllChecks(env);
  if (result.failed) throw new Error(`${result.failed}/${result.checked} OTA checks failed`);
}

export default {
  fetch(request: Request, env: RuntimeEnv, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, env: RuntimeEnv, ctx: ExecutionContext) {
    ctx.waitUntil(runCheck(env));
  },
};
