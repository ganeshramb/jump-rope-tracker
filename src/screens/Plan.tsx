import { useEffect, useRef } from 'react';
import { TypeBadge } from '../components/small';
import { useStore, useToday } from '../data/store';
import { dayMonth, weekdayShort } from '../domain/dates';
import { activePlan, dayStatus, effectiveThick, getLog, groupByWeek, type DayStatus } from '../domain/plan';
import { formatRx } from '../domain/prescription';
import { isPlanned } from '../domain/types';
import { href } from '../router';

const STATUS: Record<DayStatus, { icon: string; label: string }> = {
  done: { icon: '✓', label: 'Done' },
  partial: { icon: '◐', label: 'Partly done' },
  missed: { icon: '✕', label: 'Missed' },
  today: { icon: '●', label: 'Today' },
  upcoming: { icon: '', label: 'Upcoming' },
  off: { icon: '', label: '' },
};

export function PlanScreen() {
  const { data } = useStore();
  const today = useToday();
  const plan = activePlan(data);
  const todayRow = useRef<HTMLAnchorElement>(null);

  // Braces matter: newer browsers return a Promise from scrollIntoView, and React would call it as a cleanup.
  useEffect(() => {
    todayRow.current?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <main className="screen">
      <header className="screen__head">
        <div>
          <h1 className="screen__title">Plan</h1>
          <p className="screen__sub">{plan.name}</p>
        </div>
      </header>

      {groupByWeek(plan).map(({ week, days }) => {
        const planned = days.filter((d) => isPlanned(d.type));
        const done = planned.filter((d) => getLog(data, plan.id, d.date)?.done).length;
        return (
          <section key={week} className="week">
            <h2 className="week__title">
              Week {week}
              <span className="week__range">{dayMonth(days[0].date)} – {dayMonth(days[days.length - 1].date)}</span>
              <span className="week__count">{done}/{planned.length}</span>
            </h2>
            <ul className="rows">
              {days.map((d) => {
                const log = getLog(data, plan.id, d.date);
                const status = dayStatus(d, log, today);
                const rx = [formatRx(d.light), formatRx(effectiveThick(d, log))].filter(Boolean).join(' · ');
                return (
                  <li key={d.date}>
                    <a
                      ref={d.date === today ? todayRow : undefined}
                      href={href(`day/${d.date}`)}
                      className={`row row--${status}${d.date === today ? ' row--today' : ''}`}
                    >
                      <span className="row__date">
                        <b>{weekdayShort(d.date)}</b> {dayMonth(d.date)}
                      </span>
                      <TypeBadge type={d.type} />
                      <span className="row__rx">{rx}</span>
                      <span className={`row__status status--${status}`} aria-label={STATUS[status].label} title={STATUS[status].label}>
                        {STATUS[status].icon}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
