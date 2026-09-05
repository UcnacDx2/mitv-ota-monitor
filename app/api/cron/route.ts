import { env } from 'cloudflare:workers';
import { runScheduledChecks } from '@/lib/ota/scheduled';

export const dynamic = 'force-dynamic';

export async function GET() {
  const run = await runScheduledChecks(env);
  const ok = run.state.ok !== false;

  return Response.json(
    {
      ok,
      ran: run.ran,
      state: run.state,
      result: run.result,
    },
    {
      status: ok ? 200 : 502,
      headers: { 'cache-control': 'no-store' },
    },
  );
}
