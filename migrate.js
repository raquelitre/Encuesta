// migrate.js
const fs = require('fs');
const { Client } = require('pg');

(async () => {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) {
      console.error('DATABASE_URL no definida');
      process.exit(1);
    }

    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false } // Render Postgres requiere SSL
    });
    await client.connect();

    const sql = `
      CREATE TABLE IF NOT EXISTS respuestas (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        percent INTEGER NOT NULL,
        bits VARCHAR(20) NOT NULL,
        user_agent TEXT,
        action TEXT DEFAULT 'share'
      );

      CREATE TABLE IF NOT EXISTS respuestas_detalle (
        id SERIAL PRIMARY KEY,
        respuesta_id INTEGER NOT NULL REFERENCES respuestas(id) ON DELETE CASCADE,
        opcion INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_respuestas_action ON respuestas(action);
      CREATE INDEX IF NOT EXISTS idx_detalle_respuesta ON respuestas_detalle(respuesta_id);
      CREATE INDEX IF NOT EXISTS idx_detalle_opcion ON respuestas_detalle(opcion);
    `;

    await client.query(sql);
    await client.end();
    console.log('Migración Postgres OK');
    process.exit(0);
  } catch (e) {
    console.error('Error en migración', e);
    process.exit(1);
  }
})();
