import { AdminModels } from '@/components/admin-models';

export default function AdminPage() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between border-b border-[var(--border)] pb-5">
          <div>
            <p className="eyebrow">Admin</p>
            <h1 className="mt-2 text-2xl font-semibold">机型维护</h1>
          </div>
          <a className="api-link" href="/">返回机型库</a>
        </header>
        <AdminModels />
      </div>
    </main>
  );
}
