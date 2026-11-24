import type { Prescription } from './types';

const RX = /^\s*(\d+)\s*[×xX*]\s*(\d+)\s*(.*)$/;

export type ParseResult = { rx?: Prescription; warning?: string };

/** Parse a sheet cell like "6×30" or "2×30 warm-up". Blank → {}. Unparseable → warning. */
export function parsePrescription(raw: unknown): ParseResult {
  if (raw === null || raw === undefined) return {};
  const text = String(raw).trim();
  if (text === '') return {};
  const m = RX.exec(text);
  if (!m) return { warning: `Couldn't read "${text}" as sets×reps` };
  const sets = Number(m[1]);
  const reps = Number(m[2]);
  if (sets < 1 || reps < 1) return { warning: `"${text}" has zero sets or reps` };
  const label = m[3].trim();
  return { rx: label ? { sets, reps, label } : { sets, reps } };
}

export function formatRx(rx: Prescription | undefined): string {
  if (!rx) return '';
  return `${rx.sets}×${rx.reps}${rx.label ? ` ${rx.label}` : ''}`;
}

/** A note that starts with a prescription followed by "if", e.g. "3×20 if Friday felt easy". */
export function altFromNote(note: string | undefined): Prescription | undefined {
  if (!note) return undefined;
  const m = /^\s*(\d+\s*[×xX*]\s*\d+)\s+if\b/i.exec(note);
  return m ? parsePrescription(m[1]).rx : undefined;
}
