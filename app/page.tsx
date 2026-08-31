import { env } from 'cloudflare:workers';
import Link from 'next/link';
import { listCommunityModelsPage } from '@/lib/ota/store';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ q?: string; page?: string }>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = (params.q ?? '').trim();
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const models = await listCommunityModelsPage(env.DB, page, 12, q);

  const pageHref = (targetPage: number) => {
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    query.set('page', String(targetPage));
    return `/?${query.toString()}`;
  };

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">MiTV OTA Monitor</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">小米电视 OTA 机型库</h1>
          </div>
          <Link className="primary-button text-center" href="/contribute">贡献机型</Link>
        </header>

        <form className="mt-6 flex gap-3" action="/" method="get">
          <input
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm"
            name="q"
            defaultValue={q}
            placeholder="搜索机型名称、product 或 device"
          />
          <button className="primary-button" type="submit">搜索</button>
        </form>

        <div className="mt-4 text-sm text-[var(--muted-foreground)]">共 {models.total} 个已验证机型</div>

        {models.items.length === 0 ? (
          <div className="empty-state mt-6">没有匹配的机型。</div>
        ) : (
          <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {models.items.map((model) => (
              <Link
                key={model.id}
                className="model-card transition hover:-translate-y-0.5"
                href={`/models/${encodeURIComponent(model.id)}`}
              >
                <div>
                  <h2 className="font-semibold">{model.displayName}</h2>
                  <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{model.product} · {model.device}</p>
                </div>
                <dl className="mt-4">
                  <div><dt>最低已知版本</dt><dd>{model.currentVersion}</dd></div>
                  <div><dt>最新发现版本</dt><dd>{model.latestVersion ?? '—'}</dd></div>
                </dl>
              </Link>
            ))}
          </section>
        )}

        {models.totalPages > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-3 text-sm">
            {models.page > 1 ? <Link className="api-link" href={pageHref(models.page - 1)}>上一页</Link> : <span />}
            <span className="text-[var(--muted-foreground)]">{models.page} / {models.totalPages}</span>
            {models.page < models.totalPages ? <Link className="api-link" href={pageHref(models.page + 1)}>下一页</Link> : <span />}
          </nav>
        )}
      </div>
    </main>
  );
}
