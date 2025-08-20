PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS respuestas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),
  percent INTEGER NOT NULL,
  bits TEXT NOT NULL,          -- cadena de 20 bits '0101...'
  user_agent TEXT,
  action TEXT DEFAULT 'share'  -- 'share' o 'download'
);

CREATE TABLE IF NOT EXISTS respuestas_detalle (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  respuesta_id INTEGER NOT NULL,
  opcion INTEGER NOT NULL,     -- 1..20
  FOREIGN KEY(respuesta_id) REFERENCES respuestas(id)
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_respuestas_action ON respuestas(action);
CREATE INDEX IF NOT EXISTS idx_detalle_respuesta ON respuestas_detalle(respuesta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_opcion ON respuestas_detalle(opcion);
