import { createHash } from 'node:crypto';
import { env } from 'cloudflare:workers';
import { encryptMonitorCredentials } from '@/lib/ota/credentials';
import { archiveOtaObservation, claimContributionWindow, recordVersionProbe, saveMonitorCredentials, upsertCommunityModel } from '@/lib/ota/store';
import type { OtaPublicConfig } from '@/lib/ota/types';
import { checkXiaomiOta } from '@/lib/ota/xiaomi';

const MODEL_VALUE = /^[A-Za-z0-9._-]{2,96}$/;
const VERSION_VALUE = /^[A-Za-z0-9._-]{3,96}$/;
const LANG_VALUE = /^[A-Za-z]{2}_[A-Za-z]{2}$/;

function readString(value: unknown, name: string, maxLength: number) {
  if (typeof value !== 'string') throw new Error(`${name} is required`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) throw new Error(`${name} is invalid`);
  return normalized;
}

function readOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error('Optional field is invalid');
  return normalized;
}

function requestFingerprint(request: Request) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  return createHash('sha256').update(`${ip}\n${userAgent}`).digest('hex');
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 4096) {
      return Response.json({ ok: false, error: '提交内容过大' }, { status: 413 });
    }
    const input = JSON.parse(raw) as Record<string, unknown>;

    const displayName = readString(input.displayName, 'displayName', 80);
    const product = readString(input.product, 'product', 96);
    const codename = readString(input.codename, 'codename', 96);
    const device = readOptionalString(input.device, 96) || `${product}.${codename}`;
    const moduleName = readOptionalString(input.module, 96) || `${product}.${codename}.firmware`;
    const lang = readOptionalString(input.lang, 12) || 'zh_CN';
    const currentVersion = readString(input.minimumKnownVersion, 'minimumKnownVersion', 96);
    const serial = readString(input.serial, 'serial', 128);
    const deviceIdentity = readString(input.deviceIdentity, 'deviceIdentity', 128);

    if (![product, codename, device, moduleName].every((value) => MODEL_VALUE.test(value))) {
      return Response.json({ ok: false, error: '机型参数格式不合法' }, { status: 400 });
    }
    if (!VERSION_VALUE.test(currentVersion) || !LANG_VALUE.test(lang)) {
      return Response.json({ ok: false, error: '版本号或语言格式不合法' }, { status: 400 });
    }

    const allowed = await claimContributionWindow(env.DB, requestFingerprint(request));
    if (!allowed) {
      return Response.json({ ok: false, error: '提交过于频繁，请一分钟后再试' }, { status: 429 });
    }

    const config: OtaPublicConfig = {
      displayName,
      product,
      device,
      module: moduleName,
      lang,
      currentVersion,
    };
    const status = await checkXiaomiOta({ ...config, serial, deviceIdentity });

    if (!status.ok || !status.latestVersion || status.packages.length === 0) {
      return Response.json(
        {
          ok: false,
          error: '小米 OTA 未确认该组信息可获得更新，未加入机型库',
          detail: status.error,
        },
        { status: 422 },
      );
    }

    await upsertCommunityModel(env.DB, config, status);
    await archiveOtaObservation(env.DB, config, status);
    if (status.latestVersion && status.latestVersion !== currentVersion) {
      await recordVersionProbe(env.DB, {
        modelId: `${product}::${device}::${moduleName}`.toLowerCase(),
        sourceVersion: currentVersion,
        targetVersion: status.latestVersion,
      }, status);
    }
    if (!env.CHECK_TOKEN) {
      return Response.json({ ok: false, error: '持续监测暂不可用：服务器缺少加密密钥' }, { status: 503 });
    }
    const encrypted = await encryptMonitorCredentials(env.CHECK_TOKEN, { serial, deviceIdentity });
    await saveMonitorCredentials(env.DB, config, encrypted.iv, encrypted.ciphertext);
    return Response.json(
      {
        ok: true,
        model: { displayName, product, device, module: moduleName, lang, minimumKnownVersion: currentVersion },
        latestVersion: status.latestVersion,
        packageCount: status.packages.length,
        monitoring: true,
      },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : '提交失败' },
      { status: 400 },
    );
  }
}
