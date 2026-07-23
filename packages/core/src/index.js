/** Shared survey logic — visibility, branches, flatten, submit cleanup */

export function pick(data, key) {
  if (data[key] !== undefined) return data[key];
  return data[String(key)];
}

export function answerOf(answers, qid) {
  const key = String(qid);
  if (answers[key] !== undefined) return answers[key];
  return undefined;
}

export function allBranchKeys(branchAnswerKeys) {
  const set = new Set();
  Object.values(branchAnswerKeys || {}).forEach((keys) => {
    keys.forEach((k) => set.add(k));
  });
  return Array.from(set);
}

export function isQuestionVisible(q, answers) {
  if (q.hideIf) {
    const hideRules = Array.isArray(q.hideIf) ? q.hideIf : [q.hideIf];
    const hidden = hideRules.some((rule) => {
      const ans = answerOf(answers, rule.qid);
      if (Array.isArray(ans)) {
        return rule.values.some((v) => ans.indexOf(v) !== -1);
      }
      return rule.values.indexOf(ans) !== -1;
    });
    if (hidden) return false;
  }
  if (!q.showIf) return true;
  const rules = Array.isArray(q.showIf) ? q.showIf : [q.showIf];
  return rules.every((rule) => {
    const ans = answerOf(answers, rule.qid);
    if (Array.isArray(ans)) {
      return rule.values.some((v) => ans.indexOf(v) !== -1);
    }
    return rule.values.indexOf(ans) !== -1;
  });
}

export function getVisibleQuestions(schema, answers) {
  return (schema.questions || []).filter((q) => isQuestionVisible(q, answers));
}

export function clearInactiveBranchAnswers(answers, activeBranch, branchAnswerKeys) {
  const keep = new Set(branchAnswerKeys[activeBranch] || []);
  const all = allBranchKeys(branchAnswerKeys);
  const next = { ...answers };
  all.forEach((key) => {
    if (!keep.has(key)) delete next[key];
  });
  return next;
}

export function applyRadioAnswer(schema, answers, qid, value) {
  const key = String(qid);
  let next = { ...answers, [key]: value };
  const branchKeys = schema.branchAnswerKeys || {};

  if (key === '5' && value !== 'other') delete next['5a'];
  if (key === '11' && ['very_interested', 'interested'].indexOf(value) === -1) {
    delete next['11a'];
    delete next['11b'];
    delete next['11c'];
    delete next['11d'];
    delete next['11e']; // legacy removed question (old IP merch pay-cap)
  }
  if (key === '14' && value === 'pay_499') {
    delete next['14a'];
    delete next['14b'];
  }
  if (key === '12' && value === 'not_want') {
    delete next['13'];
    delete next['14'];
    delete next['14a'];
    delete next['14b'];
    delete next['15'];
  }
  if (key === '10') {
    next = clearInactiveBranchAnswers(next, value, branchKeys);
  }
  return next;
}

export function applyCheckboxToggle(schema, answers, qid, value) {
  const key = String(qid);
  let prev = Array.isArray(answers[key]) ? answers[key].slice() : [];
  const NONE_ATTRACTIVE = 'none_attractive';
  const branchKeys = schema.branchAnswerKeys || {};
  const all = allBranchKeys(branchKeys);

  if (key === '9') {
    const idx = prev.indexOf(value);
    if (value === NONE_ATTRACTIVE) {
      prev = idx > -1 ? [] : [NONE_ATTRACTIVE];
    } else if (idx > -1) {
      prev.splice(idx, 1);
    } else {
      prev = prev.filter((v) => v !== NONE_ATTRACTIVE);
      prev.push(value);
    }
  } else {
    const idx = prev.indexOf(value);
    if (idx > -1) prev.splice(idx, 1);
    else prev.push(value);
  }

  const next = { ...answers, [key]: prev };
  if (key === '14a' && prev.indexOf('other') === -1) delete next['14b'];

  if (key === '9') {
    const onlyNone = prev.length === 1 && prev[0] === NONE_ATTRACTIVE;
    if (onlyNone || prev.indexOf(NONE_ATTRACTIVE) !== -1) {
      delete next['10'];
      all.forEach((k) => delete next[k]);
    }
  }
  return next;
}

