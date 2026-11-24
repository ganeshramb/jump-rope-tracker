import { get, set } from 'idb-keyval';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { todayLocal } from '../domain/dates';
import { emptyLog } from '../domain/log';
import { logKey } from '../domain/plan';
import type { AppData, AppDataV1, DayLog, Plan } from '../domain/types';
import { migrate } from './migrate';
import seedPlan from './seed-plan.json';

const KEY = 'appData';

export function freshData(): AppData {
  return { schemaVersion: 2, activePlanId: seedPlan.id, plans: [seedPlan as Plan], logs: {}, celebrated: [] };
}

type Store = {
  data: AppData;
  /** Apply a change; it's saved to IndexedDB immediately. */
  update: (fn: (d: AppData) => AppData) => void;
  /** Change one day's log (created on first use). */
  updateLog: (planId: string, date: string, fn: (log: DayLog) => DayLog) => void;
  replaceAll: (d: AppData) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string>();
  const loaded = useRef(false);

  useEffect(() => {
    get<AppData | AppDataV1>(KEY)
      .then((saved) => setData(saved ? migrate(saved) : freshData()))
      .catch((e) => {
        setError(String(e));
        setData(freshData()); // still usable, just not saved
      });
    // Ask the browser not to evict our data under storage pressure (best effort).
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!data) return;
    if (!loaded.current) {
      loaded.current = true; // don't write back what we just read
      return;
    }
    set(KEY, data).catch((e) => setError(`Couldn't save: ${e}`));
  }, [data]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => (d ? fn(d) : d)), []);
  const updateLog = useCallback(
    (planId: string, date: string, fn: (log: DayLog) => DayLog) =>
      update((d) => {
        const k = logKey(planId, date);
        return { ...d, logs: { ...d.logs, [k]: fn(d.logs[k] ?? emptyLog(planId, date)) } };
      }),
    [update],
  );
  const replaceAll = useCallback((d: AppData) => setData(d), []);

  if (!data) return null; // IndexedDB answers in a few ms; no spinner needed
  return (
    <Ctx.Provider value={{ data, update, updateLog, replaceAll }}>
      {error && <div className="banner banner--error" role="alert">{error}</div>}
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** Local "today", refreshed when the app comes back to the foreground and every minute (catches midnight). */
export function useToday(): string {
  const [today, setToday] = useState(todayLocal);
  useEffect(() => {
    const refresh = () => setToday(todayLocal());
    document.addEventListener('visibilitychange', refresh);
    const t = setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(t);
    };
  }, []);
  return today;
}
