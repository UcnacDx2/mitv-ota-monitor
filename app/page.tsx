import { env } from 'cloudflare:workers';
import { getPublicConfig } from '@/lib/ota/config';
import { readStatus } from '@/lib/ota/store';

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

export default async function Home() {
  const config = getPublicConfig(env);
  const status = await readStatus(env.DB);
  const packages = status?.packages ?? [];

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">MiTV OTA Monitor</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">小米电视更新监测</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              每日向小米官方 OTA 接口检查一次更新。序列号与设备身份仅保存在服务端秘密中，不进入页面或仓库。
            </p>
          </div>
          <span className={`status-pill ${status?.ok ? 'status-ok' : 'status-idle'}`}>
            {status?.ok ? '监测正常' : '等待首次检查'}
          </span>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="metric-card">
            <span>当前版本</span>
            <strong>{status?.currentVersion ?? config.currentVersion}</strong>
          </article>
          <article className="metric-card">
            <span>最新版本</span>
            <strong>{status?.latestVersion ?? '尚未获取'}</strong>
          </article>
          <article className="metric-card">
            <span>最近检查</span>
            <strong className="text-base">
              {status?.checkedAt
                ? new Date(status.checkedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
                : '等待定时任务'}
            </strong>
          </article>
        </section>

        <section className="panel mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold">{config.displayName}</h2>
              <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">
                {config.product} · {config.device}
              </p>
            </div>
            <a className="api-link" href="/api/status">JSON 状态接口</a>
          </div>

          {status?.error ? (
            <div className="error-box m-5 sm:m-6">最近一次检查失败：{status.error}</div>
          ) : packages.length === 0 ? (
            <div className="empty-state">暂无更新包数据。首次定时检查完成后会自动显示。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr>
                    <th>类型</th><th>版本</th><th>基础版本</th><th>大小</th><th>MD5</th><th>文件</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg, index) => (
                    <tr key={`${pkg.fileName ?? 'package'}-${index}`}>
                      <td>{pkg.type ?? '—'}</td>
                      <td className="font-medium">{pkg.version ?? '—'}</td>
                      <td>{pkg.baseVersion ?? '—'}</td>
                      <td>{formatBytes(pkg.fileSize)}</td>
                      <td className="font-mono text-xs">{pkg.md5 ?? '—'}</td>
                      <td className="max-w-[280px] truncate font-mono text-xs" title={pkg.fileName ?? ''}>{pkg.fileName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-6 text-xs leading-5 text-[var(--muted-foreground)]">
          仅展示小米 OTA 服务返回的版本元数据；不会代理或重新分发固件文件。
        </footer>
      </div>
    </main>
  );
}
