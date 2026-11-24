// Gamification UI: level bar, streak flame, badge medals, and the celebration overlay.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, useToday } from '../data/store';
import { activePlan, getLog } from '../domain/plan';
import { burst, shower } from '../fx/confetti';
import { fanfareSound } from '../fx/sound';
import { achievements, BADGES, gameState, levelFor, type Badge, type GameState } from '../domain/game';

const fmt = new Intl.NumberFormat('en');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useGame(): GameState {
  const { data } = useStore();
  return useMemo(() => gameState(data), [data]);
}

/** Tweens towards `target` (ease-out), continuing smoothly if the target changes mid-way. */
export function useAnimatedNumber(target: number, ms = 900): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (reducedMotion()) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min((now - start) / ms, 1);
      current.current = from + (target - from) * (1 - (1 - k) ** 3);
      setValue(current.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export function Flame({ streak }: { streak: number }) {
  const heat = Math.min(streak, 10) / 10;
  return (
    <span className={`flame${streak ? ' flame--lit' : ''}`} style={{ ['--heat' as string]: heat }} title={`${streak}-session streak`}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <defs>
          <linearGradient id="flame-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#22d3ee" />
            <stop offset="0.55" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#f0abfc" />
          </linearGradient>
        </defs>
        <path d="M12 2.5c.6 3.2 4.8 5.4 4.8 10.6a4.8 4.8 0 0 1-9.6 0c0-2.4 1.3-3.7 2.2-5.4.4 1.4 1.1 2.2 2 2.7.4-2.6-.2-5.2.6-7.9Z" fill="url(#flame-grad)" />
      </svg>
      <span className="flame__n">{streak}</span>
    </span>
  );
}

/** Today's strip: level, XP bar (animated through level-ups), streak flame. */
export function LevelBar({ streak }: { streak: number }) {
  const game = useGame();
  const xp = useAnimatedNumber(game.xp);
  const lv = levelFor(xp);
  return (
    <a className="levelbar glass" href="#/progress" aria-label={`Level ${game.level.level}, ${fmt.format(game.xp)} XP, ${streak}-session streak. Open progress`}>
      <span className="levelbar__lv"><small>LV</small>{lv.level}</span>
      <span className="levelbar__mid">
        <span className="levelbar__track"><span className="levelbar__fill" style={{ width: `${(lv.into / lv.span) * 100}%` }} /></span>
        <span className="levelbar__xp">{fmt.format(Math.round(xp))} XP · {fmt.format(Math.ceil(lv.toNext))} to LV {lv.level + 1}</span>
      </span>
      <Flame streak={streak} />
    </a>
  );
}

export function Medal({ badge, earned, size = 'md' }: { badge: Badge; earned: boolean; size?: 'md' | 'lg' }) {
  const text = /^[0-9A-Z]+$/.test(badge.icon);
  return (
    <span className={`medal medal--${size}${earned ? ' medal--on' : ''}`} aria-hidden="true">
      <span className={text ? 'medal__text' : 'medal__icon'}>{earned ? badge.icon : '🔒'}</span>
    </span>
  );
}

type Party = { title: string; sub: string; badges: Badge[]; level?: number; gold: boolean };

function describe(keys: string[], game: GameState): Party {
  const badges = BADGES.filter((b) => keys.includes(`badge:${b.id}`));
  const levels = keys.filter((k) => k.startsWith('level:')).map((k) => Number(k.slice(6)));
  const level = levels.length ? Math.max(...levels) : undefined;
  const test = keys.some((k) => k.startsWith('test:'));
  const week = keys.find((k) => k.startsWith('week:'));
  if (test) return { title: 'Test day done!', sub: 'Six weeks of work, one big finish.', badges, level, gold: true };
  if (level) return { title: 'Level up!', sub: `${fmt.format(game.xp)} XP and climbing.`, badges, level, gold: false };
  if (week) return { title: 'Perfect week!', sub: `Every session in week ${week.split(':').pop()} done.`, badges, gold: false };
  return { title: badges.length > 1 ? `${badges.length} badges unlocked` : 'Badge unlocked', sub: badges.map((b) => b.desc).join(' · '), badges, gold: false };
}

/**
 * Watches the data for achievements that haven't been celebrated yet, records them as celebrated,
 * and shows the overlay a beat after the day-complete burst (so the moments escalate).
 */
export function Celebrations() {
  const { data, update } = useStore();
  const game = useGame();
  const [party, setParty] = useState<Party>();
  const scheduled = useRef(new Set<string>());
  // Don't interrupt a workout: while today's session is partly logged, hold the party until it's done.
  const today = useToday();
  const todayLog = getLog(data, activePlan(data).id, today);
  const midSession = !todayLog?.done && [...(todayLog?.light ?? []), ...(todayLog?.thick ?? [])].some((v) => v !== null);

  useEffect(() => {
    if (midSession) return;
    const seen = new Set(data.celebrated);
    const fresh = achievements(game).filter((k) => !seen.has(k) && !scheduled.current.has(k));
    if (!fresh.length) return;
    fresh.forEach((k) => scheduled.current.add(k));
    update((d) => ({ ...d, celebrated: [...d.celebrated, ...fresh.filter((k) => !d.celebrated.includes(k))] }));
    // No cleanup on purpose: the update above re-runs this effect, which must not cancel the party.
    window.setTimeout(() => {
      const p = describe(fresh, game);
      setParty(p);
      fanfareSound();
      shower(p.gold);
    }, 700);
  }, [data.celebrated, game, update, midSession]);

  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (party) close.current?.focus();
  }, [party]);

  if (!party) return null;
  return (
    <div className={`party${party.gold ? ' party--gold' : ''}`} role="dialog" aria-modal="true" aria-labelledby="party-title" onClick={() => setParty(undefined)}>
      <div className="party__card glass" onClick={(e) => e.stopPropagation()}>
        {party.level && <div className="party__level"><small>LEVEL</small>{party.level}</div>}
        <h2 id="party-title" className="party__title">{party.title}</h2>
        <p className="party__sub">{party.sub}</p>
        {party.badges.length > 0 && (
          <ul className="party__badges">
            {party.badges.map((b) => (
              <li key={b.id}><Medal badge={b} earned size="lg" /><span>{b.name}</span></li>
            ))}
          </ul>
        )}
        <button ref={close} type="button" className="btn btn--primary btn--block" onClick={(e) => { burst(e.currentTarget); setParty(undefined); }}>
          Let’s go
        </button>
      </div>
    </div>
  );
}
