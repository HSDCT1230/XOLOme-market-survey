import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const j = JSON.parse(
  execSync('git show HEAD:schema/v1.0.json', { encoding: 'buffer' }).toString('utf8'),
);
const byId = Object.fromEntries(j.questions.map((q) => [q.id, q]));

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function letter(i) {
  return String.fromCharCode(65 + i);
}

function optRef(qid, value) {
  const q = byId[qid];
  const i = (q?.options || []).findIndex((o) => o.value === value);
  if (i < 0) return value;
  return `${letter(i)}. ${q.options[i].label}`;
}

function skipBanner(whenText, groupText) {
  return `<div class="skip">
  <span class="skip-k">跳过本组</span>
  <span class="skip-b">若 ${esc(whenText)} → 跳过 ${esc(groupText)}</span>
</div>`;
}

function qBlock(q) {
  const opts = q.options || [];
  const n = opts.length;
  const cols = n <= 1 ? 1 : n === 2 ? 2 : n <= 4 ? 2 : 3;
  const body =
    q.type === 'text' || q.type === 'contact' || !n
      ? `<div class="fill">填空${q.required ? '（必填）' : '（选填）'}</div>`
      : `<div class="opts cols-${cols}">${opts
          .map(
            (o, i) =>
              `<div class="opt"><span class="ab">${letter(i)}</span><span class="lb">${esc(o.label)}</span></div>`,
          )
          .join('')}</div>`;

  return `<article class="q">
  <div class="qh">
    <b>Q${esc(q.id)}</b>
    <div>
      <div class="title">${esc(q.title)}</div>
    </div>
  </div>
  ${body}
</article>`;
}

function moduleBlock({ no, title, purpose, range, children }) {
  return `<section class="mod" id="m${no}">
  <header class="mod-h">
    <div class="mod-no">${String(no).padStart(2, '0')}</div>
    <div class="mod-meta">
      <h2>${esc(title)}</h2>
      <p>${esc(purpose)}</p>
    </div>
    <div class="mod-range">${esc(range)}</div>
  </header>
  <div class="mod-b">${children}</div>
</section>`;
}

function groupBlock({ title, note, children }) {
  return `<div class="grp">
  <div class="grp-h">
    <span class="grp-t">${esc(title)}</span>
    ${note ? `<span class="grp-n">${esc(note)}</span>` : ''}
  </div>
  <div class="grp-b">${children}</div>
</div>`;
}

const branchIp = {
  name: 'A · IP 伙伴',
  ids: ['11', '11a', '11b', '11c', '11d'],
  tone: 'a',
};
const branchOthers = [
  { name: 'B · 全息相册', ids: ['11ha', '11hb'], tone: 'b' },
  { name: 'C · 游戏陪伴', ids: ['11gc', '11gb'], tone: 'c' },
  { name: 'D · AI 伙伴', ids: ['11ai', '11ab'], tone: 'd' },
  { name: 'E · 全息娱乐', ids: ['11he', '11hb2'], tone: 'e' },
];

