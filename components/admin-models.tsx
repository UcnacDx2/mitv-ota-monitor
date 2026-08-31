'use client';

import { useState } from 'react';
import type { CommunityModel } from '@/lib/ota/types';

type AdminModel = CommunityModel & {
  monitoring: boolean;
  packageCount: number;
  probeCount: number;
  checkCount: number;
  serial?: string;
  deviceIdentity?: string;
};

export function AdminModels() {
  const [token, setToken] = useState('');
  const [models, setModels] = useState<AdminModel[]>([]);
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);

  async function load() {
    setMessage('读取中…');
    const response = await fetch('/api/admin/models', { headers: { authorization: `Bearer ${token}` } });
    const result = await response.json() as { models?: AdminModel[]; error?: string };
    if (!response.ok) {
      setMessage(result.error ?? '读取失败');
      return;
    }
    setModels(result.models ?? []);
    setMessage(`已读取 ${result.models?.length ?? 0} 个机型`);
  }

  async function save(model: AdminModel, index: number) {
    setMessage(`正在保存 ${model.displayName}…`);
    const response = await fetch('/api/admin/models', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: model.id,
        displayName: model.displayName,
        product: model.product,
        device: model.device,
        module: model.module,
        currentVersion: model.currentVersion,
        latestVersion: model.latestVersion ?? '',
        lang: model.lang,
        serial: model.serial ?? '',
        deviceIdentity: model.deviceIdentity ?? '',
      }),
    });
    const result = await response.json() as { ok?: boolean; id?: string; error?: string };
    if (!response.ok) {
      setMessage(result.error ?? '保存失败');
      return;
    }
    setModels((current) => current.map((item, i) => i === index ? {
      ...item,
      id: result.id ?? item.id,
      monitoring: item.monitoring || Boolean(item.serial && item.deviceIdentity),
      serial: '',
      deviceIdentity: '',
    } : item));
    setMessage('保存成功');
  }

  async function runCheck() {
    setChecking(true);
    setMessage('正在执行 OTA 检查与差分探测…');
    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const result = await response.json() as {
        checked?: number;
        succeeded?: number;
        failed?: number;
        error?: string;
      };
      if (!response.ok) {
        setMessage(result.error ?? `检查失败（HTTP ${response.status}）`);
        return;
      }
      setMessage(`检查完成：${result.checked ?? 0} 个目标，成功 ${result.succeeded ?? 0}，失败 ${result.failed ?? 0}`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '检查失败');
    } finally {
      setChecking(false);
    }
  }

  function update(index: number, field: keyof AdminModel, value: string) {
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
          <button className="primary-button" type="button" onClick={runCheck} disabled={checking || !token}>
            {checking ? '检查中…' : '立即检查 OTA'}
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-[var(--muted-foreground)]">{message}</p>}
      </section>

      {models.map((model, index) => (
        <section className="panel p-5 sm:p-6" key={model.id}>
          <div className="mb-4">
            <h2 className="font-semibold">{model.product} · {model.device}</h2>
            <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{model.module}</p>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              持续监测：{model.monitoring ? '已配置' : '未配置'} · 历史包 {model.packageCount} · 差分记录 {model.probeCount} · 检查 {model.checkCount} 次
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">最近验证：{new Date(model.verifiedAt).toLocaleString()}</p>
          </div>
          <div className="form-grid">
            <label>显示名称<input value={model.displayName} onChange={(event) => update(index, 'displayName', event.target.value)} /></label>
            <label>Product<input value={model.product} onChange={(event) => update(index, 'product', event.target.value)} /></label>
            <label>Device<input value={model.device} onChange={(event) => update(index, 'device', event.target.value)} /></label>
            <label>Module<input value={model.module} onChange={(event) => update(index, 'module', event.target.value)} /></label>
            <label>最低已知版本<input value={model.currentVersion} onChange={(event) => update(index, 'currentVersion', event.target.value)} /></label>
            <label>最新版本<input value={model.latestVersion ?? ''} onChange={(event) => update(index, 'latestVersion', event.target.value)} /></label>
            <label>语言<input value={model.lang} onChange={(event) => update(index, 'lang', event.target.value)} /></label>
            <label>新 SN（留空保持不变）<input value={model.serial ?? ''} onChange={(event) => update(index, 'serial', event.target.value)} autoComplete="off" /></label>
            <label>新设备身份 / MAC（留空保持不变）<input value={model.deviceIdentity ?? ''} onChange={(event) => update(index, 'deviceIdentity', event.target.value)} autoComplete="off" /></label>
          </div>
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">修改 Product / Device / Module 会同步迁移历史包、差分记录、检查记录和持续监测凭据；已有 SN/MAC 不会明文回显。</p>
          <button className="primary-button mt-4" type="button" onClick={() => save(model, index)}>保存</button>
        </section>
      ))}
    </div>
  );
}
