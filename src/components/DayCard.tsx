import { useEffect, useRef } from 'react';
import { useStore } from '../data/store';
import { dayXp, XP_RULES } from '../domain/game';
import { burst } from '../fx/confetti';
import { chimeSound } from '../fx/sound';
import { rxFor, setDone, setFeel, setReps, setUseAlt, setValues, toggleSet } from '../domain/log';
import { getLog } from '../domain/plan';
import { formatRx } from '../domain/prescription';
import { lastThickFeel } from '../domain/stats';
import type { Plan, PlanDay, Rope } from '../domain/types';
import { SetDots } from './SetDots';
import { FeelPicker, TypeBadge } from './small';

const ROPE_TITLE: Record<Rope, string> = { light: 'Light rope', thick: 'Thick rope' };

/** The logging UI for one day. Shared by Today and Day detail. */
export function DayCard({ plan, day, showBadge = true }: { plan: Plan; day: PlanDay; showBadge?: boolean }) {
  const { data, updateLog } = useStore();
  const readOnly = !!plan.archived;
  const log = getLog(data, plan.id, day.date);
  const change = (fn: Parameters<typeof updateLog>[2]) => updateLog(plan.id, day.date, fn);

  const ropes = (['light', 'thick'] as Rope[]).filter((r) => rxFor(day, log, r));
  const hasWork = ropes.length > 0;
  const done = !!log?.done;

  const stepUpFelt = day.altThick && lastThickFeel(data, plan, day.date) === 'easy';
  const earned = done && hasWork ? dayXp(data, plan.id, day.date) : undefined;

  // Day just completed (not on first render): burst from the done button + chime.
  const doneBtn = useRef<HTMLButtonElement>(null);
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current && hasWork) {
      burst(doneBtn.current);
      chimeSound();
      navigator.vibrate?.([20, 40, 30]);
    }
    wasDone.current = done;
  }, [done, hasWork]);

  return (
    <article className={`day-card day-card--${day.type}`}>
      {showBadge && <TypeBadge type={day.type} />}

      {day.altThick && day.thick && !readOnly && (
        log?.useAlt ? (
          <div className="stepup stepup--on">
            <span>Stepped up to {formatRx(day.altThick)}</span>
            <button type="button" className="btn btn--ghost" onClick={() => change((l) => setUseAlt(day, l, false))}>
              Back to {formatRx(day.thick)}
            </button>
          </div>
        ) : (
          <div className={`stepup${stepUpFelt ? ' stepup--suggest' : ''}`}>
            <span>
              {stepUpFelt
                ? `Last thick session felt easy. Step up to ${formatRx(day.altThick)}?`
                : `Step-up option: ${formatRx(day.altThick)} thick if the last session felt easy.`}
            </span>
            <button type="button" className={`btn${stepUpFelt ? ' btn--primary' : ''}`} onClick={() => change((l) => setUseAlt(day, l, true))}>
              Step up
            </button>
          </div>
        )
      )}

      {ropes.map((rope, i) => {
        const rx = rxFor(day, log, rope)!;
        return (
          <SetDots
            key={rope + rx.sets}
            title={ROPE_TITLE[rope]}
            rx={rx}
            values={setValues(log, rope, rx)}
            readOnly={readOnly}
            showHint={i === 0}
            xpPerSet={XP_RULES.set[rope]}
            onToggle={(i) => change((l) => toggleSet(day, l, rope, i))}
            onSetReps={(i, reps) => change((l) => setReps(day, l, rope, i, reps))}
          />
        );
      })}

      {day.note && <p className="note">{day.note}</p>}

      {!readOnly && (
        <div className="day-card__actions">
          {hasWork ? (
            <button
              ref={doneBtn}
              type="button"
              className={`btn btn--block${done ? ' btn--done' : ' btn--primary'}`}
              aria-pressed={done}
              onClick={() => change((l) => setDone(l, !done))}
            >
              {done ? '✓ Done (tap to undo)' : 'Mark day done'}
            </button>
          ) : (
            <button type="button" className={`btn btn--block${done ? ' btn--done' : ''}`} aria-pressed={done} onClick={() => change((l) => setDone(l, !done))}>
              {done ? (day.type === 'walk' ? '✓ Walked' : '✓ Rested') : day.type === 'walk' ? 'I walked' : 'Mark rested'}
            </button>
          )}
          {earned && (
            <p className="earned">
              <b>+{earned.xp} XP</b>
              {earned.multiplier > 1 && <span> · streak bonus ×{earned.multiplier.toFixed(1)}</span>}
            </p>
          )}
          {hasWork && done && <FeelPicker value={log?.feel} onChange={(f) => change((l) => setFeel(l, f))} />}
        </div>
      )}
    </article>
  );
}