export function getSubmitAnswers(schema, answers) {
  let next = { ...answers };
  const branchKeys = schema.branchAnswerKeys || {};
  const all = allBranchKeys(branchKeys);

  const q9 = answerOf(next, '9');
  const noneAttractive =
    Array.isArray(q9) && q9.length === 1 && q9[0] === 'none_attractive';
  if (noneAttractive) {
    delete next['10'];
    all.forEach((k) => delete next[k]);
  } else {
    next = clearInactiveBranchAnswers(next, answerOf(next, '10'), branchKeys);
  }

  if (answerOf(next, '5') !== 'other') delete next['5a'];
  if (['very_interested', 'interested'].indexOf(answerOf(next, '11')) === -1) {
    delete next['11a'];
    delete next['11b'];
    delete next['11c'];
    delete next['11d'];
    delete next['11e']; // legacy removed question (old IP merch pay-cap)
  }
  if (answerOf(next, '14') === 'pay_499') {
    delete next['14a'];
    delete next['14b'];
  }
  if (answerOf(next, '12') === 'not_want') {
    delete next['13'];
    delete next['14'];
    delete next['14a'];
    delete next['14b'];
    delete next['15'];
  }
  const barriers = answerOf(next, '14a');
  if (!Array.isArray(barriers) || barriers.indexOf('other') === -1) {
    delete next['14b'];
  }

  const visibleIds = new Set(getVisibleQuestions(schema, next).map((q) => String(q.id)));
  const out = {};
  Object.keys(next).forEach((k) => {
    if (visibleIds.has(String(k))) out[k] = next[k];
  });
  return out;
}

/** Align with miniapp cloud flattenAnswers (no coupon / userId) */
export function flattenAnswers(data) {
  const raw = data || {};
  return {
    age: pick(raw, 1) || null,
    gender: pick(raw, 2) || null,
    digitalBudget: pick(raw, 3) || null,
    purchaseHistory: pick(raw, 4) || null,
    firstImpression: pick(raw, 5) || null,
    firstImpressionNote: pick(raw, '5a') || '',
    compareCategory: pick(raw, 6) || null,
    scenarios: pick(raw, 7) || [],
    deskTime: pick(raw, 8) || null,
    coreInterests: pick(raw, 9) || [],
    topFeature: pick(raw, 10) || null,
    ipEcosystemInterest: pick(raw, 11) || null,
    ipFocusPreference: pick(raw, '11a') || null,
    addonPriceAccept: pick(raw, '11b') || null,
    wishIp: pick(raw, '11c') || '',
    ipShellPremium: pick(raw, '11d') || null,
    albumUse: pick(raw, '11ha') || null,
    albumConcern: pick(raw, '11hb') || null,
    aiUse: pick(raw, '11ai') || null,
    aiProactive: pick(raw, '11ab') || null,
    gameScene: pick(raw, '11gc') || null,
    gamePriority: pick(raw, '11gb') || null,
    entertainmentContent: pick(raw, '11he') || null,
    entertainmentSource: pick(raw, '11hb2') || null,
    preferredDeskScene: pick(raw, 12) || null,
    priceRange: pick(raw, 13) || null,
    participation: pick(raw, 14) || null,
    barriers: pick(raw, '14a') || [],
    barrierNote: pick(raw, '14b') || '',
    buyTiming: pick(raw, 15) || null,
    otherSuggest: pick(raw, 16) || '',
    channels: pick(raw, 17) || [],
    displayName: pick(raw, 18) || '',
    contact: pick(raw, 19) || '',
  };
}

export function validateRequired(schema, answers) {
  const visible = getVisibleQuestions(schema, answers);
  for (const q of visible) {
    if (!q.required) continue;
    const ans = answerOf(answers, q.id);
    if (q.type === 'checkbox') {
      if (!ans || ans.length === 0) {
        return { ok: false, message: '请完成必答题', qid: q.id };
      }
    } else if (!ans || String(ans).trim() === '') {
      return { ok: false, message: '请完成必答题', qid: q.id };
    }
  }
  return { ok: true };
}

export const FLAT_EXPORT_COLUMNS = [
  // Active v23 analysis columns only (no removed/legacy flat keys).
  'age',
  'gender',
  'digitalBudget',
  'purchaseHistory',
  'firstImpression',
  'firstImpressionNote',
  'compareCategory',
  'scenarios',
  'deskTime',
  'coreInterests',
  'topFeature',
  'ipEcosystemInterest',
  'ipFocusPreference',
  'addonPriceAccept',
  'wishIp',
  'ipShellPremium',
  'albumUse',
  'albumConcern',
  'aiUse',
  'aiProactive',
  'gameScene',
  'gamePriority',
  'entertainmentContent',
  'entertainmentSource',
  'preferredDeskScene',
  'priceRange',
  'participation',
  'barriers',
  'barrierNote',
  'buyTiming',
  'otherSuggest',
  'channels',
  'displayName',
  'contact',
];

