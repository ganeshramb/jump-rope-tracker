// Runs in India Standard Time (UTC+5:30): see `test.env.TZ` in vite.config.ts.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importPlanFromXlsx } from '../data/importXlsx';
import seed from '../data/seed-plan.json';
import { addDays, excelSerialToISO, longDate, mondayOf, todayLocal } from './dates';
import { emptyLog, setDone, setFeel, setReps, setUseAlt, setValues, toggleSet } from './log';
import { achievements, gameState, levelFor, xpLedger } from './game';
import { migrate } from '../data/migrate';
import { altFromNote, parsePrescription } from './prescription';
import { dayStatus, duplicatePlan, findDay, logKey, weekOf } from './plan';
import { parseBackup } from '../data/backup';
import { lastThickFeel, missedDays, planStats } from './stats';
import type { AppData, AppDataV1, DayLog, Plan } from './types';
import { isPlanned } from './types';

const plan = seed as Plan;
const day = (date: string) => findDay(plan, date)!;
const dataWith = (...logs: DayLog[]): AppData => ({
  schemaVersion: 2,
  celebrated: [],
  activePlanId: plan.id,
  plans: [plan],
  logs: Object.fromEntries(logs.map((l) => [logKey(l.planId, l.date), l])),
});
/** Log with every set of the day filled. */
function completeDay(date: string, feel?: DayLog['feel']): DayLog {
  const d = day(date);
  let log = emptyLog(plan.id, date);
  for (const rope of ['light', 'thick'] as const) {
    const rx = d[rope];
    for (let i = 0; i < (rx?.sets ?? 0); i++) log = toggleSet(d, log, rope, i);
  }
  return feel ? setFeel(log, feel) : log;
}

describe('parsePrescription', () => {
  it('parses sets×reps', () => expect(parsePrescription('6×30').rx).toEqual({ sets: 6, reps: 30 }));
  it('accepts x and spaces', () => expect(parsePrescription(' 3 x 15 ').rx).toEqual({ sets: 3, reps: 15 }));
  it('keeps a trailing label', () =>
    expect(parsePrescription('2×30 warm-up').rx).toEqual({ sets: 2, reps: 30, label: 'warm-up' }));
  it('treats blank as no prescription', () => {
    expect(parsePrescription('')).toEqual({});
    expect(parsePrescription(null)).toEqual({});
  });
  it('warns on junk instead of throwing', () => {
    const r = parsePrescription('as many as possible');
    expect(r.rx).toBeUndefined();
    expect(r.warning).toMatch(/as many as possible/);
  });
  it('finds a conditional alt in a note', () => {
    expect(altFromNote('3×20 if Friday felt easy')).toEqual({ sets: 3, reps: 20 });
    expect(altFromNote('First taste of thick rope. If easy → Wk 2 thick at 3×20')).toBeUndefined();
  });
});

describe('dates', () => {
  it('converts Excel serials', () => {
    expect(excelSerialToISO(46350)).toBe('2026-11-24');
    expect(excelSerialToISO(46387)).toBe('2026-12-31');
  });
  it('uses the local calendar day at 00:30 IST, not the UTC day', () => {
    const halfPastMidnightIST = new Date('2026-11-24T19:00:00Z'); // = 2026-11-25 00:30 IST
    expect(halfPastMidnightIST.toISOString().slice(0, 10)).toBe('2026-11-24'); // the trap
    expect(todayLocal(halfPastMidnightIST)).toBe('2026-11-25');
  });
  it('does day arithmetic across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(mondayOf('2026-11-24')).toBe('2026-11-23');
    expect(longDate('2026-11-27')).toBe('Fri 27 Nov');
  });
});

describe('importing the real spreadsheet', () => {
  const docDir = join(__dirname, '..', '..', 'doc');
  const file = readdirSync(docDir).find((f) => f.endsWith('.xlsx'))!;
  const result = importPlanFromXlsx(readFileSync(join(docDir, file)), { id: plan.id, name: plan.name });

  it('has 38 days from Nov 24 to Dec 31 and no warnings', () => {
    expect(result.plan.days).toHaveLength(38);
    expect(result.plan.days[0].date).toBe('2026-11-24');
    expect(result.plan.days.at(-1)!.date).toBe('2026-12-31');
    expect(result.warnings).toEqual([]);
    expect(result.doneDates).toEqual([]);
  });
  it('matches the committed seed file', () => expect(result.plan).toEqual(plan));
  it('reproduces the sheet: Rope + Test = 26', () =>
    expect(planStats(dataWith(), plan, '2026-11-24').planned).toBe(26));
  it('computes weeks like the sheet (Mon–Sun, week 1 contains the start)', () => {
    expect(weekOf(plan, '2026-11-29')).toBe(1);
    expect(weekOf(plan, '2026-11-30')).toBe(2);
    expect(weekOf(plan, '2026-12-31')).toBe(6);
  });
});

