import { getPublicConfig, getRuntimeConfig } from './config';
import { decryptMonitorCredentials } from './credentials';
import {
  archiveOtaObservation,
  listMonitorTargets,
  listPendingVersionProbes,
  recordVersionProbe,
  updateCommunityModelStatus,
  writeStatus,
} from './store';
import type { OtaStatus, RuntimeEnv } from './types';
import { checkXiaomiOta } from './xiaomi';

const MAX_VERSION_PROBES_PER_RUN = 30;

export type MonitorRunResult = {
  checked: number;
  succeeded: number;
  failed: number;
  results: Array<{ model: string; status: OtaStatus }>;
};

export async function runAllChecks(env: RuntimeEnv): Promise<MonitorRunResult> {
  const results: MonitorRunResult['results'] = [];
  const primaryConfig = getPublicConfig(env);
  let monitoredTargets = 0;
  let remainingProbeBudget = MAX_VERSION_PROBES_PER_RUN;

  if (env.CHECK_TOKEN) {
    const targets = await listMonitorTargets(env.DB);
    monitoredTargets = targets.length;
    for (const target of targets) {
      try {
        const credentials = await decryptMonitorCredentials(
          env.CHECK_TOKEN,
          target.credentialIv,
          target.credentialCiphertext,
        );
        const status = await checkXiaomiOta({ ...target, ...credentials });
        if (status.packages.length > 0) await updateCommunityModelStatus(env.DB, target, status);
        await archiveOtaObservation(env.DB, target, status);
        if (status.latestVersion && status.latestVersion !== target.currentVersion) {
          await recordVersionProbe(env.DB, {
            modelId: target.modelId,
            sourceVersion: target.currentVersion,
            targetVersion: status.latestVersion,
          }, status);
        }
        if (
          target.product === primaryConfig.product &&
          target.device === primaryConfig.device &&
          target.module === primaryConfig.module
        ) {
          await writeStatus(env.DB, status);
        }
        results.push({ model: target.product, status });

        if (remainingProbeBudget > 0) {
          const probes = await listPendingVersionProbes(env.DB, target);
          for (const probe of probes.slice(0, remainingProbeBudget)) {
            const probeStatus = await checkXiaomiOta({
              ...target,
              ...credentials,
              currentVersion: probe.sourceVersion,
            });
            await archiveOtaObservation(env.DB, target, probeStatus);
            await recordVersionProbe(env.DB, probe, probeStatus);
            remainingProbeBudget -= 1;
            if (remainingProbeBudget <= 0) break;
          }
        }
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

  if (monitoredTargets === 0 && env.MITV_SN && env.MITV_DEVICE_IDENTITY) {
    const runtimeConfig = getRuntimeConfig(env);
    const status = await checkXiaomiOta(runtimeConfig);
    await writeStatus(env.DB, status);
    await archiveOtaObservation(env.DB, runtimeConfig, status);
    results.push({ model: runtimeConfig.product, status });
  }

  const succeeded = results.filter((item) => item.status.ok).length;
  return {
    checked: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}
