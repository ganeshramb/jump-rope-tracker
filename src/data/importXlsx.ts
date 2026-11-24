// Reads a plan from an .xlsx in the same layout as "Jump Rope Tracker — Nov 24 to Dec 31.xlsx":
// a header row with Date | Day | Week | Type | Light rope | Thick rope | Done | Notes (order doesn't matter).
// Used by scripts/build-seed.ts (Node) and lazy-loaded by Settings (browser).
import * as XLSX from 'xlsx';
import { excelSerialToISO, toISO } from '../domain/dates';
import { altFromNote, parsePrescription } from '../domain/prescription';
import type { DayType, Plan, PlanDay } from '../domain/types';

export type ImportResult = {
  plan: Plan;
  /** Dates whose "Done" cell was ticked in the sheet. */
  doneDates: string[];
  warnings: string[];
};

const TYPE_MAP: Record<string, DayType> = {
  rope: 'rope',
  walk: 'walk',
  'walk (opt)': 'walk',
  rest: 'rest',
  optional: 'optional',
  test: 'test',
};

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

function cellToISO(v: unknown): string | undefined {
  if (typeof v === 'number') return excelSerialToISO(v);
  if (v instanceof Date) return toISO(v);
  const s = String(v ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

export function importPlanFromXlsx(
  data: ArrayBuffer | Uint8Array,
  opts: { id: string; name: string },
): ImportResult {
  const wb = XLSX.read(data, { type: 'array' });
  const warnings: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, raw: true, defval: null });
    const headerIdx = rows.findIndex((r) => r.some((c) => norm(c) === 'date') && r.some((c) => norm(c) === 'type'));
    if (headerIdx === -1) continue;

    const header = rows[headerIdx].map(norm);
    const col = (name: string) => header.indexOf(name);
    const cDate = col('date'), cType = col('type'), cLight = col('light rope'), cThick = col('thick rope');
    const cDone = col('done'), cNotes = col('notes');

    const days: PlanDay[] = [];
    const doneDates: string[] = [];
    rows.slice(headerIdx + 1).forEach((r, i) => {
      const rowNo = headerIdx + i + 2; // 1-based sheet row, for warnings
      const date = cellToISO(r[cDate]);
      if (!date) {
        if (r.some((c) => c !== null && c !== '')) warnings.push(`Row ${rowNo}: no valid date, skipped`);
        return;
      }
      let type = TYPE_MAP[norm(r[cType])];
      if (!type) {
        warnings.push(`Row ${rowNo}: unknown type "${r[cType] ?? ''}", treated as Optional`);
        type = 'optional';
      }
      const day: PlanDay = { date, type };
      const notes: string[] = [];
      for (const [c, key] of [[cLight, 'light'], [cThick, 'thick']] as const) {
        if (c === -1) continue;
        const { rx, warning } = parsePrescription(r[c]);
        if (rx) day[key] = rx;
        if (warning) {
          warnings.push(`Row ${rowNo}: ${warning}`);
          notes.push(String(r[c])); // keep the text so nothing is lost
        }
      }
      if (cNotes !== -1 && r[cNotes]) notes.unshift(String(r[cNotes]).trim());
      if (notes.length) day.note = notes.join(' · ');
      const alt = altFromNote(day.note);
      if (alt && day.thick) day.altThick = alt;
      if (cDone !== -1) {
        const v = r[cDone];
        if (v === true || v === 1 || norm(v) === 'true') doneDates.push(date);
      }
      days.push(day);
    });

    if (days.length === 0) continue;
    days.sort((a, b) => a.date.localeCompare(b.date));
    return { plan: { id: opts.id, name: opts.name, startDate: days[0].date, days }, doneDates, warnings };
  }

  throw new Error('No sheet with "Date" and "Type" columns was found in this file.');
}