describe('acceptance: Fri 27 Nov', () => {
  const fri = day('2026-11-27');
  it('is a week-1 rope day with 6×30 light, 2×10 thick and the note', () => {
    expect(weekOf(plan, fri.date)).toBe(1);
    expect(fri.type).toBe('rope');
    expect(fri.light).toEqual({ sets: 6, reps: 30 });
    expect(fri.thick).toEqual({ sets: 2, reps: 10 });
    expect(fri.note).toMatch(/^First taste of thick rope/);
  });
  it('goes 0/26 → 1/26 when all 8 sets are ticked', () => {
    expect(planStats(dataWith(), plan, fri.date).done).toBe(0);
    const s = planStats(dataWith(completeDay(fri.date)), plan, fri.date);
    expect(s.done).toBe(1);
    expect(s.lightSkips).toBe(180);
    expect(s.thickSkips).toBe(20);
  });
});

describe('set logging', () => {
  const fri = day('2026-11-27');
  it('tapping fills with prescribed reps, tapping again clears', () => {
    let log = toggleSet(fri, emptyLog(plan.id, fri.date), 'light', 2);
    expect(setValues(log, 'light', fri.light)).toEqual([null, null, 30, null, null, null]);
    log = toggleSet(fri, log, 'light', 2);
    expect(setValues(log, 'light', fri.light).every((v) => v === null)).toBe(true);
  });
  it('auto-completes, and un-completes when a set is cleared', () => {
    let log = completeDay(fri.date);
    expect(log.done).toBe(true);
    log = toggleSet(fri, log, 'thick', 0);
    expect(log.done).toBe(false);
  });
  it('a manual "done" survives set changes until all sets are filled', () => {
    let log = setDone(toggleSet(fri, emptyLog(plan.id, fri.date), 'light', 0), true);
    log = toggleSet(fri, log, 'light', 1);
    expect(log.done).toBe(true);
  });
  it('switching to the step-up resizes the thick sets', () => {
    const tue = day('2026-12-01');
    let log = toggleSet(tue, emptyLog(plan.id, tue.date), 'thick', 0);
    log = setUseAlt(tue, log, true);
    expect(setValues(log, 'thick', tue.altThick)).toEqual([15, null, null]);
  });
});

describe('backup & new plan', () => {
  it('round-trips a backup and rejects other JSON', () => {
    const data = dataWith(completeDay('2026-11-24', 'easy'));
    expect(parseBackup(JSON.stringify(data))).toEqual(data);
    expect(() => parseBackup('{"hello":1}')).toThrow(/isn’t a Jump Rope Tracker backup/);
    expect(() => parseBackup('not json')).toThrow(/valid JSON/);
  });
  it('repeating the plan shifts every day and keeps the prescriptions', () => {
    const copy = duplicatePlan(plan, '2027-01-04', 'p2');
    expect(copy.days).toHaveLength(38);
    expect(copy.days[0]).toMatchObject({ date: '2027-01-04', light: { sets: 6, reps: 30 } });
    expect(copy.days.at(-1)).toMatchObject({ date: '2027-02-10', type: 'test' });
    expect(planStats(dataWith(), copy, '2027-01-04').planned).toBe(26);
  });
});

describe('stats', () => {
  it('streak skips rest days and ignores an unfinished today', () => {
    const logs = ['2026-11-26', '2026-11-27', '2026-11-30'].map((d) => completeDay(d));
    // Sat/Sun are walk/rest; Tue Dec 1 (today) not done yet.
    expect(planStats(dataWith(...logs), plan, '2026-12-01').streak).toBe(3);
    // Missing Fri Nov 27 breaks the run: only Mon counts.
    expect(planStats(dataWith(logs[0], logs[2]), plan, '2026-12-01').streak).toBe(1);
  });
  it('counts optional days as bonus, not planned', () => {
    const s = planStats(dataWith(completeDay('2026-12-25')), plan, '2026-12-26');
    expect(s.done).toBe(0);
    expect(s.bonus).toBe(1);
  });
  it('lists missed days and the days to the test', () => {
    const data = dataWith(completeDay('2026-11-24'));
    expect(missedDays(data, plan, '2026-11-27').map((d) => d.date)).toEqual(['2026-11-25', '2026-11-26']);
    expect(planStats(data, plan, '2026-12-22').daysToTest).toBe(9);
  });
  it('step-up is offered only after an easy thick session', () => {
    expect(lastThickFeel(dataWith(completeDay('2026-11-27', 'easy')), plan, '2026-12-01')).toBe('easy');
    expect(lastThickFeel(dataWith(completeDay('2026-11-27', 'hard')), plan, '2026-12-01')).toBe('hard');
    expect(lastThickFeel(dataWith(), plan, '2026-12-01')).toBeUndefined();
  });
  it('labels day status', () => {
    const d = day('2026-11-25');
    expect(dayStatus(d, undefined, '2026-11-27')).toBe('missed');
    expect(dayStatus(d, undefined, '2026-11-25')).toBe('today');
    expect(dayStatus(d, undefined, '2026-11-24')).toBe('upcoming');
    expect(dayStatus(day('2026-11-29'), undefined, '2026-12-01')).toBe('off');
  });
});

