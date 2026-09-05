import handler from 'vinext/server/fetch-handler';
import { runScheduledChecks } from '@/lib/ota/scheduled';
import type { RuntimeEnv } from '@/lib/ota/types';

async function runCheck(env: RuntimeEnv) {
  const run = await runScheduledChecks(env);
  if (run.ran && run.state.ok === false) {
    throw new Error(run.state.error ?? 'scheduled OTA check failed');
  }
}

export default {
  fetch(request: Request, env: RuntimeEnv, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, env: RuntimeEnv, ctx: ExecutionContext) {
    ctx.waitUntil(runCheck(env));
  },
};
