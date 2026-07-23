-- Survey responses (Cloudflare D1)
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
