# Tech Stack — Jump Rope Tracker

**Principle:** a static site with no backend, no accounts and no running costs. Pick the fewest dependencies that still give a proper installable offline app.

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** | Typed domain model (Plan / Day / Log) catches mistakes when parsing the Excel data |
| UI | **React** (latest stable) | Familiar and well supported; the app has ~5 screens, so no meta-framework |
| Build/dev | **Vite** | Fast dev server; `vite --host` lets you test on your phone over the LAN |
| PWA | **vite-plugin-pwa** (Workbox) | Generates the manifest and service worker → install to home screen, fully offline |
| Storage | **IndexedDB via `idb-keyval`** (~600 B) | Asynchronous and more durable than localStorage; data is small key/value blobs, so Dexie would be overkill. Call `navigator.storage.persist()` to reduce the chance the browser clears it |
| Backup | JSON export/import (built-in File APIs) | The only protection against a wiped phone, since there's no cloud |
| Excel import | **SheetJS** (`xlsx`, installed from cdn.sheetjs.com, because the npm copy is outdated), **lazy-loaded** | Imports future plans in the same sheet format; only downloaded when you use import |
| Styling | Plain CSS + CSS custom properties (design tokens) | No Tailwind or CSS-in-JS needed for this size; one dark "Aurora" theme |
| Font | **Space Grotesk** latin woff2 in `src/assets/fonts/` (OFL), declared in `tokens.css` | Bundled + precached by the service worker, so it works offline |
| Effects | Web Audio synthesis (`fx/sound.ts`) + a small canvas confetti (`fx/confetti.ts`) | No audio files or animation libraries |
| Routing | ~20-line hash router (`#/today`, `#/plan`, `#/day/2026-11-27`…) | Avoids a router dependency; hash URLs work on any static host with no rewrite rules |
| Dates | Native `Date` + `Intl.DateTimeFormat`, using **local** dates only | No date library needed (see pitfalls) |
| Tests | **Vitest** (domain + importer) and a headless-browser walkthrough of the PRD acceptance criteria | Same config as Vite |
| Icons | `scripts/make-icons.mjs`: dependency-free PNG generator (Node `zlib`) | No image tooling needed |
| Hosting | **GitHub Pages or Cloudflare Pages** (free, HTTPS) | Service workers and install need HTTPS (localhost is exempt for dev) |

## Pitfalls to design around

- **Timezone:** `new Date().toISOString().slice(0,10)` gives the *UTC* date. In UTC+5:30 that's yesterday between 00:00 and 05:30. Always build `YYYY-MM-DD` from local `getFullYear/getMonth/getDate`.
- **Excel serial dates:** `date = 1899-12-30 + serial days` (accounts for Excel's 1900 leap-year bug).
- **iOS:** `navigator.vibrate` isn't supported, so haptics are Android-only. iOS may clear storage for sites you haven't opened in a while, but installed home-screen apps are exempt. Back up regularly.

## Project layout

```
jump rope/
  doc/                     Excel source + TECH_STACK.md, PRD.md, DESIGN.md
  scripts/build-seed.ts    xlsx → src/data/seed-plan.json (uses the same parser as in-app import)
  src/
    domain/     types.ts · prescription.ts · dates.ts · plan.ts · stats.ts · log.ts · game.ts · domain.test.ts
    data/       seed-plan.json · store.tsx · importXlsx.ts · backup.ts · migrate.ts
    fx/         sound.ts · confetti.ts
    assets/     fonts/SpaceGrotesk-latin.woff2
    screens/    Today.tsx · Plan.tsx · Day.tsx · Progress.tsx · Settings.tsx
    components/ SetDots.tsx · DayCard.tsx · small.tsx (TypeBadge, FeelPicker, ProgressRing, TabBar)
                game.tsx (LevelBar, Flame, Medal, Celebrations overlay)
    App.tsx · main.tsx · router.ts · styles/tokens.css · styles/app.css
  public/icons/            192/512 PNG + maskable icon
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (add `-- --host` to open it from your phone on the same Wi-Fi) |
| `npm test` | Unit tests (Vitest) |
| `npm run seed` | Regenerate `src/data/seed-plan.json` from the Excel file in `doc/` (a test fails if you forget) |
| `node scripts/make-icons.mjs` | Regenerate the app icons in `public/icons/` |
| `npm run build` / `npm run preview` | Production build / serve it locally (service worker active) |
