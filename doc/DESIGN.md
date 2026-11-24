# Design — Jump Rope Tracker

## Data model

The plan (what you intend to do) is kept separate from the logs (what you actually did).

```ts
type DayType = 'rope' | 'walk' | 'rest' | 'optional' | 'test';
type Prescription = { sets: number; reps: number; label?: string };   // "2×30 warm-up" → {2,30,'warm-up'}
type PlanDay = { date: string /*YYYY-MM-DD local*/; type: DayType;
                 light?: Prescription; thick?: Prescription; altThick?: Prescription; note?: string };
type Plan    = { id: string; name: string; startDate: string; days: PlanDay[]; archived?: boolean };
type DayLog  = { planId: string; date: string;
                 light?: (number|null)[]; thick?: (number|null)[];   // actual reps per set; null = not done
                 useAlt?: boolean; done: boolean; manual?: boolean; feel?: 'easy'|'right'|'hard'; updatedAt: number };
type AppData = { schemaVersion: 2; activePlanId: string; plans: Plan[];
                 logs: Record<string, DayLog>; lastBackupAt?: number;     // log key `${planId}:${date}`
                 celebrated: string[] };   // achievement keys already celebrated: 'level:4', 'badge:1k', 'week:<plan>:2', 'test:<plan>'
```

- Week number and weekday are **calculated** from `date` and `startDate`, not stored (Excel stores them as text).
- Editing a plan never changes logs. Stats are recalculated from `plan + logs` whenever needed (`domain/stats.ts`), so there are no stored counters to drift out of sync.
- Storage is one `idb-keyval` key (`appData`) written on every change. `data/migrate.ts` upgrades v1 data and v1 backups to v2; on upgrade, achievements already reached are marked as celebrated so old progress doesn't set off a burst of celebrations.
- XP, levels and badges (`domain/game.ts`) are derived from `plan + logs` like the stats. `celebrated` is the only stored game state, because "has this already been celebrated?" can't be derived from the logs.

## Gamification (`domain/game.ts`)

