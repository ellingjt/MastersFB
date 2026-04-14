import type { YearConfig } from './api';

export interface Trophy {
  year: number;
  type: 'first' | 'co-first' | 'last';
  note?: string;
}

export function getTrophies(owner: string, history: YearConfig['history']): Trophy[] {
  const trophies: Trophy[] = [];

  for (const h of history) {
    const firsts = Array.isArray(h.first) ? h.first : [h.first];
    if (firsts.includes(owner)) {
      const type = firsts.length > 1 ? 'co-first' : 'first';
      trophies.push({ year: h.year, type, note: h.firstNote });
    }
    if (h.last.includes(owner)) {
      trophies.push({ year: h.year, type: 'last' });
    }
  }

  trophies.sort((a, b) => b.year - a.year);
  return trophies;
}
