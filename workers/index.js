import { Hono } from 'hono';
import { cors } from 'hono/cors';
import schema from '../schema/v21.json';
import {
  FLAT_EXPORT_COLUMNS,
  cellValue,
  flattenAnswers,
  getSubmitAnswers,
  validateRequired,
} from '../packages/core/src/index.js';

function hashIp(ip) {
  // Workers: SubtleCrypto async — use simple FNV-ish sync hash for rate limit key
  let h = 2166136261;
  const s = String(ip || 'unknown');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function clientIp(c) {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function csvEscape(s) {
  const str = String(s ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function rowsToCsv(rows, includeContact) {
  const cols = [
    'id',
    'version',
    'created_at',
    ...FLAT_EXPORT_COLUMNS.filter((c) =>
      includeContact ? true : c !== 'contact' && c !== 'displayName'
    ),
  ];
  const lines = [cols.join(',')];
  for (const row of rows) {
    const flat = JSON.parse(row.flat);
    const line = cols.map((col) => {
      if (col === 'id' || col === 'version' || col === 'created_at') {
        return csvEscape(row[col]);
      }
      return csvEscape(cellValue(flat[col]));
    });
    lines.push(line.join(','));
  }
  return lines.join('\n');
}

async function ensureSchema(db) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS responses (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        answers TEXT NOT NULL,
        flat TEXT NOT NULL,
        created_at TEXT NOT NULL,
        user_agent TEXT,
        ip_hash TEXT
      )`
    )
    .run();
}

function createApp() {
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
    const db = c.env.DB;
    if (!db) return c.json({ code: -1, msg: 'DB 未绑定' }, 500);
    await ensureSchema(db);

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

    const cleaned = getSubmitAnswers(schema, rawAnswers);
    const check = validateRequired(schema, cleaned);
    if (!check.ok) {
      return c.json({ code: -1, msg: check.message, qid: check.qid }, 400);
    }

    const flat = flattenAnswers(cleaned);
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    const ip_hash = hashIp(clientIp(c));

    await db
      .prepare(
        `INSERT INTO responses (id, version, answers, flat, created_at, user_agent, ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        schema.version,
        JSON.stringify(cleaned),
        JSON.stringify(flat),
        created_at,
        (c.req.header('user-agent') || '').slice(0, 500),
        ip_hash
      )
      .run();

    return c.json({
      code: 0,
      msg: 'ok',
      data: { id, version: schema.version, created_at },
    });
  });

  app.get('/api/export', async (c) => {
    const token = c.req.query('token') || '';
    const admin = c.env.SURVEY_ADMIN_TOKEN || 'xolome-dev-export-token';
    if (token !== admin) return c.json({ code: -1, msg: '未授权' }, 401);

    const db = c.env.DB;
    if (!db) return c.json({ code: -1, msg: 'DB 未绑定' }, 500);
    await ensureSchema(db);

    const format = (c.req.query('format') || 'csv').toLowerCase();
    const includeContact = c.req.query('includeContact') === '1';
    const { results: rows } = await db
      .prepare('SELECT * FROM responses ORDER BY created_at DESC')
      .all();

    if (format === 'json') {
      const payload = (rows || []).map((r) => {
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

    const csv = rowsToCsv(rows || [], includeContact);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="xolome-survey-${schema.version}.csv"`,
      },
    });
  });

  app.get('/api/stats', async (c) => {
    const token = c.req.query('token') || '';
    const admin = c.env.SURVEY_ADMIN_TOKEN || 'xolome-dev-export-token';
    if (token !== admin) return c.json({ code: -1, msg: '未授权' }, 401);
    const db = c.env.DB;
    if (!db) return c.json({ code: -1, msg: 'DB 未绑定' }, 500);
    await ensureSchema(db);
    const row = await db.prepare('SELECT COUNT(*) AS n FROM responses').first();
    return c.json({ code: 0, data: { count: row?.n || 0, version: schema.version } });
  });

  // SPA fallback for non-API routes is handled by assets binding
  return app;
}

const app = createApp();

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
