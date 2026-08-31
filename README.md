# MiTV OTA Monitor

小米电视 OTA 监测与共建站点。站点调用小米官方 OTA 检查接口，把已验证的版本与官方 CDN 链接持久化到 Cloudflare D1，并允许用户贡献新的电视机型。

## 隐私边界

仓库只保留机型级参数和 OTA 客户端通用常量。电视序列号与设备身份值必须通过部署环境变量提供，禁止提交到 Git。

默认监测机型的必需秘密：`MITV_SN`、`MITV_DEVICE_IDENTITY`。可选 `CHECK_TOKEN` 用于保护 `POST /api/check` 手动检查接口。

社区贡献通过 `/api/contribute` 完成。贡献者提交的 SN / 设备身份只存在于当次请求内，用于实时向 Xiaomi OTA 验证；数据库只保存机型参数、最低已知版本、验证时间以及 OTA 包元数据。

## OTA 协议

- `POST http://whippet.bsp.xiaomi.com/mi/ota/updater/v1/checkUpdate`
- `Content-Type: application/x-www-form-urlencoded`
- 表单：`data=<Base64(JSON)>`
- 签名：`MD5(appid + JSON.stringify(body) + APP_KEY).toUpperCase()`
- `APP_ID = tv-caDMFDJuAC`
- `APP_KEY = HYbRkMrfdKIUgbLK`

## 结构

- `lib/ota/xiaomi.ts`：协议构造、签名、请求、响应解析。
- `lib/ota/config.ts`：机型参数和设备秘密分离。
- `lib/ota/store.ts`：持久化边界；当前 D1，后续可替换/扩展 KV。
- `worker/index.ts`：Vinext fetch + Cloudflare scheduled handler。
- `/api/status`：公开状态 JSON。
- `/api/check`：可选的受保护手动检查。
- `/api/contribute`：社区机型提交与 OTA 实时验证；同一请求来源至少间隔 60 秒。

## 共建机型规则

1. 必须提供明确的最低已知版本，而不是只填“当前最新版”。
2. 服务端使用提交者提供的临时 SN / 设备身份请求 Xiaomi OTA。
3. 只有 OTA 返回成功且至少解析到一个更新包时，机型才会自动写入公开 registry。
4. SN、MAC 等设备身份绝不写入 registry、日志文档或 Git 仓库。
5. Registry 中的下载链接直接指向 Xiaomi 官方 CDN；本站不代理固件。

## Finch UART Root SOP

已实机验证的 `finch` UART / U-Boot Root 流程见 [`docs/FINCH_UART_ROOT_SOP.md`](docs/FINCH_UART_ROOT_SOP.md)。该文档严格限定在已验证的机型、槽位和镜像条件内，执行写入前必须重新确认当前槽位与镜像校验值。

## 本地开发

复制 `.dev.vars.example` 为 `.dev.vars`，填入自己的设备秘密，然后运行 `npm run dev`。生产构建使用 `npm run build`。
