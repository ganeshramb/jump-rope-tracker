import { achievements, gameState } from '../domain/game';
import type { AppData, AppDataV1 } from '../domain/types';

/** Bring saved data or a backup up to the current schema. */
export function migrate(d: AppData | AppDataV1): AppData {
  if (d.schemaVersion === 2) return d;
  const v2: AppData = { ...d, schemaVersion: 2, celebrated: [] };
  // Mark what was already achieved as celebrated, so upgrading doesn't fire every past party at once.
  return { ...v2, celebrated: achievements(gameState(v2)) };
}
