'use client';

import { useState, type SyntheticEvent } from 'react';

type SubmitState = { kind: 'idle' | 'loading' | 'success' | 'error'; message: string };

const adbCommand = `adb shell 'product=$(getprop ro.short_assm_mn); codename=$(getprop ro.product.device); version=$(getprop ro.build.version.incremental); serial=$(getprop ro.serialno); model=$(getprop ro.product.model); lang=$(getprop ro.product.locale); identity=$(getprop mitv.factory.mac); printf "displayName=%s\\nproduct=%s\\ndevice=%s.%s\\nmodule=%s.%s.firmware\\nminimumKnownVersion=%s\\nlang=%s\\nserial=%s\\ndeviceIdentity=%s\\n" "$model" "$product" "$product" "$codename" "$product" "$codename" "$version" "$lang" "$serial" "$identity"'`;

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
          电视开启 ADB 后，在电脑终端运行下面命令。它会按本站字段名输出，可直接照着填写；不同机型若某项为空，请以设备实际属性为准。
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-xs leading-5"><code>{adbCommand}</code></pre>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">这条命令已在 finch / OBPCN1N 实机验证；device/module 由 product + codename 组合生成。若其他机型缺少 ro.short_assm_mn 或 mitv.factory.mac，请先核对实际 OTA 参数。SN 与 MAC 仅用于实时 OTA 验证，不会写入机型库。</p>
      </div>
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
