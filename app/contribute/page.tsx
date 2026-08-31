import Link from 'next/link';
import { ContributionForm } from '@/components/contribution-form';

export default function ContributePage() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between border-b border-[var(--border)] pb-5">
          <div>
            <p className="eyebrow">Contribute</p>
            <h1 className="mt-2 text-2xl font-semibold">贡献电视机型</h1>
          </div>
          <Link className="api-link" href="/">返回机型库</Link>
        </header>
        <section className="panel p-5 sm:p-6">
          <ContributionForm />
        </section>
      </div>
    </main>
  );
}
