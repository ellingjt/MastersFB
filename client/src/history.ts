import type { YearConfig } from './api';

export interface Trophy {
  year: number;
  type: 'first' | 'last';
  note?: string;
}

export function getTrophies(owner: string, history: YearConfig['history']): Trophy[] {
  const trophies: Trophy[] = [];

  for (const h of history) {
    if (h.first === owner) {
      trophies.push({ year: h.year, type: 'first', note: h.firstNote });
    }
    if (h.last.includes(owner)) {
      trophies.push({ year: h.year, type: 'last' });
    }
  }

  trophies.sort((a, b) => b.year - a.year);
  return trophies;
}