/** English key → 中文列名（CSV 默认用中文；JSON 仍用英文 key） */
export const FLAT_FIELD_ZH = {
  age: '年龄',
  gender: '性别',
  digitalBudget: '月度数码兴趣预算',
  purchaseHistory: '潮玩或桌面智能购买经历',
  firstImpression: '第一印象品类',
  firstImpressionNote: '第一印象补充',
  compareCategory: '常对比品类',
  scenarios: '日常桌面场景',
  deskTime: '日均桌前时长',
  coreInterests: '最吸引功能',
  topFeature: '最想先试功能',
  ipEcosystemInterest: 'IP生态兴趣',
  ipFocusPreference: '换IP更看重',
  addonPriceAccept: '外壳或数字包可接受花费',
  wishIp: '最想要的IP角色',
  ipShellPremium: '限定外壳加价意愿',
  albumUse: '全息相册用途',
  albumConcern: '全息相册最在意',
  aiUse: 'AI伙伴用途',
  aiProactive: 'AI开口方式',
  gameScene: '游戏联动场景',
  gamePriority: '游戏陪伴最看重',
  entertainmentContent: '全息娱乐内容',
  entertainmentSource: '全息娱乐获取方式',
  preferredDeskScene: '最合适摆放位置',
  priceRange: '整机心理价位',
  participation: '体验资格意向',
  barriers: '观望卡点',
  barrierNote: '观望其他说明',
  buyTiming: '入手时机',
  otherSuggest: '其他建议',
  channels: '了解渠道',
  displayName: '称呼',
  contact: '联系方式',
};

/** flat field → schema question id（用于把 value 译成选项中文） */
export const FLAT_FIELD_QID = {
  age: '1',
  gender: '2',
  digitalBudget: '3',
  purchaseHistory: '4',
  firstImpression: '5',
  firstImpressionNote: '5a',
  compareCategory: '6',
  scenarios: '7',
  deskTime: '8',
  coreInterests: '9',
  topFeature: '10',
  ipEcosystemInterest: '11',
  ipFocusPreference: '11a',
  addonPriceAccept: '11b',
  wishIp: '11c',
  ipShellPremium: '11d',
  albumUse: '11ha',
  albumConcern: '11hb',
  aiUse: '11ai',
  aiProactive: '11ab',
  gameScene: '11gc',
  gamePriority: '11gb',
  entertainmentContent: '11he',
  entertainmentSource: '11hb2',
  preferredDeskScene: '12',
  priceRange: '13',
  participation: '14',
  barriers: '14a',
  barrierNote: '14b',
  buyTiming: '15',
  otherSuggest: '16',
  channels: '17',
  displayName: '18',
  contact: '19',
};

export function cellValue(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join('|');
  return String(v);
}

function buildOptionLabelMap(schema) {
  const map = {};
  (schema.questions || []).forEach((q) => {
    const m = {};
    (q.options || []).forEach((opt) => {
      m[opt.value] = opt.label;
    });
    map[String(q.id)] = m;
  });
  return map;
}

function labelFor(optionMaps, qid, value) {
  if (value == null || value === '') return '';
  const m = optionMaps[String(qid)] || {};
  if (Array.isArray(value)) {
    return value.map((v) => m[v] || v).join('|');
  }
  return m[value] || String(value);
}

function csvEscape(s) {
  const str = String(s ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * Build analysis-friendly CSV.
 * - Default headers: Chinese (Excel-friendly) + UTF-8 BOM
 * - headers=en: English keys (stable for scripts)
 * - Option values decoded to Chinese labels when schema provided
 * - Multi-select joined with |
 */
export function buildExportCsv(rows, schema, { includeContact = false, headers = 'zh' } = {}) {
  const optionMaps = buildOptionLabelMap(schema || { questions: [] });
  const flatKeys = FLAT_EXPORT_COLUMNS.filter((c) =>
    includeContact ? true : c !== 'contact' && c !== 'displayName'
  );

  const metaEn = ['id', 'version', 'created_at'];
  const metaZh = ['答卷ID', '问卷版本', '提交时间'];

  const useZh = headers !== 'en';
  const head = [
    ...(useZh ? metaZh : metaEn),
    ...flatKeys.map((k) => (useZh ? FLAT_FIELD_ZH[k] || k : k)),
  ];

  const lines = [head.map(csvEscape).join(',')];
  for (const row of rows) {
    const flat = typeof row.flat === 'string' ? JSON.parse(row.flat) : row.flat || {};
    const cells = [
      row.id,
      row.version,
      row.created_at,
      ...flatKeys.map((key) => {
        const raw = flat[key];
        const qid = FLAT_FIELD_QID[key];
        if (!qid) return cellValue(raw);
        const q = (schema.questions || []).find((x) => String(x.id) === String(qid));
        if (q && q.type === 'text') return cellValue(raw);
        if (q && (q.type === 'radio' || q.type === 'checkbox')) {
          return labelFor(optionMaps, qid, raw);
        }
        return cellValue(raw);
      }),
    ];
    lines.push(cells.map(csvEscape).join(','));
  }

  // BOM helps Excel on Windows open UTF-8 Chinese correctly
  return `\uFEFF${lines.join('\n')}`;
}
