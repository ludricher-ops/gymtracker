const express = require('express');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3333;

app.use(express.json());
app.use(express.static(__dirname));

// ══════════════════════════════════════════════════════════
//  EXERCICES PAR DÉFAUT (utilisés pour le seed initial)
// ══════════════════════════════════════════════════════════
const DEFAULT_EXERCISES = [
  { id:'dc-plat',      name:'Développé couché haltères (plat)',              group:'Poitrine'   },
  { id:'dc-incline',   name:'Développé couché haltères (incliné)',           group:'Poitrine'   },
  { id:'ec-plat',      name:'Écarté couché haltères (plat)',                 group:'Poitrine'   },
  { id:'pullover',     name:'Pullover haltère',                              group:'Poitrine'   },
  { id:'rowing-uni',   name:'Rowing haltère unilatéral (appui sur banc)',    group:'Dos'        },
  { id:'rowing-bi',    name:'Rowing haltère bilatéral',                      group:'Dos'        },
  { id:'dev-mil',      name:'Développé militaire haltères (assis sur banc)', group:'Épaules'    },
  { id:'elev-lat',     name:'Élévations latérales (assis)',                  group:'Épaules'    },
  { id:'oiseau',       name:'Oiseau / Élévations postérieures (assis penché)',group:'Épaules'   },
  { id:'curl-alt',     name:'Curl haltères alterné',                         group:'Biceps'     },
  { id:'curl-marteau', name:'Curl marteau (Hammer curl)',                    group:'Biceps'     },
  { id:'ext-tri',      name:'Extension triceps au-dessus de la tête',        group:'Triceps'    },
  { id:'dips',         name:'Dips sur banc (poids du corps)',                group:'Triceps'    },
  { id:'crunch',       name:'Crunch avec haltère',                           group:'Abdominaux' },
  { id:'russian',      name:'Russian twist avec haltère',                    group:'Abdominaux' },
  { id:'side-bend',    name:'Side bend (flexion latérale)',                  group:'Abdominaux' },
];

// ══════════════════════════════════════════════════════════
//  HELPERS JSON (local) — déclarés AVANT l'init de la DB
// ══════════════════════════════════════════════════════════
const DATA_FILE = __dirname + '/data.json';

function readJSON() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { sessions:[], programmes:[], exercises:[] };
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!d.exercises) d.exercises = [];
    return d;
  } catch(e) { return { sessions:[], programmes:[], exercises:[] }; }
}
function writeJSON(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
}

// ══════════════════════════════════════════════════════════
//  BASE DE DONNÉES
// ══════════════════════════════════════════════════════════
let pool = null;

if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  pool.query('CREATE TABLE IF NOT EXISTS sessions   (id TEXT PRIMARY KEY, data JSONB NOT NULL)')
  .then(() => pool.query('CREATE TABLE IF NOT EXISTS programmes (id TEXT PRIMARY KEY, data JSONB NOT NULL)'))
  .then(() => pool.query('CREATE TABLE IF NOT EXISTS exercises  (id TEXT PRIMARY KEY, data JSONB NOT NULL)'))
  .then(() => seedExercises())
  .then(() => console.log('✅ PostgreSQL prêt'))
  .catch(e  => console.error('❌ DB :', e.message));
} else {
  // Mode local : seed du fichier JSON
  seedExercises();
}

// ── Seed des exercices par défaut ─────────────────────────
async function seedExercises() {
  if (pool) {
    const { rows } = await pool.query('SELECT COUNT(*) FROM exercises');
    if (parseInt(rows[0].count) === 0) {
      for (const ex of DEFAULT_EXERCISES)
        await pool.query('INSERT INTO exercises(id,data) VALUES($1,$2) ON CONFLICT DO NOTHING', [ex.id, ex]);
      console.log('✅ Exercices par défaut insérés');
    }
  } else {
    const d = readJSON();
    if (!d.exercises || d.exercises.length === 0) {
      d.exercises = DEFAULT_EXERCISES;
      writeJSON(d);
      console.log('✅ Exercices par défaut insérés (JSON)');
    }
  }
}

