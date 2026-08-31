# MiTV OTA Monitor

小米电视 OTA 轻量监测站点。MVP 每日调用小米官方 OTA 检查接口，把最新状态持久化到 Cloudflare D1，并提供网页与 JSON 状态接口。

## 隐私边界

仓库只保留机型级参数和 OTA 客户端通用常量。电视序列号与设备身份值必须通过部署环境变量提供，禁止提交到 Git。

必需秘密：`MITV_SN`、`MITV_DEVICE_IDENTITY`。可选 `CHECK_TOKEN` 用于保护 `POST /api/check` 手动检查接口。

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

## 志愿者机型演进

后续可把产品代码、device、module、显示名称、当前版本和语言抽成机型 registry，存入 D1/KV。序列号、MAC 等设备身份不得公开；需要身份的查询应使用服务端秘密、专用测试设备，或经实测证明可复用的匿名身份。

## 本地开发

复制 `.dev.vars.example` 为 `.dev.vars`，填入自己的设备秘密，然后运行 `npm run dev`。生产构建使用 `npm run build`。
