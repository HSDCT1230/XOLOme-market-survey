# XOLOme 独立问卷系统（市场调研）

纯调研 H5：**无微信登录、无优惠券、无支付**。微信小程序问卷本阶段不动。

仓库：https://github.com/HSDCT1230/XOLOme-market-survey

## 结构

```
schema/v21.json       # 题目定义（改题升 version）
packages/core/        # 跳题 / flatten / 提交清理
apps/web/             # Vite + React H5
apps/api/             # 本地 Node + SQLite（可选）
workers/              # Cloudflare Workers + D1（推荐线上）
migrations/           # D1 schema
docs/PARITY.md        # 与小程序 v21 对拍清单
```

## Cloudflare 线上

- 问卷：https://xolome-market-survey.xueyingwang1230.workers.dev/
- 导出：https://xolome-market-survey.xueyingwang1230.workers.dev/admin  
  （密钥已用 `wrangler secret put SURVEY_ADMIN_TOKEN` 配置，勿写入仓库）
- 健康检查：`/api/health`

## 本地开发（双进程）

```bash
npm install
npm run smoke
npm run dev:api   # :8787
npm run dev:web   # :5173 代理 /api
```

- 问卷 http://127.0.0.1:5173/
- 导出 http://127.0.0.1:5173/admin
- 默认导出密钥 `xolome-dev-export-token`（务必在生产改掉）

## Cloudflare 部署（推荐）

1. 登录：`npx wrangler login`
2. 创建 D1：`npm run cf:d1:create`，把返回的 `database_id` 写入 [`wrangler.jsonc`](wrangler.jsonc)
3. 应用迁移：`npm run cf:d1:migrate`
4. 设置密钥（推荐用 secret，勿提交仓库）：
   ```bash
   npx wrangler secret put SURVEY_ADMIN_TOKEN
   ```
5. 部署：`npm run cf:deploy`
6. 投放链接：Workers 给出的 `*.workers.dev` 或绑定自定义域；导出页 `/admin`

本地模拟 CF：`npm run cf:dev`

## 改题

1. 改 `schema/v21.json` 或新建 `v22.json` 并升 `version` / `draftKey`
2. 若 flatten 字段变了，同步 `packages/core`
3. 重新 `npm run cf:deploy`

## 与小程序

- 小程序仓库：https://github.com/HSDCT1230/XOLOme-miniapp — 问卷逻辑暂冻结
- 云库历史答卷不自动合并；需要时从微信云开发单独导出
