'use client';

import { useState } from 'react';
import type { CommunityModel } from '@/lib/ota/types';

export function AdminModels() {
  const [token, setToken] = useState('');
  const [models, setModels] = useState<CommunityModel[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    setMessage('读取中…');
    const response = await fetch('/api/admin/models', { headers: { authorization: `Bearer ${token}` } });
    const result = await response.json() as { models?: CommunityModel[]; error?: string };
    if (!response.ok) {
      setMessage(result.error ?? '读取失败');
      return;
    }
    setModels(result.models ?? []);
    setMessage(`已读取 ${result.models?.length ?? 0} 个机型`);
  }

  async function save(model: CommunityModel) {
    setMessage(`正在保存 ${model.displayName}…`);
    const response = await fetch('/api/admin/models', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: model.id,
        displayName: model.displayName,
        currentVersion: model.currentVersion,
        latestVersion: model.latestVersion ?? '',
        lang: model.lang,
      }),
    });
    const result = await response.json() as { ok?: boolean; error?: string };
    setMessage(response.ok ? '保存成功' : (result.error ?? '保存失败'));
  }

  function update(index: number, field: keyof CommunityModel, value: string) {
    setModels((current) => current.map((model, i) => i === index ? { ...model, [field]: value } : model));
  }

  return (
    <div className="grid gap-5">
      <section className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="管理员密钥（CHECK_TOKEN）"
            autoComplete="off"
          />
          <button className="primary-button" type="button" onClick={load}>进入维护面板</button>
        </div>
        {message && <p className="mt-3 text-sm text-[var(--muted-foreground)]">{message}</p>}
      </section>

      {models.map((model, index) => (
        <section className="panel p-5 sm:p-6" key={model.id}>
          <div className="mb-4">
            <h2 className="font-semibold">{model.product} · {model.device}</h2>
            <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{model.module}</p>
          </div>
          <div className="form-grid">
            <label>显示名称<input value={model.displayName} onChange={(event) => update(index, 'displayName', event.target.value)} /></label>
            <label>最低已知版本<input value={model.currentVersion} onChange={(event) => update(index, 'currentVersion', event.target.value)} /></label>
            <label>最新版本<input value={model.latestVersion ?? ''} onChange={(event) => update(index, 'latestVersion', event.target.value)} /></label>
            <label>语言<input value={model.lang} onChange={(event) => update(index, 'lang', event.target.value)} /></label>
          </div>
          <button className="primary-button mt-4" type="button" onClick={() => save(model)}>保存</button>
        </section>
      ))}
    </div>
  );
}
