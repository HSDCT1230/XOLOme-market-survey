import { useCallback, useEffect, useMemo, useState } from 'react';
import schema from '@schema';
import {
  answerOf,
  applyCheckboxToggle,
  applyRadioAnswer,
  getSubmitAnswers,
  getVisibleQuestions,
} from '@xolome/survey-core';

const DRAFT_KEY = schema.draftKey || '_xolome_survey_draft_v21_h5';

function buildPages(questions) {
  const pages = [];
  let i = 0;
  while (i < questions.length) {
    const q = questions[i];
    if (q.type === 'text') {
      const next = questions[i + 1];
      if (next && next.type === 'text' && !next.showIf && !q.showIf) {
        pages.push([q, next]);
        i += 2;
      } else {
        pages.push([q]);
        i += 1;
      }
    } else {
      pages.push([q]);
      i += 1;
    }
  }
  return pages;
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function AdminPanel() {
  const [token, setToken] = useState('');
  const [includeContact, setIncludeContact] = useState(false);
  const [msg, setMsg] = useState('');

  const exportUrl = (format) => {
    const q = new URLSearchParams({
      token,
      format,
      includeContact: includeContact ? '1' : '0',
    });
    return `/api/export?${q.toString()}`;
  };

  const download = async (format) => {
    setMsg('');
    try {
      const res = await fetch(exportUrl(format));
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j.msg || `导出失败 (${res.status})`);
        return;
      }
      if (format === 'json') {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `xolome-survey-${schema.version}.json`;
        a.click();
        setMsg(`已导出 ${data.count ?? 0} 条 JSON`);
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `xolome-survey-${schema.version}.csv`;
      a.click();
      setMsg('已开始下载 CSV');
    } catch (e) {
      setMsg(e.message || '网络错误');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">XOLOme Survey</div>
        <h1 className="title">导出管理</h1>
        <p className="subtitle">输入管理密钥导出答卷（默认本地密钥见 README）</p>
      </header>
      <div className="card admin">
        <label htmlFor="token">管理密钥</label>
        <input
          id="token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="SURVEY_ADMIN_TOKEN"
        />
        <label>
          <input
            type="checkbox"
            checked={includeContact}
            onChange={(e) => setIncludeContact(e.target.checked)}
          />
          包含联系方式（displayName / contact）
        </label>
        <div className="admin-actions">
          <button className="btn btn-primary" type="button" onClick={() => download('csv')}>
            导出 CSV
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => download('json')}>
            导出 JSON
          </button>
          <a className="btn btn-secondary" href="/" style={{ textAlign: 'center', textDecoration: 'none' }}>
            返回问卷
          </a>
        </div>
        {msg ? <p className="q-hint stack-gap">{msg}</p> : null}
      </div>
    </div>
  );
}

