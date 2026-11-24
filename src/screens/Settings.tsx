import { useState } from 'react';
import { downloadBackup, parseBackup } from '../data/backup';
import type { ImportResult } from '../data/importXlsx';
import { useStore, useToday } from '../data/store';
import { addDays, diffDays, longDate, mondayOf, toISO } from '../domain/dates';
import { activePlan, duplicatePlan, logKey, planEnd } from '../domain/plan';
import { planStats } from '../domain/stats';
import type { AppData, DayLog, Plan } from '../domain/types';
import { isPlanned } from '../domain/types';
import { chimeSound, setSoundOn, soundOn } from '../fx/sound';

const newId = () => globalThis.crypto?.randomUUID?.() ?? `plan-${Date.now()}`;

/** Make `plan` the active one; the previous plans become read-only history. */
function withNewActivePlan(d: AppData, plan: Plan, logs: DayLog[] = []): AppData {
  return {
    ...d,
    activePlanId: plan.id,
    plans: [...d.plans.map((p) => ({ ...p, archived: true })), plan],
    logs: { ...d.logs, ...Object.fromEntries(logs.map((l) => [logKey(l.planId, l.date), l])) },
  };
}

export function Settings() {
  const { data, update, replaceAll } = useStore();
  const today = useToday();
  const plan = activePlan(data);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string }>();
  const [preview, setPreview] = useState<ImportResult>();
  const [newStart, setNewStart] = useState(() => addDays(mondayOf(today), 7));
  const [sound, setSound] = useState(soundOn);

  const backupAge = data.lastBackupAt
    ? diffDays(toISO(new Date(data.lastBackupAt)), today)
    : undefined;

  const exportBackup = () => {
    const stamped = { ...data, lastBackupAt: Date.now() };
    downloadBackup(stamped);
    update(() => stamped);
    setMsg({ kind: 'ok', text: 'Backup downloaded. Keep it somewhere safe (e.g. your cloud drive).' });
  };

  const importBackup = async (file: File) => {
    try {
      const incoming = parseBackup(await file.text());
      if (!confirm(`Replace everything on this device with the backup "${file.name}"?`)) return;
      replaceAll(incoming);
      setMsg({ kind: 'ok', text: 'Backup restored.' });
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    }
  };

  const readXlsx = async (file: File) => {
    try {
      // SheetJS is only downloaded when you actually import a spreadsheet.
      const { importPlanFromXlsx } = await import('../data/importXlsx');
      const name = file.name.replace(/\.xlsx$/i, '').replace(/^Jump Rope Tracker\s*[—-]\s*/, '');
      setPreview(importPlanFromXlsx(new Uint8Array(await file.arrayBuffer()), { id: newId(), name }));
      setMsg(undefined);
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message });
    }
  };

  const confirmImport = () => {
    if (!preview) return;
    const logs = preview.doneDates.map<DayLog>((date) => ({ planId: preview.plan.id, date, done: true, manual: true, updatedAt: Date.now() }));
    update((d) => withNewActivePlan(d, preview.plan, logs));
    setPreview(undefined);
    setMsg({ kind: 'ok', text: `“${preview.plan.name}” is now your active plan.` });
  };

  const startCopy = () => {
    update((d) => withNewActivePlan(d, duplicatePlan(plan, newStart, newId())));
    setMsg({ kind: 'ok', text: `New plan starts ${longDate(newStart)}. Your old plan is kept under Past plans.` });
  };

  const past = data.plans.filter((p) => p.id !== plan.id);

  return (
    <main className="screen">
      <header className="screen__head">
        <h1 className="screen__title">Settings</h1>
      </header>

      {msg && <p className={`banner${msg.kind === 'error' ? ' banner--error' : ' banner--ok'}`} role="status">{msg.text}</p>}

      <section className="card">
        <h2 className="section-title">Backup</h2>
        <p className="hint">
          Your data lives only on this device.{' '}
          {backupAge === undefined ? 'You haven’t made a backup yet.' : backupAge === 0 ? 'Last backup: today.' : `Last backup: ${backupAge} day${backupAge === 1 ? '' : 's'} ago.`}
        </p>
        <div className="row-actions">
          <button type="button" className="btn btn--primary" onClick={exportBackup}>Export backup</button>
          <label className="btn">
            Import backup
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ''; }} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">New plan</h2>
        <p className="hint">Current: <b>{plan.name}</b> ({longDate(plan.startDate)} – {longDate(planEnd(plan))}).</p>

        <h3 className="sub-title">Repeat this plan</h3>
        <div className="row-actions">
          <label className="field field--inline">
            Starting
            <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
          </label>
          <button type="button" className="btn" disabled={!newStart} onClick={startCopy}>Start copy</button>
        </div>

        <h3 className="sub-title">Import from Excel</h3>
        <p className="hint">Same layout as the original sheet: Date, Type, Light rope, Thick rope, Done, Notes columns.</p>
        <label className="btn">
          Choose .xlsx file
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readXlsx(f); e.target.value = ''; }} />
        </label>

        {preview && (
          <div className="preview">
            <p>
              <b>{preview.plan.name}</b>: {preview.plan.days.length} days, {longDate(preview.plan.startDate)} – {longDate(planEnd(preview.plan))},{' '}
              {preview.plan.days.filter((d) => isPlanned(d.type)).length} rope sessions
              {preview.doneDates.length ? `, ${preview.doneDates.length} already ticked done` : ''}.
            </p>
            {preview.warnings.length > 0 && (
              <ul className="warnings">{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            )}
            <div className="row-actions">
              <button type="button" className="btn btn--primary" onClick={confirmImport}>Use this plan</button>
              <button type="button" className="btn btn--ghost" onClick={() => setPreview(undefined)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="card">
          <h2 className="section-title">Past plans</h2>
          <ul className="past">
            {past.map((p) => {
              const s = planStats(data, p, today);
              return (
                <li key={p.id}>
                  <b>{p.name}</b>
                  <span className="hint">{longDate(p.startDate)} – {longDate(planEnd(p))} · {s.done}/{s.planned} sessions · {new Intl.NumberFormat('en').format(s.lightSkips + s.thickSkips)} skips</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="section-title">Sound</h2>
        <div className="segmented" role="radiogroup" aria-label="Sound effects">
          {[true, false].map((on) => (
            <button
              key={String(on)}
              type="button"
              role="radio"
              aria-checked={sound === on}
              className={`chip${sound === on ? ' chip--on' : ''}`}
              onClick={() => { setSoundOn(on); setSound(on); if (on) chimeSound(); }}
            >
              {on ? 'On' : 'Off'}
            </button>
          ))}
        </div>
        <p className="hint">Clicks on each set, a chime when you finish, fanfare for level-ups and badges.</p>
      </section>

      <p className="about">Jump Rope Tracker v{__APP_VERSION__} · works offline · no account, no tracking</p>
    </main>
  );
}
