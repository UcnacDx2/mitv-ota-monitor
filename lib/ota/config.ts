import type { OtaPublicConfig, OtaRuntimeConfig, RuntimeEnv } from './types';

const DEFAULTS: OtaPublicConfig = {
  product: 'OBPCN1N',
  device: 'OBPCN1N.finch',
  module: 'OBPCN1N.finch.firmware',
  displayName: 'Xiaomi TV (finch)',
  currentVersion: 'OS3.0.115.0.UFFMATV',
  lang: 'zh_CN',
};

export function getPublicConfig(env: Partial<RuntimeEnv>): OtaPublicConfig {
  return {
    product: env.MITV_PRODUCT || DEFAULTS.product,
    device: env.MITV_DEVICE || DEFAULTS.device,
    module: env.MITV_MODULE || DEFAULTS.module,
    displayName: env.MITV_DISPLAY_NAME || DEFAULTS.displayName,
    currentVersion: env.MITV_CURRENT_VERSION || DEFAULTS.currentVersion,
    lang: env.MITV_LANG || DEFAULTS.lang,
  };
}

export function getRuntimeConfig(env: Partial<RuntimeEnv>): OtaRuntimeConfig {
  const publicConfig = getPublicConfig(env);
  if (!env.MITV_SN || !env.MITV_DEVICE_IDENTITY) {
    throw new Error('MITV_SN and MITV_DEVICE_IDENTITY must be configured as server-side secrets');
  }
  return {
    ...publicConfig,
    serial: env.MITV_SN,
    deviceIdentity: env.MITV_DEVICE_IDENTITY,
  };
}
