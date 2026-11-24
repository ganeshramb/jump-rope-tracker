import { addDays, diffDays, mondayOf } from './dates';
import type { AppData, DayLog, Plan, PlanDay } from './types';
import { isPlanned } from './types';

export const logKey = (planId: string, date: string) => `${planId}:${date}`;

export const getLog = (data: AppData, planId: string, date: string): DayLog | undefined =>
  data.logs[logKey(planId, date)];

export const activePlan = (data: AppData): Plan =>
  data.plans.find((p) => p.id === data.activePlanId) ?? data.plans[0];

export const findDay = (plan: Plan, date: string): PlanDay | undefined =>
  plan.days.find((d) => d.date === date);

export const planEnd = (plan: Plan) => plan.days[plan.days.length - 1]?.date ?? plan.startDate;

/** Weeks run Monday–Sunday; week 1 is the week containing the plan's first day (matches the sheet). */
export function weekOf(plan: Plan, date: string): number {
  return Math.floor(diffDays(mondayOf(plan.startDate), date) / 7) + 1;
}

export function planPhase(plan: Plan, today: string): 'before' | 'active' | 'after' {
  if (today < plan.startDate) return 'before';
  if (today > planEnd(plan)) return 'after';
  return 'active';
}

export function groupByWeek(plan: Plan): { week: number; days: PlanDay[] }[] {
  const weeks: { week: number; days: PlanDay[] }[] = [];
  for (const day of plan.days) {
    const w = weekOf(plan, day.date);
    const last = weeks[weeks.length - 1];
    if (last?.week === w) last.days.push(day);
    else weeks.push({ week: w, days: [day] });
  }
  return weeks;
}

export const nextPlannedDay = (plan: Plan, after: string): PlanDay | undefined =>
  plan.days.find((d) => d.date > after && isPlanned(d.type));

export const effectiveThick = (day: PlanDay, log?: DayLog) =>
  log?.useAlt && day.altThick ? day.altThick : day.thick;

export type DayStatus = 'done' | 'partial' | 'missed' | 'today' | 'upcoming' | 'off';

export function dayStatus(day: PlanDay, log: DayLog | undefined, today: string): DayStatus {
  if (log?.done) return 'done';
  const anySet = [...(log?.light ?? []), ...(log?.thick ?? [])].some((v) => v !== null);
  if (anySet) return 'partial';
  if (day.date === today) return 'today';
  if (day.date > today) return 'upcoming';
  return isPlanned(day.type) ? 'missed' : 'off';
}

/** Copy a plan to a new start date (dates shift; logs don't come along). */
export function duplicatePlan(plan: Plan, newStart: string, id: string): Plan {
  const shift = diffDays(plan.startDate, newStart);
  return {
    id,
    name: `${plan.name} (from ${newStart})`,
    startDate: newStart,
    days: plan.days.map((d) => ({ ...d, date: addDays(d.date, shift) })),
  };
}
