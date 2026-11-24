import { DayCard } from '../components/DayCard';
import { LevelBar } from '../components/game';
import { ProgressRing } from '../components/small';
import { useStore, useToday } from '../data/store';
import { longDate } from '../domain/dates';
import { activePlan, findDay, nextPlannedDay, planEnd, planPhase, weekOf } from '../domain/plan';
import { formatRx } from '../domain/prescription';
import { missedDays, planStats } from '../domain/stats';
import { isPlanned } from '../domain/types';
import { href } from '../router';

export function Today() {
  const { data } = useStore();
  const today = useToday();
  const plan = activePlan(data);
  const phase = planPhase(plan, today);
  const stats = planStats(data, plan, today);
  const day = findDay(plan, today);
  const missed = missedDays(data, plan, today);
  const next = nextPlannedDay(plan, today);

  return (
    <main className="screen">
      <header className="screen__head">
        <div>
          <h1 className="screen__title">{longDate(today)}</h1>
          <p className="screen__sub">
            {phase === 'active' ? `Week ${weekOf(plan, today)} · ${plan.name}` : plan.name}
          </p>
        </div>
        <ProgressRing done={stats.done} total={stats.planned} />
      </header>

      <LevelBar streak={stats.streak} />

      {phase === 'before' && (
        <div className="empty">
          <h2>Your plan starts {longDate(plan.startDate)}</h2>
          <p><a href={href(`day/${plan.startDate}`)}>Preview day 1</a></p>
        </div>
      )}

      {phase === 'after' && (
        <div className="empty">
          <h2>Plan complete 🎉</h2>
          <p>{stats.done} of {stats.planned} sessions done{stats.bonus ? ` (+${stats.bonus} bonus)` : ''}, ending {longDate(planEnd(plan))}.</p>
          <p><a className="btn btn--primary" href={href('settings')}>Start a new plan</a></p>
        </div>
      )}

      {phase === 'active' && missed.length > 0 && (
        <a className="banner" href={href(`day/${missed[missed.length - 1].date}`)}>
          {missed.length === 1 ? '1 missed day' : `${missed.length} missed days`}: did you train? Log it →
        </a>
      )}

      {phase === 'active' && day && (
        <>
          {day.type === 'test' && stats.daysToTest === 0 && <p className="test-callout">Test day. Give it everything.</p>}
          <DayCard plan={plan} day={day} />
          {!isPlanned(day.type) && next && (
            <p className="next">
              Next session: <a href={href(`day/${next.date}`)}>{longDate(next.date)}</a>
              {' · '}{[next.light, next.thick].filter(Boolean).map((r) => formatRx(r)).join(' + ')}
            </p>
          )}
        </>
      )}

      {phase === 'active' && !day && <div className="empty"><h2>Nothing planned today</h2></div>}
    </main>
  );
}
