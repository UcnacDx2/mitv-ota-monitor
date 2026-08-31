'use client';

import { useState, type SyntheticEvent } from 'react';

type SubmitState = { kind: 'idle' | 'loading' | 'success' | 'error'; message: string };

const adbCommand = `adb shell 'printf "displayName=%s\\nproduct=%s\\ncodename=%s\\nminimumKnownVersion=%s\\nserial=%s\\ndeviceIdentity=%s\\n" "$(getprop ro.product.model)" "$(getprop ro.short_assm_mn)" "$(getprop ro.product.device)" "$(getprop ro.build.version.incremental)" "$(getprop ro.serialno)" "$(getprop mitv.factory.mac)"'`;

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
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-4">
        <p className="font-medium">ADB 一键读取所需信息</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          电视开启 ADB 后，在电脑终端运行下面命令。通常只需复制这 6 项；本站会自动补齐 OTA 所需的 device、module 和语言参数。
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-xs leading-5"><code>{adbCommand}</code></pre>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">默认规则：device = product.codename，module = product.codename.firmware，lang = zh_CN。这条命令已在 finch / OBPCN1N 实机验证；特殊机型可在高级设置中覆盖默认值。</p>
      </div>
      <div className="form-grid">
        <label>显示名称<input name="displayName" required maxLength={80} placeholder="例如：小米电视 S Pro 65" /></label>
        <label>最低已知版本<input name="minimumKnownVersion" required maxLength={96} placeholder="例如：OS3.0.13.0.UFFMATV" /></label>
        <label>product<input name="product" required maxLength={96} placeholder="例如：OBPCN1N" /></label>
        <label>codename<input name="codename" required maxLength={96} placeholder="例如：finch" /></label>
        <label>电视 SN<input name="serial" required maxLength={128} autoComplete="off" /></label>
        <label>设备身份 / MAC<input name="deviceIdentity" required maxLength={128} autoComplete="off" /></label>
      </div>
      <details className="rounded-lg border border-[var(--border)] p-4">
        <summary className="cursor-pointer font-medium">高级设置（通常不用填）</summary>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">如果你的机型不符合默认拼接规则，可以在这里覆盖；留空就使用默认规则。</p>
        <div className="form-grid mt-4">
          <label>device 覆盖<input name="device" maxLength={96} placeholder="默认：product.codename" /></label>
          <label>module 覆盖<input name="module" maxLength={96} placeholder="默认：product.codename.firmware" /></label>
          <label>语言覆盖<input name="lang" maxLength={12} placeholder="默认：zh_CN" /></label>
        </div>
      </details>
      <p className="privacy-note">SN 与设备身份只用于本次实时 OTA 验证，不写入数据库、不显示在网页，也不提交到 GitHub。</p>
      <button className="primary-button" type="submit" disabled={state.kind === 'loading'}>
        {state.kind === 'loading' ? '验证中…' : '验证并贡献机型'}
      </button>
      {state.kind !== 'idle' && <p className={`form-result result-${state.kind}`}>{state.message}</p>}
    </form>
  );
}
