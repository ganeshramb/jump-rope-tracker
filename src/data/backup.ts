import { todayLocal } from '../domain/dates';
import type { AppData, AppDataV1 } from '../domain/types';
import { migrate } from './migrate';

export function downloadBackup(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jump-rope-backup-${todayLocal()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Validates the shape well enough to refuse the wrong file; throws a readable message. */
export function parseBackup(text: string): AppData {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  const a = d as AppData | AppDataV1;
  if (![1, 2].includes(a?.schemaVersion) || !Array.isArray(a.plans) || typeof a.logs !== 'object' || !a.activePlanId) {
    throw new Error('That file isn’t a Jump Rope Tracker backup.');
  }
  return migrate(a);
}
