# XOLOme 独立问卷系统（市场调研）

纯调研 H5：**无微信登录、无优惠券、无支付**。微信小程序问卷本阶段不动。

仓库：https://github.com/HSDCT1230/XOLOme-market-survey

## 为什么国内打不开 workers.dev？

本机探测：`api.xolome.com`（`120.26.0.177`）可访问，但 `*.workers.dev` / `*.pages.dev` **经常超时**（运营商对 Cloudflare 免费域拦截）。  
**服务本身是正常的**（海外/代理可打开）；国内投放请用下面「反代」链接。

## 国内推荐投放链接（需在服务器加一段 nginx）

在 `api.xolome.com` 的 nginx 加入 [`deploy/nginx-survey-china.conf`](deploy/nginx-survey-china.conf) 后：

- 问卷：https://api.xolome.com/survey/
- 导出：https://api.xolome.com/survey/admin

海外直连（备用）：https://xolome-market-survey.xueyingwang1230.workers.dev/

## 字体规范

| 用途 | 中文 | 英文 | weight |
|------|------|------|--------|
| 主标题 | 思源黑体 CN → Noto Sans SC Bold | Helvetica Neue Bold | 700 |
| 题干 / 主按钮 | Bold | Bold | 700 |
| 选中项 / 辅助强调 | Medium（系统合成或 500） | Medium | 500 |
| 正文 / 选项 | Normal | Regular | 400 |
| 品牌英文 XOLOME | — | Helvetica Neue Bold | 700 |

字体已 **本地打包**（简体子集 Normal+Bold，兼顾国内网络与手机流量）。

## 手机适配

- `viewport-fit=cover` + safe-area（刘海 / Home 条）
- 触控热区 ≥ 44px；`touch-action: manipulation`
- 输入框 16px 防止 iOS 聚焦放大
- `clamp()` 字号；窄屏（≤360）优化
- 相对路径 API，支持根路径与 `/survey/` 反代

## Cloudflare（已部署）

- Worker：https://xolome-market-survey.xueyingwang1230.workers.dev/
- D1：`xolome-survey`
- 导出密钥：`wrangler secret put SURVEY_ADMIN_TOKEN`

## 本地开发

```bash
npm install
npm run smoke
npm run dev:api
npm run dev:web
```

## 再部署

```bash
npm run cf:deploy
```

## 运营 / 零基础分析

见 [`docs/数据分析与后台指南.md`](docs/数据分析与后台指南.md)：如何用 `/admin` 导出 CSV、数据存在哪、怎么做透视与交叉分析。
