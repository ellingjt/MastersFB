import type { Player, DraftPicks } from './types';

// Augusta National pars for reference
// Hole: 1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18
// Par:  4  5  4  3  4  3  4  5  4  4  4  3  5  4  5  3  4  4

function randomScore(par: number): number {
  // Weighted: ~60% par, ~20% bogey, ~15% birdie, ~4% double, ~1% eagle
  const r = Math.random();
  if (r < 0.01 && par >= 4) return par - 2; // eagle
  if (r < 0.16) return par - 1;              // birdie
  if (r < 0.76) return par;                  // par
  if (r < 0.96) return par + 1;              // bogey
  return par + 2;                             // double bogey
}

const PARS = [4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4];

function generateRound(holesPlayed: number = 18): string {
  return PARS.map((par, i) => (i < holesPlayed ? randomScore(par).toString() : '0')).join('|');
}

// Seed the RNG so mock data is stable within a page load but varies between reloads
const MOCK_DRAFT_PICKS: DraftPicks = {
  'Dan F': ['Scottie Scheffler', 'Akshay Bhatia', 'Si Woo Kim', 'Harris English'],
  'Josh': ['Bryson DeChambeau', 'Chris Gotterup', 'Corey Conners', 'Daniel Berger'],
  'Rich': ['Xander Schauffele', 'Sepp Straka', 'Tyrrell Hatton', 'Cameron Smith'],
  'Matt': ['Jon Rahm', 'Patrick Reed', 'Viktor Hovland', 'Sungjae Im'],
  'Dan S': ['Rory McIlroy', 'Russell Henley', 'Patrick Cantlay', 'Maverick McNealy'],
  'Cory': ['Tommy Fleetwood', 'Collin Morikawa', 'Justin Thomas', 'Sam Burns'],
  'Seth': ['Ludvig Aberg', 'Min Woo Lee', 'Jordan Spieth', 'Jacob Bridgeman'],
  'Bill': ['Cameron Young', 'Hideki Matsuyama', 'Nicolai Hojgaard', 'J.J. Spaun'],
  'Eric': ['Matt Fitzpatrick', 'Brooks Koepka', 'Shane Lowry', 'Jason Day'],
  'Dan R': ['Justin Rose', 'Robert MacIntyre', 'Jake Knapp', 'Adam Scott'],
};

let _cachedPlayers: Player[] | null = null;

export function getMockScores(): Player[] {
  // Cache so scores don't re-randomize on every React Query refetch
  if (_cachedPlayers) return _cachedPlayers;

  const allGolfers = Object.values(MOCK_DRAFT_PICKS).flat();

  const EMPTY_ROUND = '0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0';

  // Simulate mid-round-3: R1+R2 complete for everyone.
  // ~6 golfers got cut (R1+R2 done, no R3). Rest are mid-R3, a couple haven't teed off for R3.
  const cutGolfers = new Set([
    'Harris English', 'Daniel Berger', 'Cameron Smith',
    'Maverick McNealy', 'Jacob Bridgeman', 'J.J. Spaun',
  ]);
  const teeTimes = ['01:06 PM', '01:18 PM', '01:30 PM'];
  let lateIdx = 0;

  _cachedPlayers = allGolfers.map((name) => {
    const isCut = cutGolfers.has(name);

    if (isCut) {
      return {
        fullName: name,
        round1: generateRound(18),
        round2: generateRound(18),
        round3: EMPTY_ROUND,
        round4: EMPTY_ROUND,
        teeTime: '',
        toPar: `+${Math.floor(Math.random() * 5) + 5}`,
        status: 'CUT',
      };
    }

    // ~4 golfers haven't teed off for R3 yet
    const hasStartedR3 = lateIdx++ < allGolfers.length - cutGolfers.size - 4;
    return {
      fullName: name,
      round1: generateRound(18),
      round2: generateRound(18),
      round3: hasStartedR3 ? generateRound(10) : EMPTY_ROUND,
      round4: EMPTY_ROUND,
      teeTime: hasStartedR3 ? '' : teeTimes[lateIdx % teeTimes.length],
      toPar: `${Math.floor(Math.random() * 10) - 5}`,
      status: 'A',
    };
  });

  return _cachedPlayers;
}

export function getMockDraftPicks(): DraftPicks {
  return MOCK_DRAFT_PICKS;
}
