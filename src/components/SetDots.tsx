import { useRef, useState } from 'react';
import type { Prescription } from '../domain/types';
import { tickSound, untickSound } from '../fx/sound';

type Props = {
  title: string; // "Light rope"
  rx: Prescription;
  values: (number | null)[];
  readOnly?: boolean;
  /** Show the "hold a dot" tip (only the first rope on a card does). */
  showHint?: boolean;
  /** Base XP per full set, shown as a floating "+10" when a set is ticked. */
  xpPerSet: number;
  onToggle: (index: number) => void;
  onSetReps: (index: number, reps: number | null) => void;
};

const LONG_PRESS_MS = 450;

/** One tappable dot per set. Tap = done at prescribed reps / undo. Long-press = enter actual reps. */
export function SetDots({ title, rx, values, readOnly, showHint, xpPerSet, onToggle, onSetReps }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  /** The set just ticked: only it gets the pop animation (not every filled dot on every render). */
  const [just, setJust] = useState<number>();
  const [draft, setDraft] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);

  const done = values.filter((v) => v !== null).length;
  const skips = values.reduce<number>((s, v) => s + (v ?? 0), 0);

  const startPress = (i: number) => {
    if (readOnly) return;
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      navigator.vibrate?.(30);
      setDraft(String(values[i] ?? rx.reps));
      setEditing(i);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => window.clearTimeout(timer.current);

  const click = (i: number) => {
    if (readOnly) return;
    if (longPressed.current) {
      longPressed.current = false; // the long-press already opened the editor
      return;
    }
    navigator.vibrate?.(15);
    if (values[i] === null) {
      tickSound(i);
      setJust(i);
    } else {
      untickSound();
      setJust(undefined);
    }
    onToggle(i);
  };

  const save = () => {
    if (editing === null) return;
    const n = Number(draft);
    onSetReps(editing, draft.trim() === '' || !Number.isFinite(n) || n <= 0 ? null : Math.round(n));
    setEditing(null);
  };

  return (
    <section className="rope">
      <header className="rope__head">
        <h3 className="rope__title">{title}</h3>
        <span className="rope__rx">
          {rx.sets} × {rx.reps}
          {rx.label && <small className="rope__label"> {rx.label}</small>}
        </span>
      </header>
      <div className="dots" role="group" aria-label={`${title} sets`}>
        {values.map((v, i) => {
          const short = v !== null && v < rx.reps;
          const popped = just === i && v !== null;
          return (
            <button
              key={i}
              type="button"
              className={`dot${v !== null ? ' dot--on' : ''}${short ? ' dot--short' : ''}${popped ? ' dot--pop' : ''}`}
              aria-pressed={v !== null}
              aria-label={`${title} set ${i + 1} of ${rx.sets}, ${v ?? rx.reps} skips${v !== null ? ', done' : ''}`}
              disabled={readOnly}
              onPointerDown={() => startPress(i)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => click(i)}
            >
              {v !== null ? v : ''}
              {popped && <span className="xp-float" aria-hidden="true">+{xpPerSet}</span>}
            </button>
          );
        })}
      </div>
      <p className="rope__meta">
        {done}/{rx.sets} sets · {skips} of {rx.sets * rx.reps} skips
        {!readOnly && showHint && done === 0 && <span className="hint"> · hold a dot to enter a different count</span>}
      </p>
      {editing !== null && (
        <form
          className="rep-editor"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            Set {editing + 1} skips
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              min={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn--primary">Save</button>
          <button type="button" className="btn" onClick={() => { onSetReps(editing, null); setEditing(null); }}>
            Clear
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>Cancel</button>
        </form>
      )}
    </section>
  );
}
