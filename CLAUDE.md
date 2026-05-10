# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deployment

This app is deployed on **Railway** at `https://gymtracker-production-c030.up.railway.app/`.

```bash
# Deploy: push to GitHub, Railway auto-deploys
git add <files>
git commit -m "message"
git push origin main
```

There is no local dev server — the app runs exclusively on Railway. To create or update data directly in the live database, use the Railway API:

```bash
# Always use --data-binary @file.json (never inline JSON) to avoid Windows encoding corruption of accented characters
curl -s -X POST https://gymtracker-production-c030.up.railway.app/api/<resource> \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @file.json
```

## Architecture

**Single-file frontend + Express backend. No build step, no bundler.**

- `index.html` — entire SPA (Alpine.js 3.14 + Tailwind CSS CDN + Chart.js 4.4)
- `server.js` — Express server: serves static files + REST API
- `manifest.json` + `sw.js` + `icon-*.png` — PWA assets

### Backend (`server.js`)

Dual-mode storage via `DATABASE_URL` env var:
- **Set** (Railway): PostgreSQL, 3 tables (`sessions`, `programmes`, `exercises`) — all `JSONB` columns, schema-free
- **Unset** (local): `data.json` file

REST API:
```
GET/POST/PUT/DELETE  /api/sessions
GET/POST/DELETE      /api/programmes
GET/POST/DELETE      /api/exercises
```

`CREATE TABLE IF NOT EXISTS` runs at startup as chained `.then()` calls (not a single multi-statement query — `pg` requires separate calls).

### Frontend (`index.html`)

Alpine.js `gymApp()` object holds all state. Key properties:
- `sessions`, `programmes`, `exercises` — loaded in parallel on `init()`
- `session` — active in-progress session (null if none)
- `tab` — active bottom-nav tab (`accueil` / `seance` / `programmes` / `historique` / `progression`)
- `programmeView` — sub-view within Programmes tab (`list` / `editor` / `exercises`)
- `historiqueView` — sub-view within Historique tab (`calendrier` / `liste` / `editSession`)

Key computed getters:
- `exerciseGroups` — groups `exercises[]` by muscle group for rendering and `<select>` options
- `programmesByCategory` — groups `programmes[]` by category for the collapsible category headers
- `sessionDateMap` — maps `YYYY-MM-DD` → sessions array, used by the calendar view
- `calendarDays` — flat array (nulls for padding + day numbers) for the monthly grid

### Data model

```js
// Exercise
{ id, name, group, imageUrl? }

// Programme
{ id, name, category?, exercises: [{ id, name, group, sets, reps, weight }] }

// Session (saved)
{ id, date, programmeName?, duration, exercises: [{ id, name, group, imageUrl?, sets: [{ weight, reps, done }] }] }
```

### Encoding pitfall

On Windows, passing UTF-8 JSON with accented characters (é, è, â…) inline to `curl` corrupts the data. Always write JSON to a temp file and use `--data-binary @file.json`.

## Live data

- **Railway URL**: `https://gymtracker-production-c030.up.railway.app/`
- **GitHub repo**: `ludricher-ops/gymtracker`
- **Git identity**: `lud.richer@gmail.com` / `Ludri`
- PostgreSQL is a separate Railway service — `git push` never affects stored data
