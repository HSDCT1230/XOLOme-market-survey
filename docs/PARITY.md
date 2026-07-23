# 与小程序 v21 对拍验收清单

对照仓库：`XOLOme-Miniapp/xolome-miniapp/miniprogram/pages/survey/survey.js`（CACHE `v21`）  
独立系统：`XOLOme-Survey/schema/v21.json` + `@xolome/survey-core`

## 文案 / 选项

- [ ] Q12 题干：你觉得XOLOme X1主要放在哪里使用最合适？
- [ ] Q12 含「想用，但暂时无法确定」「我根本不想用它」
- [ ] Q13「暂时不好说」在「再便宜目前也不会考虑」之前
- [ ] Q14a 含合并项「不确定好不好用，想先看真人评测」
- [ ] Q17 微信选项含视频号、小程序
- [ ] 顶栏无「发券」文案；成功页无券码、无预购跳转

## 逻辑

- [ ] Q9 选「暂时都不太吸引」→ 隐藏 Q10 与全部 11 分支，提交不含这些键
- [ ] Q9 有兴趣 → Q10 显示；Q10=`none_first` → 无 11 分支
- [ ] Q10=`ip_partner` + 11 感兴趣 → 显示 11a–11d；maybe/不感兴趣 → 仅 11
- [ ] Q10 切到相册/AI/游戏/娱乐 → 仅对应两题，IP 键清空
- [ ] Q5=`other` → 5a；否则提交无 5a
- [ ] Q14=`pay_499` → 无 14a/14b；观望 → 有 14a；选 other → 14b
- [ ] 仅提交当前可见题答案
- [ ] Q9 `none_attractive` 与其它选项互斥

## 数据

- [ ] `POST /api/submit` 写入 SQLite，`version=v21`
- [ ] `flat` 字段与云函数 flattenAnswers 对齐（无 couponCode/openid）
- [ ] 导出 CSV 默认不含 contact/displayName；`includeContact=1` 可含

## 明确差异（允许）

- 无微信登录 / openid 一人一票
- 无优惠券
- 联系方式题 placeholder 改为「仅用于后续联系」（非发券）