const toc = [
  ['01', '基础画像', '谁在答'],
  ['02', '产品认知', '怎么看 X1'],
  ['03', '使用场景', '桌前怎么用'],
  ['04', '功能吸引', '先被什么打动'],
  ['05', '功能深挖', '按首选分支'],
  ['06', '摆放与转化', '愿不愿意买'],
  ['07', '收尾触达', '渠道与联系'],
];

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>XOLOme 市场调研问卷 · 全部题目 · v1.0</title>
<style>
  :root {
    --brand:#6ec73b; --brand-deep:#4fa01f; --brand-soft:#eef8e6;
    --ink:#1f2a18; --muted:#6b6b6b; --line:#d9e5d0; --soft:#f3f8ef; --page:#eef4e9;
    --ab:var(--brand);
    --skip:#b42318; --skip-bg:#fff1f0; --skip-bd:#f3b0a8;
    --mod:var(--brand); --grp:#3f6b28;
  }
  * { box-sizing:border-box; }
  html { -webkit-text-size-adjust:100%; text-size-adjust:100%; }
  body {
    margin:0; color:var(--ink); background:var(--page);
    font:15px/1.5 "Segoe UI","PingFang SC","Noto Sans SC",sans-serif;
    overflow-x:hidden;
  }
  .wrap {
    max-width:min(1600px, 100%);
    margin:0 auto;
    padding:32px 28px 96px;
    padding-left:max(16px, env(safe-area-inset-left));
    padding-right:max(16px, env(safe-area-inset-right));
    padding-bottom:max(96px, env(safe-area-inset-bottom));
  }

  .hero {
    background:linear-gradient(135deg, var(--brand-deep) 0%, var(--brand) 100%);
    color:#fff; border-radius:14px; padding:20px 22px 18px; margin-bottom:18px;
  }
  .hero h1 { margin:0; font-size:clamp(18px, 4.5vw, 24px); font-weight:700; word-break:break-word; }

  .toc {
    display:grid; grid-template-columns:repeat(7,1fr); gap:8px; margin-bottom:22px;
  }
  .toc a {
    text-decoration:none; color:var(--ink); background:#fff; border:1px solid var(--line);
    border-radius:10px; padding:10px 8px; text-align:center; display:block;
    -webkit-tap-highlight-color:transparent;
  }
  .toc a:hover, .toc a:active { border-color:var(--brand); }
  .toc strong { display:block; font-size:14px; margin-bottom:2px; color:var(--brand-deep); }
  .toc em { display:block; font-style:normal; font-size:11px; color:var(--muted); }
  .toc small { display:block; margin-top:4px; font-size:10px; color:#999; }

  .mod {
    background:#fff; border:1px solid var(--line); border-radius:14px;
    margin:0 0 18px; overflow:hidden;
    box-shadow:0 1px 0 rgba(0,0,0,.02);
  }
  .mod-h {
    display:grid; grid-template-columns:64px 1fr auto; gap:12px; align-items:center;
    padding:14px 16px; background:linear-gradient(90deg, var(--brand-deep), var(--brand)); color:#fff;
  }
  .mod-no {
    width:52px; height:52px; border-radius:12px; background:#fff; color:var(--brand-deep);
    display:flex; align-items:center; justify-content:center;
    font-size:18px; font-weight:800; letter-spacing:-.02em; flex-shrink:0;
  }
  .mod-meta { min-width:0; }
  .mod-meta h2 { margin:0; font-size:clamp(16px, 4vw, 18px); font-weight:700; }
  .mod-meta p { margin:4px 0 0; font-size:13px; color:rgba(255,255,255,.88); }
  .mod-range {
    font-size:11px; font-weight:600; letter-spacing:.04em;
    padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.35); color:#fff;
    white-space:nowrap;
  }
  .mod-b { padding:14px 14px 16px; display:flex; flex-direction:column; gap:12px; }

  .grp {
    border:1px solid var(--line); border-radius:12px; background:var(--soft); overflow:hidden;
  }
  .grp-h {
    display:flex; align-items:baseline; justify-content:space-between; gap:10px; flex-wrap:wrap;
    padding:8px 12px; background:var(--brand-soft); border-bottom:1px solid var(--line);
  }
  .grp-t { font-size:13px; font-weight:700; color:var(--grp); letter-spacing:.02em; }
  .grp-n { font-size:12px; color:var(--muted); }
  .grp-b { padding:10px; display:flex; flex-direction:column; gap:10px; }

  .pair { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .triple { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
  .stack { display:flex; flex-direction:column; gap:10px; }

  .q {
    border:1px solid var(--line); border-radius:10px;
    padding:12px 14px; background:#fff; height:100%;
    min-width:0;
  }
  .qh { display:grid; grid-template-columns:52px 1fr; gap:8px; margin-bottom:10px; }
  .qh b {
    width:56px; height:30px; display:flex; align-items:center; justify-content:center;
    border-radius:6px; background:var(--brand); color:#fff; font-size:13px; flex-shrink:0;
  }
  .title { font-weight:600; font-size:15px; word-break:break-word; }

  .opts { display:grid; gap:6px; }
  .opts.cols-1 { grid-template-columns:1fr; }
  .opts.cols-2 { grid-template-columns:1fr 1fr; }
  .opts.cols-3 { grid-template-columns:1fr 1fr 1fr; }

  .opt {
    display:grid; grid-template-columns:22px 1fr; gap:8px; align-items:start;
    border:1px solid var(--line); border-radius:8px; padding:8px 10px; background:var(--soft);
    min-width:0;
  }
  .ab {
    width:20px; height:20px; border-radius:50%; background:var(--brand); color:#fff;
    display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0;
  }
  .lb { font-size:13px; line-height:1.4; padding-top:1px; word-break:break-word; }
  .fill { font-size:13px; color:var(--muted); padding:4px 0; }

  .skip {
    display:flex; align-items:flex-start; gap:10px; flex-wrap:wrap; width:100%;
    padding:12px 14px;
    border:1px solid var(--skip-bd); border-left:4px solid var(--skip);
    border-radius:8px; background:var(--skip-bg); color:var(--skip);
    font-size:13px; line-height:1.45;
  }
  .skip-k {
    flex:0 0 auto; font-size:11px; font-weight:700; letter-spacing:.04em;
    padding:2px 8px; border-radius:4px; background:var(--skip); color:#fff;
  }
  .skip-b { flex:1 1 200px; font-weight:500; min-width:0; word-break:break-word; }

  .branches { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; }
  .branch-ip, .col {
    border:1px solid var(--tone-line, var(--line));
    border-radius:12px;
    background:var(--tone-bg, #fff);
    padding:12px;
    display:flex; flex-direction:column; gap:10px; min-width:0;
  }
  .branch-ip > h3, .col > h3 {
    margin:0; font-size:13px; font-weight:700; color:#fff;
    padding:8px 10px; border-radius:8px;
    background:var(--tone, var(--brand));
    display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;
  }
  .branch-ip > h3 small, .col > h3 small {
    font-weight:500; color:rgba(255,255,255,.88); font-size:11px;
  }
  .branch-ip-flow { display:flex; flex-direction:column; gap:10px; }
  .branch-ip .opts.cols-3 { grid-template-columns:1fr 1fr; }
  .col .q { padding:12px 14px; }
  .col .opts.cols-2 { grid-template-columns:1fr 1fr; }
  .col .opts.cols-3 { grid-template-columns:1fr 1fr; }

  /* 五路分支配色 · 取自 XOLOme 绿/橙/珊瑚/炭黑，A 用蓝区分主分支 */
  .tone-a { --tone:#2f6fed; --tone-bg:#eef3ff; --tone-line:#b7c9f7; }
  .tone-b { --tone:#5bb82e; --tone-bg:#f0f9e8; --tone-line:#b7e08f; }
  .tone-b > h3 { background:linear-gradient(90deg,#8fdf5a,#6ec73b); color:#1f2a18; }
  .tone-b > h3 small { color:rgba(31,42,24,.7); }
  .tone-c { --tone:#ff8f00; --tone-bg:#fff6e8; --tone-line:#ffd399; }
  .tone-d { --tone:#ff595f; --tone-bg:#fff1f2; --tone-line:#ffc2c4; }
  .tone-e { --tone:#2e2e2e; --tone-bg:#f3f3f3; --tone-line:#cfcfcf; }

  .tone-a .qh b, .tone-a .ab { background:var(--tone); }
  .tone-b .qh b, .tone-b .ab { background:#6ec73b; }
  .tone-c .qh b, .tone-c .ab { background:var(--tone); }
  .tone-d .qh b, .tone-d .ab { background:var(--tone); }
  .tone-e .qh b, .tone-e .ab { background:var(--tone); }

  /* 平板 */
  @media (max-width:1024px) {
    .toc { grid-template-columns:repeat(4,1fr); }
    .triple { grid-template-columns:1fr 1fr; }
    .opts.cols-3 { grid-template-columns:1fr 1fr; }
  }

  /* 手机 */
  @media (max-width:720px) {
    .wrap {
      padding:16px 12px 72px;
      padding-left:max(12px, env(safe-area-inset-left));
      padding-right:max(12px, env(safe-area-inset-right));
    }
    .hero { border-radius:12px; padding:16px 16px 14px; margin-bottom:12px; }
    .toc {
      display:flex; gap:8px; overflow-x:auto; -webkit-overflow-scrolling:touch;
      scroll-snap-type:x mandatory; padding-bottom:6px; margin-bottom:14px;
    }
    .toc a {
      flex:0 0 auto; min-width:112px; scroll-snap-align:start; padding:10px 12px;
    }
    .toc small { display:none; }
    .mod { border-radius:12px; margin:0 0 12px; }
    .mod-h {
      grid-template-columns:44px 1fr;
      gap:10px; padding:12px;
    }
    .mod-no { width:44px; height:44px; font-size:15px; border-radius:10px; }
    .mod-range { grid-column:2; justify-self:start; margin-top:2px; }
    .mod-meta p { font-size:12px; }
    .mod-b { padding:10px; gap:10px; }
    .grp-b { padding:8px; gap:8px; }
    .pair, .triple, .branches { grid-template-columns:1fr; }
    .opts.cols-2,
    .opts.cols-3,
    .branch-ip .opts.cols-3,
    .col .opts.cols-2,
    .col .opts.cols-3 { grid-template-columns:1fr; }
    .qh { grid-template-columns:48px 1fr; }
    .qh b { width:48px; height:28px; font-size:12px; }
    .title { font-size:14px; }
    .opt { padding:10px; }
    .lb { font-size:14px; }
    .skip { padding:10px 12px; font-size:12.5px; }
    .skip-b { flex:1 1 100%; }
    .branch-ip, .col { padding:10px; }
  }

  @media (max-width:380px) {
    .toc a { min-width:100px; }
    .hero h1 { font-size:17px; }
  }

  @media print {
    body { background:#fff; }
    .wrap { padding:10px; max-width:none; }
    .mod, .q, .col, .skip { break-inside:avoid; }
    .toc { display:none; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <h1>XOLOme 市场调研问卷 · 全部题目 · v1.0</h1>
  </div>

  <nav class="toc">
    ${toc
      .map(
        ([no, t, d], i) =>
          `<a href="#m${i + 1}"><strong>${no}</strong><em>${esc(t)}</em><small>${esc(d)}</small></a>`,
      )
      .join('')}
  </nav>

  ${moduleBlock({
    no: 1,
    title: '基础画像',
    purpose: '样本分层：年龄 / 性别 / 预算 / 品类经验',
    range: 'Q1–Q4',
    children: `
      ${groupBlock({
        title: '题组 A · 潜在用户属性',
        note: '硬分层字段',
        children: `<div class="pair">${qBlock(byId['1'])}${qBlock(byId['2'])}</div>`,
      })}
      ${groupBlock({
        title: '题组 B · 消费习惯与品类经验',
        note: '支付力与品类熟悉度',
        children: `<div class="pair">${qBlock(byId['3'])}${qBlock(byId['4'])}</div>`,
      })}`,
  })}

  ${moduleBlock({
    no: 2,
    title: '产品认知',
    purpose: '第一印象与品类锚定：用户把 X1 归到哪一类',
    range: 'Q5–Q6',
    children: `
      ${groupBlock({
        title: '题组 A · 第一印象',
        note: '选「其他」才出现补充',
        children: `<div class="stack">${qBlock(byId['5'])}${qBlock(byId['5a'])}</div>`,
      })}
      ${groupBlock({
        title: '题组 B · 竞品参照',
        note: '竞品心智',
        children: qBlock(byId['6']),
      })}`,
  })}

  ${moduleBlock({
    no: 3,
    title: '使用场景',
    purpose: '桌前情境：场景构成 × 投入时长',
    range: 'Q7–Q8',
    children: `
      ${groupBlock({
        title: '题组 A · 场景与时长',
        note: '后续价位/摆放交叉分析底盘',
        children: `<div class="pair">${qBlock(byId['7'])}${qBlock(byId['8'])}</div>`,
      })}`,
  })}

  ${moduleBlock({
    no: 4,
    title: '功能吸引',
    purpose: '先筛兴趣，再强制排序「最想先试」',
    range: 'Q9–Q10',
    children: `
      ${groupBlock({
        title: '题组 A · 兴趣多选',
        note: '可多选；无兴趣则短路',
        children: `<div class="stack">${qBlock(byId['9'])}${skipBanner(`Q9＝${optRef('9', 'none_attractive')}`, '本组（Q10 及全部 Q11*）')}</div>`,
      })}
      ${groupBlock({
        title: '题组 B · 兴趣首选',
        note: '决定下一模块进入哪条分支',
        children: qBlock(byId['10']),
      })}`,
  })}

  ${moduleBlock({
    no: 5,
    title: '功能深挖',
    purpose: '按 Q10 互斥进入；只深挖「最想先试」的那条产品线',
    range: 'Q11*',
    children: `
      ${skipBanner(`Q10＝${optRef('10', 'none_first')}`, '本组（全部 Q11*）')}
      ${skipBanner(`Q11＝${optRef('11', 'maybe')} / ${optRef('11', 'not_interested')}`, '本组（Q11a–Q11d）')}
      <div class="branch-ip tone-${branchIp.tone}">
        <h3>${esc(branchIp.name)}<small>Q11 → Q11a–d · 共 5 题</small></h3>
        <div class="branch-ip-flow">
          ${branchIp.ids.map((id) => qBlock(byId[id])).join('')}
        </div>
      </div>
      <div class="branches">
        ${branchOthers
          .map(
            (b) => `<div class="col tone-${b.tone}"><h3>${esc(b.name)}</h3>${b.ids
              .map((id) => qBlock(byId[id]))
              .join('')}</div>`,
          )
          .join('')}
      </div>`,
  })}

  ${moduleBlock({
    no: 6,
    title: '摆放与转化',
    purpose: '场景落点 → 价位 / 体验资格 / 时机；拒绝样本短路转化题',
    range: 'Q12–Q15',
    children: `
      ${groupBlock({
        title: '题组 A · 摆放落点',
        note: '转化漏斗入口',
        children: qBlock(byId['12']),
      })}
      ${groupBlock({
        title: '题组 B · 转化意向',
        note: '价位 · 定金体验 · 卡点 · 时机',
        children: `
          ${skipBanner(`Q12＝${optRef('12', 'not_want')}`, '本组（Q13–Q15）')}
          <div class="stack">${['13', '14', '14a', '14b', '15'].map((id) => qBlock(byId[id])).join('')}</div>`,
      })}`,
  })}

  ${moduleBlock({
    no: 7,
    title: '收尾触达',
    purpose: '开放建议 · 获客渠道 · 可选联系方式',
    range: 'Q16–Q19',
    children: `
      ${groupBlock({
        title: '题组 A · 建议与渠道',
        note: '定性补充 + 投放归因',
        children: `<div class="pair">${qBlock(byId['16'])}${qBlock(byId['17'])}</div>`,
      })}
      ${groupBlock({
        title: '题组 B · 联系方式',
        note: '选填；导出时可单独勾选',
        children: `<div class="pair">${qBlock(byId['18'])}${qBlock(byId['19'])}</div>`,
      })}`,
  })}
</div>
</body>
</html>`;

mkdirSync('docs', { recursive: true });
const outName = 'XOLOme-market-survey-all-questions-v1.0.html';
const outPath = join('docs', outName);
writeFileSync(outPath, html, 'utf8');
for (const old of [
  'survey-flow-v1.0.html',
  'XOLOme 市场调研问卷 · 全部题目 · v1.0.html',
]) {
  const oldPath = join('docs', old);
  if (existsSync(oldPath)) unlinkSync(oldPath);
}
console.log('OK', outPath);
