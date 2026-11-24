// Gamification: XP, levels, badges. Like stats.ts, everything is derived from plans + logs on demand,
// so editing an old day can never leave a stale counter behind. The only stored piece is
// `AppData.celebrated`: which achievements the app has already thrown a party for.
import { rxFor, setValues, skipsIn } from './log';
import { getLog, groupByWeek } from './plan';
import type { AppData, DayLog, PlanDay, Rope } from './types';
import { isPlanned } from './types';

export const XP_RULES = {
  set: { light: 10, thick: 15 } as Record<Rope, number>,
  dayBonus: 50,
  streakStep: 0.1, // +10% per session already in the streak…
  streakCap: 10, //   …up to ×2
};

const ROPES: Rope[] = ['light', 'thick'];

/** XP for the sets logged on one day. A short set (22 of 30) earns its share; extra reps don't earn more. */
export function setsXp(day: PlanDay, log: DayLog | undefined): number {
  let xp = 0;
  for (const rope of ROPES) {
    const rx = rxFor(day, log, rope);
    if (!rx || !log) continue;
    for (const v of setValues(log, rope, rx)) if (v !== null) xp += XP_RULES.set[rope] * Math.min(v / rx.reps, 1);
  }
  return xp;
}

export const streakMultiplier = (streak: number) => 1 + XP_RULES.streakStep * Math.min(streak, XP_RULES.streakCap);

export type DayXp = { planId: string; date: string; xp: number; multiplier: number };

/** XP earned per day, oldest plan first. The multiplier uses the sessions done in a row *before* that day. */
export function xpLedger(data: AppData): DayXp[] {
  const out: DayXp[] = [];
  for (const plan of [...data.plans].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    let streak = 0;
    for (const day of plan.days) {
      const log = getLog(data, plan.id, day.date);
      const multiplier = streakMultiplier(streak);
      const base = setsXp(day, log) + (log?.done && (day.light || day.thick) ? XP_RULES.dayBonus : 0);
      if (isPlanned(day.type)) streak = log?.done ? streak + 1 : 0;
      if (base > 0) out.push({ planId: plan.id, date: day.date, xp: Math.round(base * multiplier), multiplier });
    }
  }
  return out;
}

/** Total XP needed to reach `level` (level 1 = 0 XP; the gap grows by 150 each level: 150, 450, 900, 1500…). */
export const levelThreshold = (level: number) => 75 * level * (level - 1);

export function levelFor(xp: number) {
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 75)) / 2));
  while (levelThreshold(level + 1) <= xp) level++; // guard against float rounding at exact thresholds
  while (level > 1 && levelThreshold(level) > xp) level--;
  const floor = levelThreshold(level);
  const span = levelThreshold(level + 1) - floor;
  return { level, into: xp - floor, span, toNext: span - (xp - floor) };
}

export type Badge = { id: string; name: string; icon: string; desc: string };

export const BADGES: Badge[] = [
  { id: 'first-set', name: 'First Set', icon: '⚡', desc: 'Log your first set' },
  { id: 'thick-skinned', name: 'Thick Skinned', icon: '🪢', desc: 'Finish a session with the thick rope' },
  { id: '1k', name: '1K Club', icon: '1K', desc: '1,000 skips in total' },
  { id: 'on-fire', name: 'On Fire', icon: '🔥', desc: '5 sessions in a row' },
  { id: 'perfect-week', name: 'Perfect Week', icon: '✨', desc: 'Every session in a week done' },
  { id: 'stepped-up', name: 'Stepped Up', icon: '📈', desc: 'Take a step-up and finish the day' },
  { id: '5k', name: '5K Club', icon: '5K', desc: '5,000 skips in total' },
  { id: 'test-day', name: 'Test Day', icon: '🏆', desc: 'Complete the test' },
  { id: 'stretch-goal', name: 'Stretch Goal', icon: '👑', desc: 'Hit the test-day stretch goal' },
];

/** "TEST DAY. Stretch goal: 6×50" → { sets: 6, reps: 50 } */
export function stretchGoal(day: PlanDay) {
  const m = day.note?.match(/stretch goal:?\s*(\d+)\s*[×xX*]\s*(\d+)/i);
  return m ? { sets: Number(m[1]), reps: Number(m[2]) } : undefined;
}

export type GameState = {
  xp: number;
  level: ReturnType<typeof levelFor>;
  totalSkips: number;
  bestStreak: number;
  earned: Set<string>; // badge ids
  perfectWeeks: string[]; // `${planId}:${week}`
  testsDone: string[]; // plan ids
};

export function gameState(data: AppData): GameState {
  const ledger = xpLedger(data);
  const xp = ledger.reduce((s, d) => s + d.xp, 0);
  const logs = Object.values(data.logs);
  const totalSkips = logs.reduce((s, l) => s + skipsIn(l, 'light') + skipsIn(l, 'thick'), 0);

  const earned = new Set<string>();
  const perfectWeeks: string[] = [];
  const testsDone: string[] = [];
  let bestStreak = 0;

  if (logs.some((l) => [...(l.light ?? []), ...(l.thick ?? [])].some((v) => v !== null))) earned.add('first-set');
  if (totalSkips >= 1000) earned.add('1k');
  if (totalSkips >= 5000) earned.add('5k');

  for (const plan of data.plans) {
    let streak = 0;
    for (const day of plan.days) {
      const log = getLog(data, plan.id, day.date);
      if (isPlanned(day.type)) {
        streak = log?.done ? streak + 1 : 0;
        bestStreak = Math.max(bestStreak, streak);
      }
      if (!log?.done) continue;
      if (rxFor(day, log, 'thick')) earned.add('thick-skinned');
      if (log.useAlt && day.altThick) earned.add('stepped-up');
      if (day.type === 'test') {
        earned.add('test-day');
        testsDone.push(plan.id);
        const goal = stretchGoal(day);
        const rope: Rope = day.thick ? 'thick' : 'light';
        const hit = setValues(log, rope, rxFor(day, log, rope)).filter((v) => v !== null && goal && v >= goal.reps);
        if (goal && hit.length >= goal.sets) earned.add('stretch-goal');
      }
    }
    for (const { week, days } of groupByWeek(plan)) {
      const planned = days.filter((d) => isPlanned(d.type));
      if (planned.length && planned.every((d) => getLog(data, plan.id, d.date)?.done)) perfectWeeks.push(`${plan.id}:${week}`);
    }
  }
  if (bestStreak >= 5) earned.add('on-fire');
  if (perfectWeeks.length) earned.add('perfect-week');

  return { xp, level: levelFor(xp), totalSkips, bestStreak, earned, perfectWeeks, testsDone };
}

/** Everything worth celebrating, as stable keys. New keys (not in `AppData.celebrated`) trigger a celebration. */
export function achievements(g: GameState): string[] {
  return [
    ...Array.from({ length: g.level.level - 1 }, (_, i) => `level:${i + 2}`),
    ...[...g.earned].map((id) => `badge:${id}`),
    ...g.perfectWeeks.map((w) => `week:${w}`),
    ...g.testsDone.map((p) => `test:${p}`),
  ];
}

/** XP earned on one day (for the "+155 XP" next to the done button). */
export const dayXp = (data: AppData, planId: string, date: string) =>
  xpLedger(data).find((d) => d.planId === planId && d.date === date);
