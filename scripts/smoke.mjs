import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyCheckboxToggle,
  applyRadioAnswer,
  buildExportCsv,
  flattenAnswers,
  getSubmitAnswers,
  getVisibleQuestions,
} from '../packages/core/src/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema', 'v23.json'), 'utf8'));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let answers = {};
answers = applyCheckboxToggle(schema, answers, '9', 'none_attractive');
let visible = getVisibleQuestions(schema, answers).map((q) => q.id);
assert(!visible.includes('10'), 'Q9 none should hide Q10');
assert(!visible.some((id) => String(id).startsWith('11')), 'Q9 none should hide branch 11*');

answers = applyCheckboxToggle(schema, answers, '9', 'ip_partner');
answers = applyRadioAnswer(schema, answers, '10', 'ip_partner');
answers = applyRadioAnswer(schema, answers, '11', 'interested');
visible = getVisibleQuestions(schema, answers).map((q) => q.id);
assert(visible.includes('11a'), 'interested should show 11a');

answers = applyRadioAnswer(schema, answers, '11', 'maybe');
visible = getVisibleQuestions(schema, answers).map((q) => q.id);
assert(!visible.includes('11a'), 'maybe should hide 11a');

answers = applyRadioAnswer(schema, answers, '10', 'hologram_album');
visible = getVisibleQuestions(schema, answers).map((q) => q.id);
assert(visible.includes('11ha'), 'album branch');
assert(!visible.includes('11'), 'IP Q11 hidden on album');

answers = applyRadioAnswer(schema, { '12': 'desk_wfh', '13': 'unsure', '15': 'asap' }, '12', 'not_want');
visible = getVisibleQuestions(schema, answers).map((q) => q.id);
assert(!visible.includes('13'), 'not_want hides 13');
assert(!visible.includes('14'), 'not_want hides 14');
assert(!visible.includes('15'), 'not_want hides 15');
assert(!answers['13'], 'not_want clears 13 answer');

answers = {
  '1': '18-25',
  '2': 'prefer_not',
  '3': '3000_6000',
  '4': 'neither',
  '5': 'ai_device',
  '6': 'unclear',
  '7': ['work'],
  '8': '2_4h',
  '9': ['none_attractive'],
  '12': 'unsure',
  '13': 'unsure',
  '14': 'learn_more',
  '14a': ['want_reviews'],
  '15': 'uncertain',
  '17': ['wechat'],
  '10': 'ip_partner',
  '11': 'interested',
  '11a': 'shell',
};
const cleaned = getSubmitAnswers(schema, answers);
assert(!cleaned['10'], 'submit should drop Q10 when none_attractive');
assert(cleaned['9'][0] === 'none_attractive', 'keep Q9');

const flat = flattenAnswers(cleaned);
assert(flat.digitalBudget === '3000_6000', 'budget tier');
assert(!Object.prototype.hasOwnProperty.call(flat, 'ipMerchPayCap'), 'no deprecated ipMerchPayCap in flat');

const csv = buildExportCsv(
  [
    {
      id: 't1',
      version: 'v23',
      created_at: '2026-07-23T00:00:00.000Z',
      flat: JSON.stringify({ ...flat, ipMerchPayCap: 'legacy_should_be_ignored' }),
    },
  ],
  schema,
  { headers: 'zh' }
);
assert(csv.charCodeAt(0) === 0xfeff, 'csv utf8 bom');
assert(csv.includes('答卷ID'), 'csv zh header');
assert(csv.includes('月度数码兴趣预算'), 'csv budget zh');
assert(!csv.includes('已弃用'), 'csv has no deprecated header label');
assert(!csv.includes('ipMerchPayCap'), 'csv has no ipMerchPayCap column');
assert(!csv.includes('IP周边付费上限'), 'csv has no removed IP merch column');

console.log('smoke OK — v23 visibility / submit / flatten / csv');