describe('game: XP, levels, badges', () => {
  const xpOn = (data: AppData, date: string) => xpLedger(data).find((d) => d.date === date);
  const allPlanned = () => plan.days.filter((d) => isPlanned(d.type)).map((d) => completeDay(d.date));

  it('a full Fri 27 Nov earns 6×10 + 2×15 + 50 = 140 XP', () => {
    expect(xpOn(dataWith(completeDay('2026-11-27')), '2026-11-27')).toMatchObject({ xp: 140, multiplier: 1 });
  });
  it('a short set earns its share; an unfinished day gets no bonus', () => {
    const fri = day('2026-11-27');
    const log = setReps(fri, emptyLog(plan.id, fri.date), 'light', 0, 15); // 15 of 30
    expect(xpOn(dataWith(log), fri.date)?.xp).toBe(5);
  });
  it('the streak multiplier adds 10% per session in a row, and a miss resets it', () => {
    const run = dataWith(completeDay('2026-11-26'), completeDay('2026-11-27'));
    expect(xpOn(run, '2026-11-27')).toMatchObject({ multiplier: 1.1, xp: 154 });
    const gap = dataWith(completeDay('2026-11-25'), completeDay('2026-11-27')); // Thu 26 missed
    expect(xpOn(gap, '2026-11-27')?.multiplier).toBe(1);
  });
  it('level thresholds grow: 150, 450, 900, 1500', () => {
    expect([0, 149, 150, 449, 450, 900, 1500].map((x) => levelFor(x).level)).toEqual([1, 1, 2, 2, 3, 4, 5]);
    expect(levelFor(300)).toMatchObject({ level: 2, into: 150, span: 300, toNext: 150 });
  });
  it('a perfect plan reaches level 9–10 by the test', () => {
    const level = gameState(dataWith(...allPlanned())).level.level;
    expect(level).toBeGreaterThanOrEqual(9);
    expect(level).toBeLessThanOrEqual(10);
  });
  it('earns badges from the logs', () => {
    expect(gameState(dataWith()).earned.size).toBe(0);
    const week1 = plan.days.filter((d) => isPlanned(d.type) && weekOf(plan, d.date) === 1).map((d) => completeDay(d.date));
    const g = gameState(dataWith(...week1));
    expect([...g.earned].sort()).toEqual(['first-set', 'perfect-week', 'thick-skinned']);
    expect(g.perfectWeeks).toEqual([`${plan.id}:1`]);
    const all = gameState(dataWith(...allPlanned()));
    for (const id of ['1k', '5k', 'on-fire', 'test-day']) expect(all.earned).toContain(id);
    expect(all.earned).not.toContain('stretch-goal');
  });
  it('the stretch goal needs every test-day thick set at 50+', () => {
    const test = day('2026-12-31');
    let log = completeDay(test.date);
    for (let i = 0; i < 6; i++) log = setReps(test, log, 'thick', i, 50);
    expect(gameState(dataWith(log)).earned).toContain('stretch-goal');
    log = setReps(test, log, 'thick', 5, 49);
    expect(gameState(dataWith(log)).earned).not.toContain('stretch-goal');
  });
  it('achievement keys cover levels, badges, perfect weeks and tests', () => {
    const keys = achievements(gameState(dataWith(...allPlanned())));
    expect(keys).toContain('level:2');
    expect(keys).toContain('badge:test-day');
    expect(keys).toContain(`week:${plan.id}:1`);
    expect(keys).toContain(`test:${plan.id}`);
  });
  it('migrating v1 data marks past achievements as already celebrated', () => {
    const { celebrated: _, ...rest } = dataWith(completeDay('2026-11-27'));
    const v2 = migrate({ ...rest, schemaVersion: 1 } as AppDataV1);
    expect(v2.schemaVersion).toBe(2);
    expect(v2.celebrated).toEqual(['badge:first-set', 'badge:thick-skinned']);
    expect(parseBackup(JSON.stringify({ ...rest, schemaVersion: 1 })).celebrated).toEqual(v2.celebrated);
  });
});