- **XP:** 10 per light set, 15 per thick set (a short set earns its share; extra reps earn nothing more), +50 for a completed day with work. Multiplied by the **streak bonus**, +10% per Rope/Test session already done in a row before that day, up to ×2. A missed planned day resets it. Walk/rest days earn nothing.
- **Levels:** level *n* needs `75·n·(n−1)` XP in total (150, 450, 900, 1,500 …). A perfect run through the seeded plan reaches level 9–10 by the test.
- **Badges (9):** First Set · Thick Skinned · 1K Club · On Fire (5 in a row) · Perfect Week · Stepped Up · 5K Club · Test Day · Stretch Goal (parsed from the test day's note, e.g. "Stretch goal: 6×50", applied to its main rope).
- **Celebrations, scaled to the achievement:** set tick = pop + ripple + floating "+10" + rising pentatonic click + haptic. Day complete = confetti burst from the button + chime + "+140 XP · streak bonus ×1.3". New level / badge / perfect week / test = full-screen overlay + side-cannon confetti + fanfare (gold for the test). Overlays wait until today's session is complete, so they never interrupt a workout; several achievements are shown together in one overlay.

## Prescription parser (`domain/prescription.ts`)

Regex `^\s*(\d+)\s*[×xX*]\s*(\d+)\s*(.*)$` → `{sets, reps, label}`. Blank → `undefined`. Unparseable text → kept as a note and reported as an import warning; the import does not fail.

## Information architecture

Bottom tab bar (thumb reach): **Today · Plan · Progress · Settings**. Today shows a level bar (LV, XP bar, streak flame) under the header. Day detail opens from Plan (`#/day/:date`), with a back button.

## Screens

### Today (home)

```
┌──────────────────────────────┐
│ Fri 27 Nov · Week 1    ◔ 3/26│  ← progress ring = sessions done / planned
│ [ROPE]                        │  ← type badge, colour-coded
│                               │
│ Light rope        6 × 30      │
│  ● ● ● ○ ○ ○     90 skips    │  ← 56px tappable dots; filled = done
│                               │
│ Thick rope        2 × 10      │
│  ○ ○                          │
│                               │
│ 💬 First taste of thick rope. │  ← note callout
│                               │
│ [ Mark done ]                 │  ← turns into ✓ Done + Easy/Right/Hard
├──────────────────────────────┤
│  Today   Plan   Progress   ⚙ │
└──────────────────────────────┘
```

- **Rest/Walk day:** a calm card ("Rest day. Next rope: Mon 30 Nov, 6×40"), with an optional "I walked" tick.
- **Missed earlier rope days:** a small banner "1 missed day: log it?" → Day screen. The plan is never moved automatically.
- **Step-up suggestion (F11):** an inline chip above the thick card: "Last thick session felt easy. Step up to 3×20?" [Step up] [Keep 3×15].
- **Test day:** gold styling and the stretch goal shown prominently.

### Plan

Scrolling list grouped by week ("Week 2 · 30 Nov – 6 Dec · 4/5 done"). Each row: weekday + date, type badge, `6×40 · 3×15`, status icon. Today is highlighted and scrolled into view on open.

### Day

The same cards as Today, plus an "Edit" mode (type dropdown, sets/reps inputs, note field).

### Progress

Large `Sessions done 12 / 26 (+1 bonus)` with a % ring; level card (level medallion, XP, XP to next level, next-session streak bonus); tiles for streak (flame, best), test countdown and light/thick skips; a 38-day **calendar heatmap** (weeks × Mon–Sun, single-hue violet ramp by % of prescribed skips done, rest/walk dashed, test outlined gold, per-week `done/planned` at row end); **skips per session** bars (done, solid, against the planned amount, dashed outline); the **badge shelf**. Tapping a heatmap cell or bar shows a readout with a link to that day.

### Settings

Export backup · Import backup · Import plan from Excel · Start new plan (duplicate + new start date) · Past plans · Sound on/off (on by default) · About/version.

## Visual system

- **"Aurora", dark only.** Deep navy (`#070a1c`) with slowly drifting violet/cyan glows behind frosted-glass cards (`backdrop-filter`); the accent is a violet→cyan gradient (`--grad`) used on set dots, the primary button, rings and bars, with glows. Gold (`--gold-grad`) is reserved for the test day (numbers, dots, button). Tokens live in `styles/tokens.css`.
- **Type colours** (each with a text label, never colour alone): Rope = violet · Test = gold · Walk = teal · Rest = periwinkle · Optional = muted, dashed border.
- **Typography:** **Space Grotesk** (bundled woff2, precached) for headings and numbers; system font for body text; numbers use `tabular-nums`; the prescription is the largest text on the card (it's the thing you glance at).
- **Touch:** every target ≥ 48px (set dots 56px); primary actions in the bottom third; no hover-only UI.
- **Feedback:** see *Gamification → Celebrations* above. Sounds are synthesised with Web Audio (`fx/sound.ts`, no audio files); confetti is a throwaway canvas (`fx/confetti.ts`). Everything animated is disabled under `prefers-reduced-motion`; `navigator.vibrate` where supported.
- **Accessibility:** dots are `<button aria-pressed>` labelled "Light rope set 3 of 6, 30 skips"; WCAG AA contrast in both themes.

## Key behaviours

- **`todayLocal()`** is the one source of "today"; it re-checks when the app regains visibility (the PWA may stay open overnight).
- **Auto-complete:** when every set is filled, `done = true`, unless the user manually un-marked the day (the log remembers via `manual`).
- **Streak:** counts back from the most recent past rope/test day; walk/rest/optional days are skipped and don't break the streak. Today doesn't break it until the day is over.
- **Import flow:** parse → preview ("38 days, 26 rope, 2 warnings") → confirm → becomes the active plan; the previous plan is archived.
