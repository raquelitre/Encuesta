PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT (datetime('now')),
  type TEXT NOT NULL,         -- 'share'
  bits CHAR(20) NOT NULL,     -- 20 chars '0'/'1'
  percent INTEGER,            -- 0..100
  user_agent TEXT
);
