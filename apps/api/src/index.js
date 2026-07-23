import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  buildExportCsv,
  flattenAnswers,
  getSubmitAnswers,
  validateRequired,
} from '@xolome/survey-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const SCHEMA_PATH = path.join(ROOT, 'schema', 'v1.0.json');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = process.env.SURVEY_DB_PATH || path.join(DATA_DIR, 'survey.sqlite');
const ADMIN_TOKEN = process.env.SURVEY_ADMIN_TOKEN || 'xolome-dev-export-token';
const PORT = Number(process.env.PORT || 8787);
const WEB_DIST = path.join(ROOT, 'apps', 'web', 'dist');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    answers TEXT NOT NULL,
    flat TEXT NOT NULL,
    created_at TEXT NOT NULL,
    user_agent TEXT,
    ip_hash TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_responses_created ON responses(created_at);
`);

const insertStmt = db.prepare(`
  INSERT INTO responses (id, version, answers, flat, created_at, user_agent, ip_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const listStmt = db.prepare(`SELECT * FROM responses ORDER BY created_at DESC`);
const countStmt = db.prepare('SELECT COUNT(*) AS n FROM responses');

const rateBuckets = new Map();
function allowSubmit(ipHash) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  let bucket = (rateBuckets.get(ipHash) || []).filter((t) => now - t < windowMs);
  if (bucket.length >= 20) return false;
  bucket.push(now);
  rateBuckets.set(ipHash, bucket);
  return true;
}

function clientIp(c) {
  const xf = c.req.header('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  return c.req.header('x-real-ip') || 'unknown';
}

function hashIp(ip) {
  return createHash('sha256').update(String(ip)).digest('hex').slice(0, 16);
}

const app = new Hono();

app.use(
  '/api/*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

app.get('/api/health', (c) => c.json({ ok: true, version: schema.version }));

app.get('/api/schema', (c) => c.json(schema));

app.post('/api/submit', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ code: -1, msg: '无效 JSON' }, 400);
  }

  const rawAnswers = body?.answers || body?.data;
  if (!rawAnswers || typeof rawAnswers !== 'object') {
    return c.json({ code: -1, msg: '问卷数据不能为空' }, 400);
  }

  const ipHash = hashIp(clientIp(c));
  if (!allowSubmit(ipHash)) {
    return c.json({ code: -1, msg: '提交过于频繁，请稍后再试' }, 429);
  }

  const cleaned = getSubmitAnswers(schema, rawAnswers);
  const check = validateRequired(schema, cleaned);
  if (!check.ok) {
    return c.json({ code: -1, msg: check.message, qid: check.qid }, 400);
  }

  const flat = flattenAnswers(cleaned);
  const id = randomUUID();
  const created_at = new Date().toISOString();

  insertStmt.run(
    id,
    schema.version,
    JSON.stringify(cleaned),
    JSON.stringify(flat),
    created_at,
    (c.req.header('user-agent') || '').slice(0, 500),
    ipHash
  );

  return c.json({
    code: 0,
    msg: 'ok',
    data: { id, version: schema.version, created_at },
  });
});

app.get('/api/export', (c) => {
  const token = c.req.query('token') || '';
  if (token !== ADMIN_TOKEN) {
    return c.json({ code: -1, msg: '未授权' }, 401);
  }
  const format = (c.req.query('format') || 'csv').toLowerCase();
  const includeContact = c.req.query('includeContact') === '1';
  const headers = (c.req.query('headers') || 'zh').toLowerCase() === 'en' ? 'en' : 'zh';
  const rows = listStmt.all();

  if (format === 'json') {
    const payload = rows.map((r) => {
      const flat = JSON.parse(r.flat);
      if (!includeContact) {
        delete flat.contact;
        delete flat.displayName;
      }
      return {
        id: r.id,
        version: r.version,
        created_at: r.created_at,
        answers: JSON.parse(r.answers),
        flat,
      };
    });
    return c.json({ code: 0, count: payload.length, data: payload });
  }

  const csv = buildExportCsv(rows, schema, { includeContact, headers });
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="xolome-survey-${schema.version}.csv"`,
    },
  });
});

app.get('/api/stats', (c) => {
  const token = c.req.query('token') || '';
  if (token !== ADMIN_TOKEN) {
    return c.json({ code: -1, msg: '未授权' }, 401);
  }
  const count = countStmt.get().n;
  return c.json({ code: 0, data: { count, version: schema.version } });
});

if (fs.existsSync(WEB_DIST)) {
  app.use('/*', serveStatic({ root: WEB_DIST }));
}

console.log(`[xolome-survey] API http://127.0.0.1:${PORT}`);
console.log(`[xolome-survey] schema ${schema.version} · db ${DB_PATH}`);
console.log(
  `[xolome-survey] export token via SURVEY_ADMIN_TOKEN (default: xolome-dev-export-token)`
);

serve({ fetch: app.fetch, port: PORT });
