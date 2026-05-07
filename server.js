const express = require('express');
const path    = require('fs');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3333;

app.use(express.json());
app.use(express.static(__dirname));

// ══════════════════════════════════════════════════════════
//  BASE DE DONNÉES
//  → PostgreSQL si DATABASE_URL est défini (Railway)
//  → data.json sinon (développement local)
// ══════════════════════════════════════════════════════════

let pool = null;

if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Création des tables au démarrage
  pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id   TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS programmes (
      id   TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
  `)
  .then(() => console.log('✅ Tables PostgreSQL prêtes'))
  .catch(err => console.error('❌ Erreur tables :', err.message));
}

// ── Helpers JSON (local) ──────────────────────────────────
const DATA_FILE = path.join ? path.join(__dirname, 'data.json') : __dirname + '/data.json';

function readJSON() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { sessions: [], programmes: [] };
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch(e) { return { sessions: [], programmes: [] }; }
}
function writeJSON(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── Helpers DB (abstraction locale / PostgreSQL) ──────────
async function getSessions() {
  if (pool) {
    const { rows } = await pool.query(
      "SELECT data FROM sessions ORDER BY (data->>'date') DESC"
    );
    return rows.map(r => r.data);
  }
  return readJSON().sessions;
}

async function addSession(session) {
  if (pool) {
    await pool.query(
      'INSERT INTO sessions(id, data) VALUES($1,$2)',
      [session.id, session]
    );
  } else {
    const d = readJSON();
    d.sessions.unshift(session);
    writeJSON(d);
  }
}

async function removeSession(id) {
  if (pool) {
    await pool.query('DELETE FROM sessions WHERE id=$1', [id]);
  } else {
    const d = readJSON();
    d.sessions = d.sessions.filter(s => s.id !== id);
    writeJSON(d);
  }
}

async function getProgrammes() {
  if (pool) {
    const { rows } = await pool.query(
      "SELECT data FROM programmes ORDER BY (data->>'name')"
    );
    return rows.map(r => r.data);
  }
  return readJSON().programmes;
}

async function upsertProgramme(prog) {
  if (pool) {
    await pool.query(
      'INSERT INTO programmes(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2',
      [prog.id, prog]
    );
  } else {
    const d = readJSON();
    const idx = d.programmes.findIndex(p => p.id === prog.id);
    if (idx !== -1) d.programmes[idx] = prog; else d.programmes.push(prog);
    writeJSON(d);
  }
}

async function removeProgramme(id) {
  if (pool) {
    await pool.query('DELETE FROM programmes WHERE id=$1', [id]);
  } else {
    const d = readJSON();
    d.programmes = d.programmes.filter(p => p.id !== id);
    writeJSON(d);
  }
}

// ══════════════════════════════════════════════════════════
//  ROUTES API
// ══════════════════════════════════════════════════════════

app.get('/api/sessions',       async (req, res) => { try { res.json(await getSessions());        } catch(e) { res.status(500).json({error:e.message}); } });
app.post('/api/sessions',      async (req, res) => { try { await addSession(req.body);    res.json({ok:true}); } catch(e) { res.status(500).json({error:e.message}); } });
app.delete('/api/sessions/:id',async (req, res) => { try { await removeSession(req.params.id);   res.json({ok:true}); } catch(e) { res.status(500).json({error:e.message}); } });

app.get('/api/programmes',        async (req, res) => { try { res.json(await getProgrammes());       } catch(e) { res.status(500).json({error:e.message}); } });
app.post('/api/programmes',       async (req, res) => { try { await upsertProgramme(req.body); res.json({ok:true}); } catch(e) { res.status(500).json({error:e.message}); } });
app.delete('/api/programmes/:id', async (req, res) => { try { await removeProgramme(req.params.id); res.json({ok:true}); } catch(e) { res.status(500).json({error:e.message}); } });

// ── Démarrage ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n💪 GymTracker → http://localhost:${PORT}`);
  console.log(pool ? '🗄️  Base : PostgreSQL (Railway)' : `📁 Base : data.json (local)`);
});
