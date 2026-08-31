import { env } from 'cloudflare:workers';
import { notFound } from 'next/navigation';
import { getCommunityModel, listHistoricalPackagesByModelId, listVersionProbeResults } from '@/lib/ota/store';
import type { HistoricalPackage } from '@/lib/ota/types';

export const dynamic = 'force-dynamic';

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit > 1 ? 2 : 0)} ${units[unit]}`;
}

function compareVersions(left: string, right: string) {
  const a = left.match(/\d+/g)?.map(Number) ?? [];
  const b = right.match(/\d+/g)?.map(Number) ?? [];
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return left.localeCompare(right);
}

function packageHref(pkg: HistoricalPackage) {
  return pkg.mirrors[0] ?? null;
}

export default async function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const modelId = decodeURIComponent(id);
  const model = await getCommunityModel(env.DB, modelId);
  if (!model) notFound();

  const [packages, probes] = await Promise.all([
    listHistoricalPackagesByModelId(env.DB, model.id),
    listVersionProbeResults(env.DB, model.id),
  ]);
  const versions = [...new Set(packages.map((pkg) => pkg.version).filter((value): value is string => !!value))];
  const grouped = versions
    .sort((a, b) => compareVersions(b, a))
    .map((version) => ({
      version,
      full: packages.filter((pkg) => pkg.version === version && pkg.type === 'FULL_PACKAGE'),
      incremental: packages.filter((pkg) => pkg.version === version && pkg.type === 'INCREMENT_PACKAGE'),
    }));

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Model</p>
            <h1 className="mt-2 text-3xl font-semibold">{model.displayName}</h1>
            <p className="mt-2 font-mono text-xs text-[var(--muted-foreground)]">{model.product} · {model.device} · {model.module}</p>
          </div>
          <a className="api-link" href="/">返回机型库</a>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="metric-card"><span>最低已知版本</span><strong>{model.currentVersion}</strong></article>
          <article className="metric-card"><span>最新发现版本</span><strong>{model.latestVersion ?? '—'}</strong></article>
          <article className="metric-card"><span>已归档版本</span><strong>{versions.length}</strong></article>
        </section>

        <section className="panel mt-6">
          <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <h2 className="font-semibold">历史固件</h2>
          </div>
          {packages.length === 0 ? (
            <div className="empty-state">暂无历史固件。</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {grouped.map((group) => (
                <article className="p-5 sm:p-6" key={group.version}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs text-[var(--muted-foreground)]">目标版本</p>
                      <h3 className="mt-1 text-lg font-semibold">{group.version}</h3>
                    </div>
                    {group.full[0] && packageHref(group.full[0]) ? (
                      <a className="primary-button" href={packageHref(group.full[0])!} rel="noreferrer">下载全量包 · {formatBytes(group.full[0].fileSize)}</a>
                    ) : (
                      <span className="text-sm text-[var(--muted-foreground)]">未归档全量包</span>
                    )}
                  </div>

                  {group.full[0] && (
                    <div className="mt-3 grid gap-2 text-xs text-[var(--muted-foreground)] sm:grid-cols-2">
                      <div>MD5：<span className="font-mono">{group.full[0].md5 ?? '—'}</span></div>
                      <div>首次发现：{new Date(group.full[0].firstSeenAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</div>
                    </div>
                  )}

                  {group.incremental.length > 0 && (
                    <details className="mt-4 rounded-lg border border-[var(--border)] p-4">
                      <summary className="cursor-pointer text-sm font-medium">更多信息 · {group.incremental.length} 个差分包</summary>
                      <div className="mt-4 grid gap-3">
                        {group.incremental
                          .sort((a, b) => compareVersions(b.baseVersion ?? '', a.baseVersion ?? ''))
                          .map((pkg, index) => (
                            <div className="rounded-lg bg-[var(--muted)]/40 p-3 text-sm" key={`${pkg.md5 ?? pkg.fileName ?? index}-${pkg.baseVersion ?? ''}`}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span>
                                  适用版本：{packageHref(pkg) ? (
                                    <a className="download-link font-mono" href={packageHref(pkg)!} rel="noreferrer">{pkg.baseVersion || '未知基础版本'}</a>
                                  ) : (
                                    <span className="font-mono">{pkg.baseVersion || '未知基础版本'}</span>
                                  )}
                                </span>
                                <span className="text-xs text-[var(--muted-foreground)]">{formatBytes(pkg.fileSize)}</span>
                              </div>
                              <div className="mt-2 font-mono text-xs text-[var(--muted-foreground)]">MD5：{pkg.md5 ?? '—'}</div>
                            </div>
                          ))}
                      </div>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel mt-6">
          <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <h2 className="font-semibold">版本差分比对</h2>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">每个“低版本 → 高版本”组合只探测一次；记录的是 Xiaomi OTA 实际返回的目标和包数量。</p>
          </div>
          {probes.length === 0 ? (
            <div className="empty-state">暂无已完成的版本对比。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr><th>请求版本对</th><th>实际返回目标</th><th>包数</th><th>状态</th><th>检查时间</th></tr></thead>
                <tbody>
                  {probes.map((probe) => (
                    <tr key={`${probe.sourceVersion}-${probe.targetVersion}`}>
                      <td className="font-mono text-xs">{probe.sourceVersion} → {probe.targetVersion}</td>
                      <td>{probe.actualTargetVersion ?? '—'}</td>
                      <td>{probe.packageCount}</td>
                      <td>{probe.ok ? '成功' : (probe.error ?? '失败')}</td>
                      <td>{new Date(probe.checkedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
