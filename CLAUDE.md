# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deployment

- **Railway URL**: `https://gymtracker-production-c030.up.railway.app/`
- **GitHub repo**: `ludricher-ops/gymtracker`
- **Git identity**: `lud.richer@gmail.com` / `Ludri`

```bash
git add <files> && git commit -m "message" && git push origin main
# Railway auto-deploys on push (~1-2 min). PostgreSQL is a separate service — pushes never affect stored data.
```

There is no local dev server. To seed or update live data, write JSON to a temp file and POST via curl:

```bash
# ALWAYS use --data-binary @file.json — never inline JSON on Windows (corrupts é è â… accents)
curl -s -X POST https://gymtracker-production-c030.up.railway.app/api/<resource> \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @file.json
```

## Architecture

**Single-file frontend + Express backend. No build step, no bundler.**

- `index.html` — entire SPA (Alpine.js 3.14 + Tailwind CSS CDN + Chart.js 4.4)
- `server.js` — Express server: serves static files + REST API
- `manifest.json` + `sw.js` + `icon-*.png` — PWA assets (sw.js cache currently `gymtracker-v2` — bump version when changing cached assets)

### Backend (`server.js`)

Dual-mode storage via `DATABASE_URL` env var:
- **Set** (Railway): PostgreSQL, 3 tables (`sessions`, `programmes`, `exercises`) — all `JSONB` columns, schema-free
- **Unset** (local): `data.json` file

`CREATE TABLE IF NOT EXISTS` runs at startup as **chained `.then()` calls** — never a single multi-statement `pool.query()` call (`pg` doesn't support that). `DATA_FILE` and JSON helpers must be declared **before** the `if (DATABASE_URL)` block to avoid temporal dead zone errors.

REST API:
```
GET  POST  PUT  DELETE   /api/sessions/:id?
GET  POST        DELETE   /api/programmes/:id?
GET  POST        DELETE   /api/exercises/:id?
```

### Frontend (`index.html`)

Alpine.js `gymApp()` holds all state. Key properties:

| Property | Description |
|---|---|
| `sessions`, `programmes`, `exercises` | Loaded in parallel on `init()` |
| `session` | Active in-progress session (`null` if none) |
| `tab` | Active bottom nav: `accueil` / `seance` / `programmes` / `historique` / `progression` |
| `programmeView` | Sub-view: `list` / `editor` / `exercises` |
| `historiqueView` | Sub-view: `calendrier` (default) / `liste` / `editSession` |
| `expandedProgrammes` | `{ [prog.id]: bool }` — individual programme fold state |
| `expandedCategories` | `{ [cat.id]: bool }` — category fold state (expanded by default, `!== false` check) |
| `categories` | Fixed array `[{id,name,emoji,color}]` — Prendre de la masse / Sport collectif / Sport extérieur |

Key computed getters:
- `exerciseGroups` — groups `exercises[]` by `group` field; used for rendering lists and `<select optgroup>`
- `programmesByCategory` — groups `programmes[]` by `category` name; programmes without category appear under "Sans catégorie"
- `sessionDateMap` — `YYYY-MM-DD → Session[]`; drives calendar highlights and day-detail view
- `calendarDays` — flat array (leading `null` pads + day numbers 1–N) for the 7-col monthly grid

### Data model

```js
// Exercise
{ id, name, group, imageUrl? }

// Programme
{ id, name, category?, exercises: [{ id, name, group, sets, reps, weight }] }

// Session (saved)
{ id, date, programmeName?, duration, exercises: [{ id, name, group, imageUrl?, sets: [{ weight, reps, done }] }] }
```

`imageUrl` is carried from `exercises[]` into session exercises at `startSession()` time via a lookup in `this.exercises` — so updating an exercise image retroactively affects new sessions but not saved ones.
