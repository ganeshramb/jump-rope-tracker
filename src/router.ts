import { useEffect, useState } from 'react';

export type Route =
  | { name: 'today' | 'plan' | 'progress' | 'settings' }
  | { name: 'day'; date: string };

export function parseHash(hash: string): Route {
  const [, name, arg] = hash.replace(/^#/, '').split('/');
  if (name === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(arg ?? '')) return { name: 'day', date: arg };
  if (name === 'plan' || name === 'progress' || name === 'settings') return { name };
  return { name: 'today' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const href = (path: string) => `#/${path}`;
