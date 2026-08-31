import { env } from 'cloudflare:workers';
import { encryptMonitorCredentials } from '@/lib/ota/credentials';
import { listAdminModels, saveMonitorCredentials, updateCommunityModelMetadata } from '@/lib/ota/store';

const MODEL_VALUE = /^[A-Za-z0-9._-]{2,96}$/;
const VERSION_VALUE = /^[A-Za-z0-9._-]{3,96}$/;
const LANG_VALUE = /^[A-Za-z]{2}_[A-Za-z]{2}$/;

function authorized(request: Request) {
  return !!env.CHECK_TOKEN && request.headers.get('authorization') === `Bearer ${env.CHECK_TOKEN}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ models: await listAdminModels(env.DB) });
}

export async function PATCH(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const input = await request.json() as Record<string, unknown>;
    const id = typeof input.id === 'string' ? input.id.trim() : '';
    const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : '';
    const product = typeof input.product === 'string' ? input.product.trim() : '';
    const device = typeof input.device === 'string' ? input.device.trim() : '';
    const moduleName = typeof input.module === 'string' ? input.module.trim() : '';
    const currentVersion = typeof input.currentVersion === 'string' ? input.currentVersion.trim() : '';
    const latestRaw = typeof input.latestVersion === 'string' ? input.latestVersion.trim() : '';
    const lang = typeof input.lang === 'string' ? input.lang.trim() : '';
    const serial = typeof input.serial === 'string' ? input.serial.trim() : '';
    const deviceIdentity = typeof input.deviceIdentity === 'string' ? input.deviceIdentity.trim() : '';
    if (!id || !displayName || displayName.length > 80) throw new Error('机型名称不合法');
    if (![product, device, moduleName].every((value) => MODEL_VALUE.test(value))) throw new Error('机型参数格式不合法');
    if (!VERSION_VALUE.test(currentVersion)) throw new Error('最低版本格式不合法');
    if (latestRaw && !VERSION_VALUE.test(latestRaw)) throw new Error('最新版本格式不合法');
    if (!LANG_VALUE.test(lang)) throw new Error('语言格式不合法');
    if ((serial || deviceIdentity) && (!serial || !deviceIdentity)) throw new Error('更新监测身份时，SN 与设备身份/MAC 必须同时填写');
    if (serial.length > 128 || deviceIdentity.length > 128) throw new Error('监测身份字段过长');

    const nextId = await updateCommunityModelMetadata(env.DB, id, {
      displayName,
      product,
      device,
      module: moduleName,
      currentVersion,
      latestVersion: latestRaw || null,
      lang,
    });
    if (serial && deviceIdentity) {
      if (!env.CHECK_TOKEN) throw new Error('服务器缺少监测凭据加密密钥');
      const encrypted = await encryptMonitorCredentials(env.CHECK_TOKEN, { serial, deviceIdentity });
      await saveMonitorCredentials(env.DB, {
        displayName,
        product,
        device,
        module: moduleName,
        currentVersion,
        lang,
      }, encrypted.iv, encrypted.ciphertext);
    }
    return Response.json({ ok: true, id: nextId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '保存失败' }, { status: 400 });
  }
}
