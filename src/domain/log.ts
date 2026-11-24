// Pure functions that return an updated DayLog. The store applies them.
import { effectiveThick } from './plan';
import type { DayLog, Feel, PlanDay, Prescription, Rope } from './types';

export function emptyLog(planId: string, date: string): DayLog {
  return { planId, date, done: false, updatedAt: Date.now() };
}

export const rxFor = (day: PlanDay, log: DayLog | undefined, rope: Rope): Prescription | undefined =>
  rope === 'light' ? day.light : effectiveThick(day, log);

/** The log's values for a rope, sized to the prescription (padding with null / trimming extras). */
export function setValues(log: DayLog | undefined, rope: Rope, rx: Prescription | undefined): (number | null)[] {
  if (!rx) return [];
  const saved = log?.[rope] ?? [];
  return Array.from({ length: rx.sets }, (_, i) => saved[i] ?? null);
}

function allFilled(day: PlanDay, log: DayLog): boolean {
  const ropes: Rope[] = ['light', 'thick'];
  const relevant = ropes.filter((r) => rxFor(day, log, r));
  if (relevant.length === 0) return false;
  return relevant.every((r) => setValues(log, r, rxFor(day, log, r)).every((v) => v !== null));
}

/** After any set change: completing every set marks done; otherwise auto-done is undone unless set by hand. */
function recompute(day: PlanDay, log: DayLog): DayLog {
  if (allFilled(day, log)) return { ...log, done: true, manual: false };
  if (!log.manual) return { ...log, done: false };
  return log;
}

export function setReps(day: PlanDay, log: DayLog, rope: Rope, index: number, reps: number | null): DayLog {
  const values = setValues(log, rope, rxFor(day, log, rope));
  values[index] = reps;
  return recompute(day, { ...log, [rope]: values, updatedAt: Date.now() });
}

/** Tap: empty set → prescribed reps; filled set → empty. */
export function toggleSet(day: PlanDay, log: DayLog, rope: Rope, index: number): DayLog {
  const rx = rxFor(day, log, rope);
  if (!rx) return log;
  const current = setValues(log, rope, rx)[index];
  return setReps(day, log, rope, index, current === null ? rx.reps : null);
}

export function setDone(log: DayLog, done: boolean): DayLog {
  return { ...log, done, manual: true, updatedAt: Date.now() };
}

export function setFeel(log: DayLog, feel: Feel | undefined): DayLog {
  return { ...log, feel, updatedAt: Date.now() };
}

export function setUseAlt(day: PlanDay, log: DayLog, useAlt: boolean): DayLog {
  const next = { ...log, useAlt, updatedAt: Date.now() };
  next.thick = setValues(log, 'thick', effectiveThick(day, next));
  return recompute(day, next);
}

export const skipsIn = (log: DayLog | undefined, rope: Rope) =>
  (log?.[rope] ?? []).reduce<number>((sum, v) => sum + (v ?? 0), 0);
