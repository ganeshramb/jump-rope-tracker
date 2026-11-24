// Everything here is derived from plan + logs on demand (like the sheet's COUNTIFs) — no stored counters.
import { diffDays } from './dates';
import { getLog, groupByWeek } from './plan';
import { skipsIn } from './log';
import type { AppData, Feel, Plan } from './types';
import { isPlanned } from './types';

export type PlanStats = {
  planned: number; // Rope + Test days
  done: number; // planned days marked done
  bonus: number; // optional days done
  walks: number; // walk days ticked
  lightSkips: number;
  thickSkips: number;
  streak: number;
  weeks: { week: number; planned: number; done: number }[];
  daysToTest?: number;
};

export function planStats(data: AppData, plan: Plan, today: string): PlanStats {
  const log = (date: string) => getLog(data, plan.id, date);
  let done = 0, bonus = 0, walks = 0, lightSkips = 0, thickSkips = 0;
  for (const d of plan.days) {
    const l = log(d.date);
    lightSkips += skipsIn(l, 'light');
    thickSkips += skipsIn(l, 'thick');
    if (!l?.done) continue;
    if (isPlanned(d.type)) done++;
    else if (d.type === 'optional') bonus++;
    else if (d.type === 'walk') walks++;
  }

  const planned = plan.days.filter((d) => isPlanned(d.type)).length;

  // Streak: consecutive done planned days counting back from today. Non-planned days are skipped;
  // today only counts if done (an unfinished today doesn't break the streak yet).
  let streak = 0;
  const past = plan.days.filter((d) => isPlanned(d.type) && d.date <= today).reverse();
  for (const d of past) {
    if (log(d.date)?.done) streak++;
    else if (d.date === today) continue;
    else break;
  }

  const weeks = groupByWeek(plan).map(({ week, days }) => ({
    week,
    planned: days.filter((d) => isPlanned(d.type)).length,
    done: days.filter((d) => isPlanned(d.type) && log(d.date)?.done).length,
  }));

  const test = plan.days.find((d) => d.type === 'test' && d.date >= today);
  return {
    planned, done, bonus, walks, lightSkips, thickSkips, streak, weeks,
    daysToTest: test ? diffDays(today, test.date) : undefined,
  };
}

/** Planned days before today that were never marked done. */
export const missedDays = (data: AppData, plan: Plan, today: string) =>
  plan.days.filter((d) => isPlanned(d.type) && d.date < today && !getLog(data, plan.id, d.date)?.done);

/** Feel of the most recent completed session before `date` that included thick rope. */
export function lastThickFeel(data: AppData, plan: Plan, date: string): Feel | undefined {
  const prev = plan.days
    .filter((d) => d.date < date && d.thick && getLog(data, plan.id, d.date)?.done)
    .pop();
  return prev ? getLog(data, plan.id, prev.date)?.feel : undefined;
}
