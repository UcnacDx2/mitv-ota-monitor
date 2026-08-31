import { env } from 'cloudflare:workers';
import Link from 'next/link';
import { ContributionForm } from '@/components/contribution-form';
import { getPublicConfig } from '@/lib/ota/config';
import { listCommunityModels, readStatus } from '@/lib/ota/store';

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
  const communityModels = await listCommunityModels(env.DB);
  const packages = status?.packages ?? [];

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">MiTV OTA Monitor</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">小米电视更新监测</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              向小米官方 OTA 接口验证并整理电视更新数据。你也可以贡献自己的机型；设备身份只用于当次验证，不进入公开机型库。
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
            <Link className="api-link" href="/api/status">JSON 状态接口</Link>
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
                    <th>类型</th><th>版本</th><th>基础版本</th><th>大小</th><th>MD5</th><th>下载</th>
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
                      <td className="max-w-[300px] text-xs">
                        {pkg.mirrors[0] ? (
                          <a className="download-link" href={pkg.mirrors[0]} rel="noreferrer">{pkg.fileName ?? '下载 OTA'}</a>
                        ) : (pkg.fileName ?? '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel mt-6">
          <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <p className="eyebrow">Community registry</p>
            <h2 className="mt-1 font-semibold">已验证机型</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">只有小米 OTA 实时验证成功的提交才会出现在这里。</p>
          </div>
          {communityModels.length === 0 ? (
            <div className="empty-state">还没有社区贡献机型。下面可以提交第一台。</div>
          ) : (
            <div className="model-list">
              {communityModels.map((model) => (
                <article className="model-card" key={model.id}>
                  <div>
                    <h3>{model.displayName}</h3>
                    <p className="font-mono text-xs text-[var(--muted-foreground)]">{model.product} · {model.device}</p>
                  </div>
                  <dl>
                    <div><dt>最低已知版本</dt><dd>{model.currentVersion}</dd></div>
                    <div><dt>验证到的最新版本</dt><dd>{model.latestVersion ?? '—'}</dd></div>
                    <div><dt>验证时间</dt><dd>{new Date(model.verifiedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</dd></div>
                  </dl>
                  <div className="package-links">
                    {model.packages.map((pkg, index) => (
                      pkg.mirrors[0] ? (
                        <a key={`${model.id}-${index}`} href={pkg.mirrors[0]} rel="noreferrer">
                          {pkg.type === 'FULL_PACKAGE' ? '完整包' : '增量包'} · {formatBytes(pkg.fileSize)}
                        </a>
                      ) : null
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel mt-6">
          <div className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <p className="eyebrow">Contribute</p>
            <h2 className="mt-1 font-semibold">贡献你的电视机型</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">请填写你确认过的最低版本。提交后服务器会立刻向 Xiaomi OTA 验证；验证失败不会加入名单。</p>
          </div>
          <div className="p-5 sm:p-6"><ContributionForm /></div>
        </section>

        <footer className="mt-6 text-xs leading-5 text-[var(--muted-foreground)]">
          仅展示小米 OTA 服务返回的版本元数据与官方 CDN 链接；本站不会代理或重新分发固件文件。
        </footer>
      </div>
    </main>
  );
}