// ══════════════════════════════════════════════════════════
//  DB HELPERS
// ══════════════════════════════════════════════════════════
async function getSessions() {
  if (pool) { const {rows}=await pool.query("SELECT data FROM sessions ORDER BY (data->>'date') DESC"); return rows.map(r=>r.data); }
  return readJSON().sessions;
}
async function addSession(s) {
  if (pool) await pool.query('INSERT INTO sessions(id,data) VALUES($1,$2)', [s.id,s]);
  else { const d=readJSON(); d.sessions.unshift(s); writeJSON(d); }
}
async function removeSession(id) {
  if (pool) await pool.query('DELETE FROM sessions WHERE id=$1',[id]);
  else { const d=readJSON(); d.sessions=d.sessions.filter(s=>s.id!==id); writeJSON(d); }
}

async function getProgrammes() {
  if (pool) { const {rows}=await pool.query("SELECT data FROM programmes ORDER BY (data->>'name')"); return rows.map(r=>r.data); }
  return readJSON().programmes;
}
async function upsertProgramme(p) {
  if (pool) await pool.query('INSERT INTO programmes(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2',[p.id,p]);
  else { const d=readJSON(); const i=d.programmes.findIndex(x=>x.id===p.id); if(i!==-1)d.programmes[i]=p; else d.programmes.push(p); writeJSON(d); }
}
async function removeProgramme(id) {
  if (pool) await pool.query('DELETE FROM programmes WHERE id=$1',[id]);
  else { const d=readJSON(); d.programmes=d.programmes.filter(p=>p.id!==id); writeJSON(d); }
}

async function getExercises() {
  if (pool) { const {rows}=await pool.query("SELECT data FROM exercises ORDER BY (data->>'group'),(data->>'name')"); return rows.map(r=>r.data); }
  return readJSON().exercises;
}
async function upsertExercise(ex) {
  if (pool) await pool.query('INSERT INTO exercises(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=$2',[ex.id,ex]);
  else { const d=readJSON(); const i=d.exercises.findIndex(x=>x.id===ex.id); if(i!==-1)d.exercises[i]=ex; else d.exercises.push(ex); writeJSON(d); }
}
async function removeExercise(id) {
  if (pool) await pool.query('DELETE FROM exercises WHERE id=$1',[id]);
  else { const d=readJSON(); d.exercises=d.exercises.filter(e=>e.id!==id); writeJSON(d); }
}

// ══════════════════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════════════════
const h = fn => async (req,res) => { try { await fn(req,res); } catch(e) { res.status(500).json({error:e.message}); } };

app.get   ('/api/sessions',        h(async(req,res) => res.json(await getSessions())));
app.post  ('/api/sessions',        h(async(req,res) => { await addSession(req.body);         res.json({ok:true}); }));
app.delete('/api/sessions/:id',    h(async(req,res) => { await removeSession(req.params.id); res.json({ok:true}); }));

app.get   ('/api/programmes',      h(async(req,res) => res.json(await getProgrammes())));
app.post  ('/api/programmes',      h(async(req,res) => { await upsertProgramme(req.body);      res.json({ok:true}); }));
app.delete('/api/programmes/:id',  h(async(req,res) => { await removeProgramme(req.params.id); res.json({ok:true}); }));

app.get   ('/api/exercises',       h(async(req,res) => res.json(await getExercises())));
app.post  ('/api/exercises',       h(async(req,res) => { await upsertExercise(req.body);      res.json({ok:true}); }));
app.delete('/api/exercises/:id',   h(async(req,res) => { await removeExercise(req.params.id); res.json({ok:true}); }));

app.listen(PORT, () => {
  console.log(`\n💪 GymTracker → http://localhost:${PORT}`);
  console.log(pool ? '🗄️  Mode : PostgreSQL (Railway)' : `📁 Mode : data.json (local)`);
});
