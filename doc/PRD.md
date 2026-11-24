# PRD — Jump Rope Tracker

## Context

`Jump Rope Tracker — Nov 24 to Dec 31.xlsx` is a 38-day (6-week) jump-rope plan running **Tue 2026-11-24 → Thu 2026-12-31** (Test Day). The spreadsheet works, but it is a poor fit for use mid-workout on a phone:

- You tick one "Done" box per day; there's no per-set tracking and no record of what you actually did.
- Prescriptions are text (`6×30`, `3×15`, `2×30 warm-up`), so nothing can be counted or totalled.
- Conditional coaching notes ("If easy → Wk 2 thick at 3×20") rely on you remembering them.
- There are only two stats: `Sessions done = COUNTIF(Done,TRUE)` and `Rope days planned = COUNTIF(Rope)+COUNTIF(Test)` = 26.

**Confirmed decisions:** `6×30` = 6 sets of 30 **skips** (rep counter, not a timer) · **phone PWA** · **this plan + start/import a new one** · **on-device storage only**, with JSON backup.

## Problem

The plan lives in a spreadsheet that is clumsy on a phone and only records yes/no per day, so you lose what actually happened and the coaching rules aren't acted on.

## User

One person, training on their own, phone in hand, between sets, possibly sweaty. Wants answers to "what do I do today?" in one second and "am I on track for Dec 31?" in one glance.

## Goals

1. Opening the app shows today's workout immediately, with no navigation needed.
2. Logging a session takes ≤ 3 seconds of interaction per set.
3. Everything in the spreadsheet can be done in the app, plus per-set logging, "feel", and conditional step-ups.
4. Works fully offline; data never leaves the device unless exported.

**Non-goals:** accounts, cloud sync, social features, timers, skip detection via sensors, AI plan generation.

## Glossary

- **Plan:** an ordered list of Days.
- **Day:** has a Type (Rope · Walk (opt) · Rest · Optional · Test) and up to two Prescriptions (light rope, thick rope).
- **Prescription:** `sets × reps`, e.g. `6×30` = 6 sets of 30 skips.
- **Log:** what you actually did on a date.

## Functional requirements

### P0 — MVP

| ID | Requirement |
|---|---|
| F1 | **Seeded plan:** the app ships with all 38 days from the Excel file (dates, types, light/thick prescriptions, notes). |
| F2 | **Today screen:** shows today's date, week, type, light and thick prescriptions as tappable set dots, and the day's note. Before the plan starts or after it ends, show a "plan not started" / "plan complete" state. |
| F3 | **Set logging:** tapping a set marks it done at the prescribed reps; tapping again undoes it; long-pressing lets you enter actual reps (e.g. 22/30). Done sets show the actual count. |
| F4 | **Day completion:** a day auto-completes when every prescribed set is logged. There's also a manual "Mark done" / "Mark not done" toggle (matching the Excel checkbox). Rest/Walk days can be ticked as done optionally. |
| F5 | **Plan screen:** week groups, each day showing type colour, prescriptions, and status (done / partial / missed / upcoming / today). Tap → Day screen. |
| F6 | **Day screen:** the same logging UI as Today for any date (to log late or fix mistakes), plus editing type, prescriptions and note. |
| F7 | **Progress stats:** *Sessions done* = Rope/Test days marked done, out of *Rope days planned* = Rope + Test = 26. Optional days done show as "+N bonus" and ticked walks are counted separately. (The sheet's `COUNTIF(Done)` counted any ticked row; splitting them keeps "12 / 26" honest.) Also shown: current streak of planned rope days (rest days don't break it), total skips (light / thick), per-week completion, and days to the test. |
| F8 | **Persistence:** every change saves immediately to IndexedDB; there is no save button. |
| F9 | **Installable offline PWA:** manifest, icons, service worker; launches with no network. |

### P1

| ID | Requirement |
|---|---|
| F10 | **Feel rating:** after completion, pick Easy / Right / Hard (optional, one tap). |
| F11 | **Conditional step-up:** a Day may carry an `alt` thick prescription (seeded: Tue Wk 2 thick `3×20`, from "3×20 if Friday felt easy"). If the most recent thick-rope session was rated *Easy*, the card suggests "Step up to 3×20?". One tap swaps the prescription for that day. |
| F12 | **Backup:** export all data (plans + logs) as JSON; import JSON (replaces current data, after confirmation). Show a "last backup N days ago" hint in Settings. |
| F13 | **New plan:** at plan end (or anytime from Settings), (a) import an `.xlsx` in the same format as the original sheet, or (b) duplicate the current plan shifted to a new start date. Older plans stay viewable, read-only. |

### P1.5 — "Aurora" redesign + gamification (added 2026-11-24)

| ID | Requirement |
|---|---|
| F14 | **Look:** dark-only "Aurora" theme (glass cards, violet→cyan glow, gold test day), Space Grotesk display font bundled for offline use. Light theme and theme switch removed. |
| F15 | **XP, levels, badges:** XP per set + day bonus × streak multiplier; growing level thresholds; 9 milestone badges. All derived from logs, so editing a day updates them. Level bar + streak flame on Today; level card, heatmap, skips-per-session chart and badge shelf on Progress. |
| F16 | **Celebrations that scale with the achievement:** per-set pop, day-complete confetti + chime + "+XP", and a full-screen overlay + fanfare for level-ups, badges, perfect weeks and test day. Each achievement is celebrated once, never in the middle of a session. |
| F17 | **Sound** on by default, toggle in Settings. |

### P2 — later, only if wanted

CSV export of logs · progression charts · daily reminder notification · a simple plan builder.

## Acceptance criteria

- Opening on 2026-11-27 shows "Fri · Week 1 · Rope", light 6×30 (6 dots), thick 2×10 (2 dots), and the note "First taste of thick rope…".
- On a fresh install the stats show `0 / 26` sessions; ticking all 8 sets on Nov 27 makes it `1 / 26`.
- With airplane mode on, the installed app opens and logging works; the data is still there after a force-close.
- Importing the original `.xlsx` gives exactly 38 days; dates run Nov 24 to Dec 31; Rope + Test = 26.
- If you open the app at 00:30 local time, it shows the local calendar day, not the UTC one.

## Success metrics (personal)

- You stop opening the Excel file.
- ≥ 90% of sessions are logged the same day.
- You reach the Dec 31 test with the logs to compare against your stretch goal (6×50).
