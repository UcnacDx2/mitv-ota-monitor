import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import type { OtaPackage, OtaRuntimeConfig, OtaStatus } from './types';

const ENDPOINT = 'http://whippet.bsp.xiaomi.com/mi/ota/updater/v1/checkUpdate';
const BASE_URL = 'http://whippet.bsp.xiaomi.com';
const METHOD = '/mi/ota/updater/v1/checkUpdate';
const APP_ID = 'tv-caDMFDJuAC';
const APP_KEY = 'HYbRkMrfdKIUgbLK';

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizePackage(value: unknown): OtaPackage | null {
  const pkg = asObject(value);
  if (!pkg) return null;
  const downloadOption = asObject(pkg.downloadOption);
  const mirrors = Array.isArray(downloadOption?.mirrors)
    ? downloadOption.mirrors.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    version: asString(pkg.version),
    baseVersion: asString(pkg.baseVersion),
    type: asString(pkg.type),
    md5: asString(pkg.md5),
    fileSize: asNumber(pkg.fileSize),
    fileName: asString(pkg.fileName),
    mirrors,
  };
}

function parsePackages(payload: unknown): OtaPackage[] {
  const root = asObject(payload);
  const body = asObject(root?.body);
  const data = asObject(body?.data);
  const modules = Array.isArray(data?.modules) ? data.modules : [];
  const result: OtaPackage[] = [];
  for (const moduleValue of modules) {
    const moduleObj = asObject(moduleValue);
    const latest = asObject(moduleObj?.latest);
    const packages = Array.isArray(latest?.packages) ? latest.packages : [];
    for (const pkg of packages) {
      const normalized = normalizePackage(pkg);
      if (normalized) result.push(normalized);
    }
  }
  return result;
}

export function buildXiaomiOtaRequest(config: OtaRuntimeConfig) {
  const body = {
    product: config.product,
    device: config.device,
    lang: config.lang,
    identity: { sn: config.serial, imei: config.deviceIdentity },
    properties: { usermode: '1' },
    modules: [{ module: config.module, version: config.currentVersion }],
  };
  const bodyJson = JSON.stringify(body);
  const sign = createHash('md5')
    .update(`${APP_ID}${bodyJson}${APP_KEY}`, 'utf8')
    .digest('hex')
    .toUpperCase();
  const requestJson = {
    header: {
      appid: APP_ID,
      url: BASE_URL,
      sign,
      method: METHOD,
      sign_type: 'md5',
      lang: 'cz',
    },
    body,
  };
  return new URLSearchParams({
    data: Buffer.from(JSON.stringify(requestJson), 'utf8').toString('base64'),
  });
}

export async function checkXiaomiOta(config: OtaRuntimeConfig): Promise<OtaStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'Apache-HttpClient/UNAVAILABLE (java 1.4)',
      },
      body: buildXiaomiOtaRequest(config),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`OTA endpoint returned HTTP ${response.status}`);
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('OTA endpoint returned a non-JSON response');
    }
    const root = asObject(payload);
    const body = asObject(root?.body);
    const businessCode = asNumber(body?.code);
    if (businessCode === 210) {
      return {
        checkedAt,
        ok: true,
        currentVersion: config.currentVersion,
        latestVersion: null,
        packages: [],
        error: null,
      };
    }
    if (businessCode !== 200) {
      const message = asString(body?.message);
      throw new Error(
        `OTA endpoint returned business code ${String(businessCode ?? 'unknown')}${message ? ` (${message})` : ''}`,
      );
    }
    const packages = parsePackages(payload);
    return {
      checkedAt,
      ok: true,
      currentVersion: config.currentVersion,
      latestVersion: packages.find((pkg) => pkg.version)?.version ?? null,
      packages,
      error: null,
    };
  } catch (error) {
    return {
      checkedAt,
      ok: false,
      currentVersion: config.currentVersion,
      latestVersion: null,
      packages: [],
      error: error instanceof Error ? error.message : 'Unknown OTA check failure',
    };
  }
}
