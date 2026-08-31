import { env } from 'cloudflare:workers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCommunityModel, listHistoricalPackagesByModelId, listVersionProbeResults } from '@/lib/ota/store';

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

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Model</p>
            <h1 className="mt-2 text-3xl font-semibold">{model.displayName}</h1>
            <p className="mt-2 font-mono text-xs text-[var(--muted-foreground)]">{model.product} · {model.device} · {model.module}</p>
          </div>
          <Link className="api-link" href="/">返回机型库</Link>
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead><tr><th>目标版本</th><th>类型</th><th>基础版本</th><th>大小</th><th>MD5</th><th>首次发现</th><th>下载</th></tr></thead>
                <tbody>
                  {packages.map((pkg, index) => (
                    <tr key={`${pkg.md5 ?? pkg.fileName ?? index}-${pkg.baseVersion ?? ''}`}>
                      <td className="font-medium">{pkg.version ?? '—'}</td>
                      <td>{pkg.type === 'FULL_PACKAGE' ? '全量包' : pkg.type === 'INCREMENT_PACKAGE' ? '增量包' : (pkg.type ?? '—')}</td>
                      <td>{pkg.baseVersion || '—'}</td>
                      <td>{formatBytes(pkg.fileSize)}</td>
                      <td className="font-mono text-xs">{pkg.md5 ?? '—'}</td>
                      <td>{new Date(pkg.firstSeenAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
                      <td className="max-w-[280px] text-xs">{pkg.mirrors[0] ? <a className="download-link" href={pkg.mirrors[0]} rel="noreferrer">{pkg.fileName ?? '下载'}</a> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
