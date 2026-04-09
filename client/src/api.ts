import type { Player, DraftPicks } from './types';
import type { ShotgunState, Shotgun } from './shotguns';
import { getMockScores, getMockDraftPicks } from './mockData';

export interface YearConfig {
  year: number;
  draftPicks: DraftPicks;
  preTournamentShotguns: Shotgun[];
  history: { year: number; first: string; last: string[]; firstNote?: string }[];
}

const BASE_URL = '';

const useMock = () => new URLSearchParams(window.location.search).has('mock');

export async function fetchScores(): Promise<Player[]> {
  if (useMock()) return getMockScores();
  const res = await fetch(`${BASE_URL}/masters`);
  if (!res.ok) throw new Error(`Scores fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchDraftPicks(year: number): Promise<DraftPicks> {
  if (useMock()) return getMockDraftPicks();
  const res = await fetch(`${BASE_URL}/draftpicks/${year}`);
  if (!res.ok) throw new Error(`Draft picks fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchYearConfig(year: number): Promise<YearConfig> {
  if (useMock()) {
    return {
      year,
      draftPicks: getMockDraftPicks(),
      preTournamentShotguns: [
        { id: 'pre_danf_opening',    owner: 'Dan F', reason: 'Opening Ceremony', count: 1 },
        { id: 'pre_cory_draftdelay', owner: 'Cory',  reason: 'Draft Delay',      count: 1 },
        { id: 'pre_seth_duck2',      owner: 'Seth',  reason: 'Duck Race #2',      count: 1 },
        { id: 'pre_seth_duck3',      owner: 'Seth',  reason: 'Duck Race #3',      count: 1 },
        { id: 'pre_seth_duck5',      owner: 'Seth',  reason: 'Duck Race #5',      count: 1 },
        { id: 'pre_seth_duck6',      owner: 'Seth',  reason: 'Duck Race #6',      count: 1 },
        { id: 'pre_bill_duck7',      owner: 'Bill',  reason: 'Duck Race #7',      count: 1 },
        { id: 'pre_eric_duck1',      owner: 'Eric',  reason: 'Duck Race #1',      count: 1 },
        { id: 'pre_danr_duck4',      owner: 'Dan R', reason: 'Duck Race #4',      count: 1 },
        { id: 'pre_danr_duck8',      owner: 'Dan R', reason: 'Duck Race #8',      count: 1 },
        { id: 'pre_danr_duck9',      owner: 'Dan R', reason: 'Duck Race #9',      count: 1 },
      ],
      history: [
        { year: 2025, first: 'Bill',  last: ['Seth'] },
        { year: 2024, first: 'Dan R', last: ['Rich'] },
        { year: 2023, first: 'Bill',  last: ['Cory'] },
        { year: 2022, first: 'Dan F', last: ['Dan R'] },
        { year: 2021, first: 'Rich',  last: ['Cory'] },
        { year: 2020, first: 'Eric',  last: [] },
        { year: 2019, first: 'Josh',  last: ['Dan R'] },
        { year: 2018, first: 'Seth',  last: ['Dan R', 'Cory'] },
        { year: 2017, first: 'Dan F', last: ['Seth'] },
        { year: 2016, first: 'Rich',  last: [] },
        { year: 2015, first: 'Dan R', last: [], firstNote: 'Late addition — got to select a duplicate player from each round' },
      ],
    };
  }
  const res = await fetch(`${BASE_URL}/config/${year}`);
  if (!res.ok) throw new Error(`Config fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchShotgunState(year: number): Promise<ShotgunState> {
  if (useMock()) return { completedIds: [], titsAssignedTo: '' };
  const res = await fetch(`${BASE_URL}/shotguns/${year}`);
  if (!res.ok) throw new Error(`Shotgun state fetch failed: ${res.status}`);
  return res.json();
}

export async function toggleShotgunComplete(year: number, id: string, completed: boolean): Promise<{ completedIds: string[] }> {
  const res = await fetch(`${BASE_URL}/shotguns/${year}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, completed }),
  });
  if (!res.ok) throw new Error('Failed to toggle shotgun');
  return res.json();
}

export async function assignTitsShotgun(year: number, assignedTo: string): Promise<{ titsAssignedTo: string }> {
  const res = await fetch(`${BASE_URL}/shotguns/${year}/tits-assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignedTo }),
  });
  if (!res.ok) throw new Error('Failed to assign tits shotgun');
  return res.json();
}
