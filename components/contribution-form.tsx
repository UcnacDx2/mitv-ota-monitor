'use client';

import { useState, type SyntheticEvent } from 'react';

type SubmitState = { kind: 'idle' | 'loading' | 'success' | 'error'; message: string };

export function ContributionForm() {
  const [state, setState] = useState<SubmitState>({ kind: 'idle', message: '' });

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: 'loading', message: '正在向小米 OTA 验证…' });
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch('/api/contribute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string; latestVersion?: string };
      if (!response.ok || !result.ok) {
        setState({ kind: 'error', message: result.error ?? '验证失败' });
        return;
      }
      setState({ kind: 'success', message: `验证通过，已加入机型库。最新版本：${result.latestVersion}` });
      event.currentTarget.reset();
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      setState({ kind: 'error', message: '网络请求失败，请稍后重试' });
    }
  }

  return (
    <form className="contribution-form" onSubmit={submit}>
      <div className="form-grid">
        <label>显示名称<input name="displayName" required maxLength={80} placeholder="例如：小米电视 S Pro 65" /></label>
        <label>最低已知版本<input name="minimumKnownVersion" required maxLength={96} placeholder="例如：OS3.0.13.0.UFFMATV" /></label>
        <label>product<input name="product" required maxLength={96} placeholder="OBPCN1N" /></label>
        <label>device<input name="device" required maxLength={96} placeholder="OBPCN1N.finch" /></label>
        <label>module<input name="module" required maxLength={96} placeholder="OBPCN1N.finch.firmware" /></label>
        <label>语言<input name="lang" required maxLength={12} defaultValue="zh_CN" /></label>
        <label>电视 SN<input name="serial" required maxLength={128} autoComplete="off" /></label>
        <label>设备身份 / MAC<input name="deviceIdentity" required maxLength={128} autoComplete="off" /></label>
      </div>
      <p className="privacy-note">SN 与设备身份只用于本次实时 OTA 验证，不写入数据库、不显示在网页，也不提交到 GitHub。</p>
      <button className="primary-button" type="submit" disabled={state.kind === 'loading'}>
        {state.kind === 'loading' ? '验证中…' : '验证并贡献机型'}
      </button>
      {state.kind !== 'idle' && <p className={`form-result result-${state.kind}`}>{state.message}</p>}
    </form>
  );
}
