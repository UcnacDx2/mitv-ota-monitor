import { env } from 'cloudflare:workers';
import { listCommunityModels, updateCommunityModelMetadata } from '@/lib/ota/store';

const VERSION_VALUE = /^[A-Za-z0-9._-]{3,96}$/;
const LANG_VALUE = /^[A-Za-z]{2}_[A-Za-z]{2}$/;

function authorized(request: Request) {
  return !!env.CHECK_TOKEN && request.headers.get('authorization') === `Bearer ${env.CHECK_TOKEN}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ models: await listCommunityModels(env.DB) });
}

export async function PATCH(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const input = await request.json() as Record<string, unknown>;
    const id = typeof input.id === 'string' ? input.id.trim() : '';
    const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
    const currentVersion = typeof input.currentVersion === 'string' ? input.currentVersion.trim() : '';
    const latestRaw = typeof input.latestVersion === 'string' ? input.latestVersion.trim() : '';
    const lang = typeof input.lang === 'string' ? input.lang.trim() : '';
    if (!id || !displayName || displayName.length > 80) throw new Error('机型名称不合法');
    if (!VERSION_VALUE.test(currentVersion)) throw new Error('最低版本格式不合法');
    if (latestRaw && !VERSION_VALUE.test(latestRaw)) throw new Error('最新版本格式不合法');
    if (!LANG_VALUE.test(lang)) throw new Error('语言格式不合法');
    await updateCommunityModelMetadata(env.DB, id, {
      displayName,
      currentVersion,
      latestVersion: latestRaw || null,
      lang,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '保存失败' }, { status: 400 });
  }
}
