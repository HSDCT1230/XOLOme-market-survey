# 与小程序问卷对拍验收清单

对照仓库：`XOLOme-Miniapp/xolome-miniapp/miniprogram/pages/survey/survey.js`  
独立系统基线：`XOLOme-Survey/schema/v1.0.json` + `@xolome/survey-core`  
**当前线上/开发 schema：`schema/v1.0.json`（入库 `version` 字段为 `v1.0`）。**

自动化：`npm run smoke`（v1.0 可见性 / 提交清理 / flatten / 中文 CSV 题号表头）

历史草稿 schema（勿作主加载）：`schema/archive/`

## 文案 / 选项

- [x] Q12 题干：你觉得XOLOme X1主要放在哪里使用最合适？（schema 已对齐）
- [x] Q12 含「想用，但暂时无法确定」「我根本不想用它」
- [x] Q13「暂时不好说」在合适位置
- [x] Q14a 含合并项「不确定好不好用，想先看真人评测」
- [x] Q17 微信选项含视频号、小程序
- [x] 顶栏无「发券」文案；成功页无券码、无预购跳转（subtitle 为空；成功页仅感谢语 + 答卷编号）

## 逻辑（smoke + 代码对拍）

- [x] Q9 选「暂时都不太吸引」→ 隐藏 Q10 与全部 11 分支，提交不含这些键
- [x] Q9 有兴趣 → Q10 显示；Q10=`none_first` → 无 11 分支
- [x] Q10=`ip_partner` + 11 感兴趣 → 显示 11a–11d；maybe/不感兴趣 → 仅 11
- [x] Q10 切到相册 → 仅 11ha/11hb，IP 键清空
- [x] Q5=`other` → 5a；否则提交无 5a（core `applyRadioAnswer` / `getSubmitAnswers`）
- [x] Q14=`pay_499` → 无 14a/14b；观望 → 有 14a；选 other → 14b
- [x] Q12=`not_want` → 隐藏并清空 13–15（H5 schema `hideIf`）
- [x] 仅提交当前可见题答案
- [x] Q9 `none_attractive` 与其它选项互斥

## 数据

- [x] `POST /api/submit` 写入 SQLite/D1，`version` 取当前 schema（`v1.0`）
- [x] `flat` 字段与分析导出对齐（无 couponCode/openid）
- [x] 导出 CSV 默认中文表头、不含 contact/displayName；`includeContact=1` / `headers=en` 可调

## 明确差异（允许）

- 独立 H5，不接入微信登录 / openid 一人一票（与小程序对拍差异，非用户文案）
- 不发券、不跳转预购（对拍验收项；成功页仅感谢语 + 答卷编号）
- 联系方式题 placeholder：「仅用于后续联系」
