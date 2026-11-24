import { useState } from 'react';
import { Flame, Medal, useAnimatedNumber, useGame } from '../components/game';
import { ProgressRing } from '../components/small';
import { useStore, useToday } from '../data/store';
import { longDate, parseISO } from '../domain/dates';
import { BADGES, dayXp, streakMultiplier } from '../domain/game';
import { rxFor, skipsIn } from '../domain/log';
import { activePlan, getLog, groupByWeek } from '../domain/plan';
import { planStats } from '../domain/stats';
import type { AppData, Plan, PlanDay } from '../domain/types';
import { DAY_TYPE_LABEL } from '../domain/types';
import { href } from '../router';

const fmt = new Intl.NumberFormat('en');

/** Prescribed vs done skips for one day (uses the step-up if it was taken). */
function daySkips(data: AppData, plan: Plan, day: PlanDay) {
  const log = getLog(data, plan.id, day.date);
  const planned = (['light', 'thick'] as const).reduce((s, r) => {
    const rx = rxFor(day, log, r);
    return s + (rx ? rx.sets * rx.reps : 0);
  }, 0);
  return { planned, done: skipsIn(log, 'light') + skipsIn(log, 'thick'), isDone: !!log?.done };
}

export function Progress() {
  const { data } = useStore();
  const today = useToday();
  const plan = activePlan(data);
  const s = planStats(data, plan, today);
  const game = useGame();
  const xp = useAnimatedNumber(game.xp);
  const [sel, setSel] = useState<{ date: string; src: 'heat' | 'bars' }>();
  const selected = sel?.date;
  const pick = (date: string, src: 'heat' | 'bars') => setSel(sel?.date === date && sel.src === src ? undefined : { date, src });

  const lv = game.level;
  const todayDone = getLog(data, plan.id, today)?.done;
  const nextMult = streakMultiplier(s.streak);

  const readout = (date: string) => {
    const day = plan.days.find((d) => d.date === date);
    if (!day) return null;
    const k = daySkips(data, plan, day);
    const xpDay = dayXp(data, plan.id, date);
    return (
      <p className="readout" role="status">
        <b>{longDate(date)}</b> · {DAY_TYPE_LABEL[day.type]}
        {k.planned > 0 && <> · {fmt.format(k.done)} of {fmt.format(k.planned)} skips</>}
        {xpDay && <> · +{xpDay.xp} XP</>}
        {' '}<a href={href(`day/${date}`)}>Open →</a>
      </p>
    );
  };

  const sessions = plan.days.filter((d) => d.light || d.thick);
  const maxSkips = Math.max(1, ...sessions.map((d) => { const k = daySkips(data, plan, d); return Math.max(k.planned, k.done); }));
  const gridStep = maxSkips > 300 ? 100 : 50;
  const gridLines = Array.from({ length: Math.floor(maxSkips / gridStep) }, (_, i) => (i + 1) * gridStep);

  return (
    <main className="screen">
      <header className="screen__head">
        <div>
          <h1 className="screen__title">Progress</h1>
          <p className="screen__sub">{plan.name}</p>
        </div>
      </header>

      <section className="hero glass" aria-label="Sessions done">
        <div>
          <p className="hero__label">Sessions done</p>
          <p className="hero__value">
            {s.done}<span className="hero__of"> / {s.planned}</span>
          </p>
          {(s.bonus > 0 || s.walks > 0) && (
            <p className="hero__extra">
              {[s.bonus > 0 && `+${s.bonus} bonus`, s.walks > 0 && `${s.walks} walk${s.walks > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <ProgressRing done={s.done} total={s.planned} size="lg" />
      </section>

      <section className="level-card glass" aria-label="Level">
        <div className="level-card__medal" style={{ ['--p' as string]: lv.into / lv.span }}>
          <small>LEVEL</small>
          <b>{lv.level}</b>
        </div>
        <div className="level-card__body">
          <p className="level-card__xp">{fmt.format(Math.round(xp))} <small>XP</small></p>
          <span className="levelbar__track"><span className="levelbar__fill" style={{ width: `${(lv.into / lv.span) * 100}%` }} /></span>
          <p className="hint">{fmt.format(Math.ceil(lv.toNext))} XP to level {lv.level + 1}</p>
          <p className="level-card__mult">
            {todayDone ? 'Streak bonus' : 'Next session'}: <b>×{nextMult.toFixed(1)}</b>
          </p>
        </div>
      </section>

      <section className="tiles">
        <div className="tile glass">
          <p className="tile__label">Current streak</p>
          <p className="tile__value tile__value--flame"><Flame streak={s.streak} /></p>
          <p className="tile__sub">best {game.bestStreak}</p>
        </div>
        <div className={`tile glass${s.daysToTest === 0 ? ' tile--gold' : ''}`}>
          <p className="tile__label">Test day</p>
          <p className="tile__value">{s.daysToTest === undefined ? '—' : s.daysToTest === 0 ? 'Today' : s.daysToTest}</p>
          <p className="tile__sub">{s.daysToTest ? `day${s.daysToTest === 1 ? '' : 's'} to go` : s.daysToTest === 0 ? 'go for it' : 'done'}</p>
        </div>
        <div className="tile glass">
          <p className="tile__label">Light rope skips</p>
          <p className="tile__value">{fmt.format(s.lightSkips)}</p>
        </div>
        <div className="tile glass">
          <p className="tile__label">Thick rope skips</p>
          <p className="tile__value">{fmt.format(s.thickSkips)}</p>
        </div>
      </section>

      <section className="glass panel">
        <h2 className="section-title">{plan.days.length} days</h2>
        <div className="heat" role="grid" aria-label="Calendar of the plan, one row per week">
          <div className="heat__row heat__row--head" role="row">
            <span />
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} role="columnheader" className="heat__dow">{d}</span>)}
            <span />
          </div>
          {groupByWeek(plan).map(({ week, days }) => {
            const wk = s.weeks.find((w) => w.week === week);
            const slots: (PlanDay | undefined)[] = Array(7).fill(undefined);
            for (const d of days) slots[(parseISO(d.date).getDay() + 6) % 7] = d;
            return (
              <div key={week} className="heat__row" role="row">
                <span className="heat__week">W{week}</span>
                {slots.map((d, i) => {
                  if (!d) return <span key={i} className="heat__cell heat__cell--none" role="gridcell" />;
                  const k = daySkips(data, plan, d);
                  const work = k.planned > 0;
                  const lvl = !work ? 0 : k.isDone ? 4 : k.done === 0 ? 0 : Math.max(1, Math.min(3, Math.ceil((k.done / k.planned) * 4) - 1));
                  const cls = [
                    'heat__cell',
                    work ? `heat__cell--l${lvl}` : `heat__cell--off${k.isDone ? ' heat__cell--walked' : ''}`,
                    d.type === 'test' && 'heat__cell--test',
                    d.type === 'optional' && 'heat__cell--optional',
                    d.date === today && 'heat__cell--today',
                    d.date > today && 'heat__cell--future',
                    selected === d.date && 'heat__cell--sel',
                  ].filter(Boolean).join(' ');
                  return (
                    <button
                      key={i}
                      type="button"
                      role="gridcell"
                      className={cls}
                      aria-label={`${longDate(d.date)}, ${DAY_TYPE_LABEL[d.type]}${work ? `, ${k.done} of ${k.planned} skips` : ''}${k.isDone ? ', done' : ''}`}
                      aria-pressed={selected === d.date}
                      onClick={() => pick(d.date, 'heat')}
                    />
                  );
                })}
                <span className="heat__count">{wk ? `${wk.done}/${wk.planned}` : ''}</span>
              </div>
            );
          })}
        </div>
        <div className="legend" aria-hidden="true">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`heat__cell heat__cell--l${l}`} />)}
          <span>Done</span>
          <i className="heat__cell heat__cell--off" /><span>Rest / walk</span>
          <i className="heat__cell heat__cell--l0 heat__cell--test" /><span>Test</span>
        </div>
        {sel?.src === 'heat' && readout(sel.date)}
      </section>

      <section className="glass panel">
        <h2 className="section-title">Skips per session</h2>
        <div className="legend" aria-hidden="true">
          <i className="swatch swatch--done" /><span>Done</span>
          <i className="swatch swatch--planned" /><span>Planned</span>
        </div>
        <div className="bars" role="list" aria-label="Skips per session, done versus planned">
          {gridLines.map((g) => (
            <span key={g} className="bars__grid" style={{ bottom: `${(g / maxSkips) * 100}%` }}><span>{g}</span></span>
          ))}
          {sessions.map((d) => {
            const k = daySkips(data, plan, d);
            return (
              <button
                key={d.date}
                type="button"
                role="listitem"
                className={`bar${selected === d.date ? ' bar--sel' : ''}${d.date === today ? ' bar--today' : ''}${d.type === 'test' ? ' bar--test' : ''}`}
                aria-label={`${longDate(d.date)}: ${k.done} of ${k.planned} skips`}
                onClick={() => pick(d.date, 'bars')}
              >
                <span className="bar__planned" style={{ height: `${(k.planned / maxSkips) * 100}%` }} />
                {k.done > 0 && <span className="bar__done" style={{ height: `${(k.done / maxSkips) * 100}%` }} />}
              </button>
            );
          })}
        </div>
        <div className="bars__axis" aria-hidden="true">
          <span>{longDate(sessions[0]?.date ?? plan.startDate)}</span>
          <span>{longDate(sessions.at(-1)?.date ?? plan.startDate)}</span>
        </div>
        {sel?.src === 'bars' && readout(sel.date)}
      </section>

      <section className="glass panel">
        <h2 className="section-title">Badges <span className="section-count">{game.earned.size}/{BADGES.length}</span></h2>
        <ul className="shelf">
          {BADGES.map((b) => {
            const on = game.earned.has(b.id);
            return (
              <li key={b.id} className={`shelf__item${on ? ' shelf__item--on' : ''}`}>
                <Medal badge={b} earned={on} />
                <b>{b.name}</b>
                <span>{b.desc}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
