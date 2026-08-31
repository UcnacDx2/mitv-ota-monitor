import { getPublicConfig, getRuntimeConfig } from './config';
import { decryptMonitorCredentials } from './credentials';
import { archiveOtaObservation, listMonitorTargets, upsertCommunityModel, writeStatus } from './store';
import type { OtaStatus, RuntimeEnv } from './types';
import { checkXiaomiOta } from './xiaomi';

export type MonitorRunResult = {
  checked: number;
  succeeded: number;
  failed: number;
  results: Array<{ model: string; status: OtaStatus }>;
};

export async function runAllChecks(env: RuntimeEnv): Promise<MonitorRunResult> {
  const results: MonitorRunResult['results'] = [];
  const primaryConfig = getPublicConfig(env);

  if (env.MITV_SN && env.MITV_DEVICE_IDENTITY) {
    const runtimeConfig = getRuntimeConfig(env);
    const status = await checkXiaomiOta(runtimeConfig);
    await writeStatus(env.DB, status);
    await archiveOtaObservation(env.DB, runtimeConfig, status);
    results.push({ model: runtimeConfig.product, status });
  }

  if (env.CHECK_TOKEN) {
    const targets = await listMonitorTargets(env.DB);
    for (const target of targets) {
      try {
        const credentials = await decryptMonitorCredentials(
          env.CHECK_TOKEN,
          target.credentialIv,
          target.credentialCiphertext,
        );
        const status = await checkXiaomiOta({ ...target, ...credentials });
        if (status.packages.length > 0) await upsertCommunityModel(env.DB, target, status);
        await archiveOtaObservation(env.DB, target, status);
        if (
          target.product === primaryConfig.product &&
          target.device === primaryConfig.device &&
          target.module === primaryConfig.module
        ) {
          await writeStatus(env.DB, status);
        }
        results.push({ model: target.product, status });
      } catch (error) {
        results.push({
          model: target.product,
          status: {
            checkedAt: new Date().toISOString(),
            ok: false,
            currentVersion: target.currentVersion,
            latestVersion: null,
            packages: [],
            error: error instanceof Error ? error.message : 'monitor failed',
          },
        });
      }
    }
  }

  const succeeded = results.filter((item) => item.status.ok).length;
  return {
    checked: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}
