export type OtaPackage = {
  version: string | null;
  baseVersion: string | null;
  type: string | null;
  md5: string | null;
  fileSize: number | null;
  fileName: string | null;
  mirrors: string[];
};

export type OtaStatus = {
  checkedAt: string;
  ok: boolean;
  currentVersion: string;
  latestVersion: string | null;
  packages: OtaPackage[];
  error: string | null;
};

export type OtaPublicConfig = {
  product: string;
  device: string;
  module: string;
  displayName: string;
  currentVersion: string;
  lang: string;
};

export type OtaRuntimeConfig = OtaPublicConfig & {
  serial: string;
  deviceIdentity: string;
};

export type CommunityModel = OtaPublicConfig & {
  id: string;
  latestVersion: string | null;
  verifiedAt: string;
  packages: OtaPackage[];
};

export type HistoricalPackage = OtaPackage & {
  modelId: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type MonitorTarget = OtaPublicConfig & {
  modelId: string;
  credentialIv: string;
  credentialCiphertext: string;
};

export type RuntimeEnv = {
  DB: D1Database;
  MITV_PRODUCT?: string;
  MITV_DEVICE?: string;
  MITV_MODULE?: string;
  MITV_DISPLAY_NAME?: string;
  MITV_CURRENT_VERSION?: string;
  MITV_LANG?: string;
  MITV_SN?: string;
  MITV_DEVICE_IDENTITY?: string;
  CHECK_TOKEN?: string;
};
