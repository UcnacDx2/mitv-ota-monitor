import { env } from 'cloudflare:workers';
import { runAllChecks } from '@/lib/ota/monitor';

export async function POST(request: Request) {
  if (!env.CHECK_TOKEN) {
    return Response.json({ error: 'Manual checks are disabled' }, { status: 404 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${env.CHECK_TOKEN}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await runAllChecks(env);
  return Response.json(result, { status: result.failed ? 502 : 200 });
}
