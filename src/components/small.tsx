// Small presentational pieces: type badge, feel picker, progress ring, tab bar.
import { useId } from 'react';
import type { Route } from '../router';
import { href } from '../router';
import type { DayType, Feel } from '../domain/types';
import { DAY_TYPE_LABEL } from '../domain/types';

export function TypeBadge({ type }: { type: DayType }) {
  return <span className={`badge badge--${type}`}>{DAY_TYPE_LABEL[type]}</span>;
}

const FEELS: { value: Feel; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'right', label: 'Just right' },
  { value: 'hard', label: 'Hard' },
];

export function FeelPicker({ value, onChange, disabled }: { value?: Feel; onChange: (f?: Feel) => void; disabled?: boolean }) {
  return (
    <div className="feel" role="radiogroup" aria-label="How did it feel?">
      <span className="feel__label">How did it feel?</span>
      <div className="feel__options">
        {FEELS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={value === f.value}
            disabled={disabled}
            className={`chip${value === f.value ? ' chip--on' : ''}`}
            onClick={() => onChange(value === f.value ? undefined : f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProgressRing({ done, total, size = 'md' }: { done: number; total: number; size?: 'md' | 'lg' }) {
  const gid = 'ring' + useId().replace(/[^\w-]/g, ''); // safe inside url(#…)
  const r = 18;
  const c = 2 * Math.PI * r;
  const frac = total ? Math.min(done / total, 1) : 0;
  return (
    <a className={`ring ring--${size}`} href={href('progress')} aria-label={`${done} of ${total} sessions done. Open progress`}>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--violet)" />
            <stop offset="1" stopColor="var(--cyan)" />
          </linearGradient>
        </defs>
        <circle cx="22" cy="22" r={r} className="ring__track" />
        <circle
          cx="22" cy="22" r={r}
          stroke={`url(#${gid})`}
          className="ring__fill"
          strokeDasharray={`${c * frac} ${c}`}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="ring__text">{size === 'lg' ? `${Math.round(frac * 100)}%` : `${done}/${total}`}</span>
    </a>
  );
}

const TABS: { name: Route['name']; label: string; icon: string }[] = [
  { name: 'today', label: 'Today', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2' },
  { name: 'plan', label: 'Plan', icon: 'M4 6h16M4 12h16M4 18h10' },
  { name: 'progress', label: 'Progress', icon: 'M5 20V11M12 20V5M19 20v-6' },
  { name: 'settings', label: 'Settings', icon: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4' },
];

export function TabBar({ current }: { current: Route['name'] }) {
  const active = current === 'day' ? 'plan' : current;
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => (
        <a key={t.name} href={href(t.name)} className={`tab${active === t.name ? ' tab--on' : ''}`} aria-current={active === t.name ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path d={t.icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}