function QuestionBlock({ q, answers, onRadio, onCheckbox, onText, spaced }) {
  const value = answerOf(answers, q.id);
  const badge = q.badge || q.id;

  return (
    <div className={spaced ? 'stack-gap' : undefined}>
      <div className="q-badge">第 {badge} 题{q.required ? '' : ' · 选填'}</div>
      <h2 className="q-title">{q.title}</h2>
      {q.hint ? <p className="q-hint">{q.hint}</p> : null}

      {q.type === 'text' ? (
        <textarea
          className="textarea"
          value={value || ''}
          placeholder={q.placeholder || ''}
          maxLength={300}
          onChange={(e) => onText(q.id, e.target.value)}
        />
      ) : (
        <div className="options">
          {(q.options || []).map((opt) => {
            const selected =
              q.type === 'checkbox'
                ? Array.isArray(value) && value.indexOf(opt.value) !== -1
                : value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`option${selected ? ' selected' : ''}`}
                onClick={() =>
                  q.type === 'checkbox'
                    ? onCheckbox(q.id, opt.value)
                    : onRadio(q.id, opt.value)
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  const [answers, setAnswers] = useState(() => loadDraft());
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [submitId, setSubmitId] = useState('');

  const pages = useMemo(
    () => buildPages(getVisibleQuestions(schema, answers)),
    [answers]
  );

  useEffect(() => {
    if (step > pages.length - 1) setStep(Math.max(0, pages.length - 1));
  }, [pages.length, step]);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
  }, [answers]);

  const showToast = useCallback((text) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 1800);
  }, []);

  const stayOnQid = useCallback(
    (qid, nextAnswers) => {
      const nextPages = buildPages(getVisibleQuestions(schema, nextAnswers));
      const idx = nextPages.findIndex((page) =>
        page.some((q) => String(q.id) === String(qid))
      );
      if (idx >= 0) setStep(idx);
    },
    []
  );

  const onRadio = (qid, value) => {
    const next = applyRadioAnswer(schema, answers, qid, value);
    setAnswers(next);
    if (qid === '5' || qid === '10' || qid === '11' || qid === '14') {
      stayOnQid(qid, next);
    }
  };

  const onCheckbox = (qid, value) => {
    const next = applyCheckboxToggle(schema, answers, qid, value);
    setAnswers(next);
    if (qid === '9' || qid === '14a') stayOnQid(qid, next);
  };

  const onText = (qid, value) => {
    setAnswers({ ...answers, [String(qid)]: value });
  };

  const validatePage = () => {
    const page = pages[step] || [];
    for (const q of page) {
      if (!q.required) continue;
      const ans = answerOf(answers, q.id);
      if (q.type === 'checkbox') {
        if (!ans || ans.length === 0) {
          showToast('请至少选择一项');
          return false;
        }
      } else if (!ans || String(ans).trim() === '') {
        showToast('请完成此题');
        return false;
      }
    }
    return true;
  };

  const onNext = () => {
    if (!validatePage()) return;
    if (step < pages.length - 1) setStep(step + 1);
  };

  const onPrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const onSubmit = async () => {
    if (submitting) return;
    if (!validatePage()) return;

    const cleaned = getSubmitAnswers(schema, answers);
    const visible = getVisibleQuestions(schema, cleaned);
    for (const q of visible) {
      if (!q.required) continue;
      const ans = answerOf(cleaned, q.id);
      if (q.type === 'checkbox') {
        if (!ans || ans.length === 0) {
          showToast('请完成必答题');
          return;
        }
      } else if (!ans || String(ans).trim() === '') {
        showToast('请完成必答题');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: cleaned }),
      });
      const json = await res.json();
      if (!res.ok || json.code !== 0) {
        showToast(json.msg || '提交失败');
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      setSubmitId(json.data?.id || '');
      setDone(true);
    } catch (e) {
      showToast(e.message || '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  if (isAdmin) return <AdminPanel />;

  if (done) {
    return (
      <div className="app">
        <div className="success card">
          <div className="brand">XOLOme</div>
          <h2>感谢参与！</h2>
          <p>
            问卷已提交成功。本通道为纯调研收集，不提供登录与优惠券。
            {submitId ? (
              <>
                <br />
                答卷编号：{submitId.slice(0, 8)}…
              </>
            ) : null}
          </p>
        </div>
      </div>
    );
  }

  const pageQuestions = pages[step] || [];
  const progress = pages.length ? Math.round(((step + 1) / pages.length) * 100) : 0;
  const isLast = step === pages.length - 1;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">XOLOme</div>
        <h1 className="title">{schema.title}</h1>
        <p className="subtitle">{schema.subtitle}</p>
        <div className="progress-wrap">
          <div className="progress-meta">
            <span>
              {step + 1} / {pages.length}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <div className="card">
        {pageQuestions.map((q, i) => (
          <QuestionBlock
            key={q.id}
            q={q}
            answers={answers}
            onRadio={onRadio}
            onCheckbox={onCheckbox}
            onText={onText}
            spaced={i > 0}
          />
        ))}
      </div>

      <div className="footer">
        <div className="footer-inner">
          <button className="btn btn-secondary" type="button" disabled={step === 0} onClick={onPrev}>
            上一题
          </button>
          {isLast ? (
            <button className="btn btn-primary" type="button" disabled={submitting} onClick={onSubmit}>
              {submitting ? '提交中…' : '提交'}
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={onNext}>
              下一题
            </button>
          )}
        </div>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
