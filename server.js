import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { randomUUID } from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname_ = path.resolve();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Data dirs
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname_, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'responses.db');
const IMG_DIR = path.join(DATA_DIR, 'share_imgs');
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

let db;
(async () => {
  db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  const schemaPath = path.join(__dirname_, 'schema.sql');
  await db.exec(fs.readFileSync(schemaPath, 'utf8'));
})();

function sanitizeBits(bits){ return (typeof bits==='string' && bits.length===20 && /^[01]{20}$/.test(bits)) ? bits : null; }
function clampPercent(p){ const n = Number(p); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null; }

// Basic auth middleware for stats
function basicAuth(req, res, next){
  const u = process.env.STATS_USER || 'admin';
  const p = process.env.STATS_PASS || 'changeme';
  const hdr = req.headers.authorization || '';
  if (hdr.startsWith('Basic ')){
    const creds = Buffer.from(hdr.slice(6), 'base64').toString('utf8');
    const [user, pass] = creds.split(':');
    if (user === u && pass === p) return next();
  }
  res.setHeader('WWW-Authenticate', 'Basic realm="Stats"');
  res.status(401).send('Auth required');
}

// API
app.post('/api/share', async (req, res) => {
  try {
    const bits = sanitizeBits(req.body?.bits);
    const percent = clampPercent(req.body?.percent);
    const ua = String(req.body?.user_agent || '').slice(0, 200);
    if (!bits) return res.status(400).json({ error: 'bits inválido' });
    await db.run('INSERT INTO events(type, bits, percent, user_agent) VALUES (?,?,?,?)', ['share', bits, percent, ua]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
});

app.post('/api/share-image', async (req, res) => {
  try {
    const b64 = req.body?.image_base64;
    if (!b64) return res.status(400).json({ error: 'missing_image' });
    const buf = Buffer.from(b64, 'base64');
    const id = randomUUID();
    const filename = path.join(IMG_DIR, `${id}.png`);
    fs.writeFileSync(filename, buf);
    const base = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || '';
    const url = base ? `${base}/share/${id}.png` : `/share/${id}.png`;
    res.json({ url });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
});

// Stats (protected)
app.get('/api/stats/items', basicAuth, async (req, res) => {
  try {
    const rows = await db.all("SELECT bits FROM events WHERE type='share'");
    const counts = Array(20).fill(0);
    for (const r of rows) {
      const b = r.bits;
      for (let i=0;i<20;i++) if (b[i]==='1') counts[i]++;
    }
    res.json({ total_shares: rows.length, counts });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
});

app.get('/api/stats/percent', basicAuth, async (req, res) => {
  try {
    const rows = await db.all("SELECT percent FROM events WHERE type='share' AND percent IS NOT NULL");
    const total = rows.length;
    const hist = {}; let sum=0, min=100, max=0;
    for (const r of rows){
      const p = Number(r.percent);
      if (!Number.isFinite(p)) continue;
      sum += p; if (p<min) min=p; if (p>max) max=p;
      const bucket = Math.round(p/5)*5;
      hist[bucket] = (hist[bucket]||0)+1;
    }
    const avg = total ? +(sum/total).toFixed(2) : null;
    const histogram = Array.from({length:21}, (_,k)=>({ bucket:k*5, count:hist[k*5]||0 }));
    res.json({ total_shares: total, avg, min: total?min:null, max: total?max:null, histogram });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
});

// Static files
app.use('/share', express.static(IMG_DIR, { maxAge: '365d', immutable: true }));

// Protect /stats.html via basic auth
app.get('/stats.html', basicAuth, (req,res,next)=> next());
app.use(express.static(path.join(__dirname_, 'public')));

app.listen(PORT, () => console.log(`App on :${PORT}`));
