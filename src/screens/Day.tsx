import { useState } from 'react';
import { DayCard } from '../components/DayCard';
import { useStore } from '../data/store';
import { addDays, longDate } from '../domain/dates';
import { activePlan, findDay, weekOf } from '../domain/plan';
import type { DayType, PlanDay, Prescription } from '../domain/types';
import { DAY_TYPE_LABEL } from '../domain/types';
import { href } from '../router';

export function DayScreen({ date }: { date: string }) {
  const { data } = useStore();
  const plan = activePlan(data);
  const day = findDay(plan, date);
  const [editing, setEditing] = useState(false);
  const prev = findDay(plan, addDays(date, -1));
  const next = findDay(plan, addDays(date, 1));

  return (
    <main className="screen">
      <header className="screen__head">
        <a className="back" href={href('plan')} aria-label="Back to plan">‹ Plan</a>
        <div className="pager">
          {prev && <a href={href(`day/${prev.date}`)} aria-label="Previous day">‹</a>}
          {next && <a href={href(`day/${next.date}`)} aria-label="Next day">›</a>}
        </div>
      </header>
      <h1 className="screen__title">{longDate(date)}</h1>
      {day ? (
        <>
          <p className="screen__sub">Week {weekOf(plan, date)}</p>
          {editing ? (
            <EditDay day={day} onClose={() => setEditing(false)} />
          ) : (
            <>
              <DayCard plan={plan} day={day} />
              {!plan.archived && (
                <button type="button" className="btn btn--ghost btn--block" onClick={() => setEditing(true)}>
                  Edit this day’s plan
                </button>
              )}
            </>
          )}
        </>
      ) : (
        <div className="empty"><p>This date isn’t in the current plan.</p></div>
      )}
    </main>
  );
}

type RxDraft = { sets: string; reps: string };
const toDraft = (rx?: Prescription): RxDraft => ({ sets: rx ? String(rx.sets) : '', reps: rx ? String(rx.reps) : '' });
function fromDraft(d: RxDraft, prev?: Prescription): Prescription | undefined {
  const sets = Number(d.sets), reps = Number(d.reps);
  if (!(sets >= 1 && reps >= 1)) return undefined; // blank or zero = no work for this rope
  return { sets: Math.round(sets), reps: Math.round(reps), ...(prev?.label ? { label: prev.label } : {}) };
}

function EditDay({ day, onClose }: { day: PlanDay; onClose: () => void }) {
  const { data, update } = useStore();
  const [type, setType] = useState<DayType>(day.type);
  const [light, setLight] = useState(toDraft(day.light));
  const [thick, setThick] = useState(toDraft(day.thick));
  const [note, setNote] = useState(day.note ?? '');

  const save = () => {
    const next: PlanDay = { date: day.date, type };
    const l = fromDraft(light, day.light), t = fromDraft(thick, day.thick);
    if (l) next.light = l;
    if (t) next.thick = t;
    if (t && day.altThick) next.altThick = day.altThick;
    if (note.trim()) next.note = note.trim();
    update((d) => ({
      ...d,
      plans: d.plans.map((p) =>
        p.id === data.activePlanId ? { ...p, days: p.days.map((x) => (x.date === day.date ? next : x)) } : p,
      ),
    }));
    onClose();
  };

  const rxFields = (label: string, v: RxDraft, set: (v: RxDraft) => void) => (
    <fieldset className="rx-edit">
      <legend>{label}</legend>
      <label>Sets <input type="number" inputMode="numeric" min={0} value={v.sets} onChange={(e) => set({ ...v, sets: e.target.value })} /></label>
      <span aria-hidden="true">×</span>
      <label>Skips <input type="number" inputMode="numeric" min={0} value={v.reps} onChange={(e) => set({ ...v, reps: e.target.value })} /></label>
    </fieldset>
  );

  return (
    <form className="day-card edit" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label className="field">
        Type
        <select value={type} onChange={(e) => setType(e.target.value as DayType)}>
          {(Object.keys(DAY_TYPE_LABEL) as DayType[]).map((t) => <option key={t} value={t}>{DAY_TYPE_LABEL[t]}</option>)}
        </select>
      </label>
      {rxFields('Light rope', light, setLight)}
      {rxFields('Thick rope', thick, setThick)}
      <p className="hint">Leave sets blank for no work on that rope. Logged sets are kept.</p>
      <label className="field">
        Note
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="row-actions">
        <button type="submit" className="btn btn--primary">Save</button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}
