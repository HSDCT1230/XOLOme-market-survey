import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyCheckboxToggle,
  applyRadioAnswer,
  flattenAnswers,
  getSubmitAnswers,
  getVisibleQuestions,
} from '../packages/core/src/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema', 'v21.json'), 'utf8'));

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
assert(visible.includes('11c'), 'interested should show 11c');

answers = applyRadioAnswer(schema, answers, '11', 'maybe');
visible = getVisibleQuestions(schema, answers).map((q) => q.id);
assert(!visible.includes('11a'), 'maybe should hide 11a');

answers = applyRadioAnswer(schema, answers, '10', 'hologram_album');
visible = getVisibleQuestions(schema, answers).map((q) => q.id);
assert(visible.includes('11ha'), 'album branch');
assert(!visible.includes('11'), 'IP Q11 hidden on album');

// fill minimal required path for submit clean
answers = {
  '1': '18-25',
  '2': 'prefer_not',
  '3': 'unsure',
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
assert(!cleaned['11'], 'submit should drop IP branch when none_attractive');
assert(cleaned['9'][0] === 'none_attractive', 'keep Q9');

const flat = flattenAnswers(cleaned);
assert(flat.topFeature == null, 'flat topFeature null');
assert(flat.ipMerchPayCap === null, 'ipMerchPayCap null');

console.log('smoke OK — core visibility / submit / flatten');
