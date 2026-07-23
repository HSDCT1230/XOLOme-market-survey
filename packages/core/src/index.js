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
    delete next['11e'];
  }
  if (key === '14' && value === 'pay_499') {
    delete next['14a'];
    delete next['14b'];
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
    delete next['11e'];
  }
  if (answerOf(next, '14') === 'pay_499') {
    delete next['14a'];
    delete next['14b'];
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
    ipMerchPayCap: null,
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
  'ipMerchPayCap',
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

export function cellValue(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.join('|');
  return String(v);
}
