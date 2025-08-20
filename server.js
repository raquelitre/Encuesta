// server.js — Express + PostgreSQL (Render) — CommonJS

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Middlewares ----------
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- PostgreSQL ----------
if (!process.env.DATABASE_URL) {
  console.error("❌ Falta DATABASE_URL. Añádela en Render → Settings → Environment.");
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render Postgres
});

// Crear tablas si no existen
async function ensureSchema() {
  const sql = `
    CREATE TABLE IF NOT EXISTS respuestas (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT now(),
      percent INTEGER NOT NULL,
      bits VARCHAR(20) NOT NULL,
      user_agent TEXT,
      action TEXT DEFAULT 'share'        -- 'share' | 'download'
    );

    CREATE TABLE IF NOT EXISTS respuestas_detalle (
      id SERIAL PRIMARY KEY,
      respuesta_id INTEGER NOT NULL REFERENCES respuestas(id) ON DELETE CASCADE,
      opcion INTEGER NOT NULL           -- 1..20
    );

    CREATE INDEX IF NOT EXISTS idx_respuestas_action  ON respuestas(action);
    CREATE INDEX IF NOT EXISTS idx_detalle_respuesta  ON respuestas_detalle(respuesta_id);
    CREATE INDEX IF NOT EXISTS idx_detalle_opcion     ON respuestas_detalle(opcion);
  `;
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("✅ Esquema verificado");
  } finally {
    client.release();
  }
}
ensureSchema().catch(e => {
  console.error("Error ensureSchema:", e);
});

// ---------- Utils ----------
function validBits(bits) {
  return typeof bits === "string" && /^[01]{20}$/.test(bits);
}
function clampPercent(p) {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ---------- Basic Auth (para stats) ----------
function basicAuth(req, res, next) {
  const u = process.env.STATS_USER || "admin";
  const p = process.env.STATS_PASS || "changeme";
  const hdr = req.headers.authorization || "";
  if (hdr.startsWith("Basic ")) {
    const [user, pass] = Buffer.from(hdr.slice(6), "base64").toString("utf8").split(":");
    if (user === u && pass === p) return next();
  }
  res.setHeader("WWW-Authenticate", 'Basic realm="Stats"');
  res.status(401).send("Auth required");
}

// ---------- Lógica de guardado ----------
async function saveRespuesta({ bits, percent, user_agent, action }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      "INSERT INTO respuestas(percent,bits,user_agent,action) VALUES ($1,$2,$3,$4) RETURNING id",
      [percent, bits || "", user_agent || "", action || "share"]
    );
    const id = r.rows[0].id;

    if (validBits(bits)) {
      const params = [];
      const tuples = [];
      let k = 1;
      for (let i = 0; i < 20; i++) {
        if (bits[i] === "1") {
          tuples.push(`($${k++}, $${k++})`);
          params.push(id, i + 1);
        }
      }
      if (tuples.length) {
        await client.query(
          `INSERT INTO respuestas_detalle(respuesta_id,opcion) VALUES ${tuples.join(",")}`,
          params
        );
      }
    }
    await client.query("COMMIT");
    return id;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ---------- API: registrar compartir/descargar ----------
app.post("/api/share", async (req, res) => {
  try {
    const bits = (req.body?.bits || "").toString();
    const percent = clampPercent(req.body?.percent);
    const action = (req.body?.action || "share").toString(); // 'share' | 'download'
    const ua = (req.body?.user_agent || "").toString().slice(0, 200);

    if (bits && !validBits(bits)) {
      return res.status(400).json({ ok: false, error: "BITS_INVALID" });
    }

    const id = await saveRespuesta({ bits, percent, user_agent: ua, action });
    res.json({ ok: true, id });
  } catch (e) {
    console.error("Error /api/share", e);
    res.status(500).json({ ok: false, error: "DB_WRITE_FAILED" });
  }
});

// ---------- API: imagen compartible (devuelve URL) ----------
const TMP_DIR = path.join(__dirname, "tmp_share");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
app.use("/share", express.static(TMP_DIR, { maxAge: "365d", immutable: true }));

app.post("/api/share-image", async (req, res) => {
  try {
    const b64 = req.body?.image_base64;
    if (!b64) return res.status(400).json({ error: "MISSING_IMAGE" });
    const buf = Buffer.from(b64, "base64");
    const id = crypto.randomUUID();
    const filename = path.join(TMP_DIR, `${id}.png`);
    fs.writeFileSync(filename, buf);
    const base = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || "";
    const url = base ? `${base}/share/${id}.png` : `/share/${id}.png`;
    res.json({ url });
  } catch (e) {
    console.error("Error /api/share-image", e);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// ---------- API: estadísticas (protegidas) ----------
app.get("/api/stats/percent", basicAuth, async (_req, res) => {
  try {
    const client = await pool.connect();

    const agg = await client.query(
      `SELECT
         COUNT(*)::int   AS total,
         COALESCE(MIN(percent),0)::int AS min,
         COALESCE(MAX(percent),0)::int AS max,
         COALESCE(AVG(percent),0)::float AS avg
       FROM respuestas`
    );

    // buckets 0..100 paso 5
    const buckets = [];
    for (let b = 0; b <= 100; b += 5) {
      const r = await client.query(
        "SELECT COUNT(*)::int AS c FROM respuestas WHERE (percent/5)*5 = $1",
        [b]
      );
      buckets.push({ bucket: b, count: r.rows[0].c });
    }

    const actions = await client.query(
      `SELECT
         SUM(CASE WHEN action='share' THEN 1 ELSE 0 END)::int AS share,
         SUM(CASE WHEN action='download' THEN 1 ELSE 0 END)::int AS download
       FROM respuestas`
    );

    client.release();
    res.json({ ...(agg.rows[0] || {}), buckets, actions: actions.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "STATS_FAILED" });
  }
});

app.get("/api/stats/items", basicAuth, async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT opcion, COUNT(*)::int AS votos
       FROM respuestas_detalle
       GROUP BY opcion
       ORDER BY opcion ASC`
    );
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "STATS_FAILED" });
  }
});

// proteger /stats.html con Basic Auth
app.get("/stats.html", basicAuth, (req, res, next) => next());

// health
app.get("/health", (_req, res) => res.json({ ok: true }));

// start
app.listen(PORT, () => {
  console.log("🚀 Server escuchando en", PORT);
});

