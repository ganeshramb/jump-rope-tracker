export type DayType = 'rope' | 'walk' | 'rest' | 'optional' | 'test';

/** "6×30" → { sets: 6, reps: 30 }; "2×30 warm-up" → { sets: 2, reps: 30, label: 'warm-up' } */
export type Prescription = { sets: number; reps: number; label?: string };

export type Rope = 'light' | 'thick';

export type PlanDay = {
  date: string; // YYYY-MM-DD, local calendar date
  type: DayType;
  light?: Prescription;
  thick?: Prescription;
  /** Optional step-up for the thick rope, offered when the last thick session felt easy. */
  altThick?: Prescription;
  note?: string;
};

export type Plan = {
  id: string;
  name: string;
  startDate: string;
  days: PlanDay[];
  archived?: boolean;
};

export type Feel = 'easy' | 'right' | 'hard';

export type DayLog = {
  planId: string;
  date: string;
  /** Actual reps per set; null = set not done yet. */
  light?: (number | null)[];
  thick?: (number | null)[];
  useAlt?: boolean;
  done: boolean;
  /** True when `done` was set by hand (overrides auto-complete until all sets are filled again). */
  manual?: boolean;
  feel?: Feel;
  updatedAt: number;
};

export type AppData = {
  schemaVersion: 2;
  activePlanId: string;
  plans: Plan[];
  logs: Record<string, DayLog>; // key: `${planId}:${date}`
  lastBackupAt?: number;
  /** Achievement keys already celebrated (`level:4`, `badge:1k`, …) so each party happens once. */
  celebrated: string[];
};

/** v1 had no `celebrated`. */
export type AppDataV1 = Omit<AppData, 'schemaVersion' | 'celebrated'> & { schemaVersion: 1 };

/** Days that count toward "Rope days planned" — same as the sheet's COUNTIF(Rope)+COUNTIF(Test). */
export const isPlanned = (type: DayType) => type === 'rope' || type === 'test';

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  rope: 'Rope',
  walk: 'Walk (opt)',
  rest: 'Rest',
  optional: 'Optional',
  test: 'Test',
};
