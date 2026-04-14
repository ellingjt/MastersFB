import type { Player, DraftPicks, TeamStanding, GolferScore, HoleResult } from './types';

// Augusta National pars
const PARS = [4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4];

export function getPars(): number[] {
  return PARS;
}

function parseScores(pipeStr: string): number[] {
  if (!pipeStr) return [];
  return pipeStr.split('|').map(Number);
}

function buildGolferScore(player: Player): GolferScore {
  const rounds = [
    parseScores(player.round1),
    parseScores(player.round2),
    parseScores(player.round3),
    parseScores(player.round4),
  ];

  let totalStrokes = 0;
  let holesPlayed = 0;
  for (const round of rounds) {
    for (const score of round) {
      if (score > 0) {
        totalStrokes += score;
        holesPlayed++;
      }
    }
  }

  // Use masters.com official status: "C" = cut
  const isCut = player.status === 'C';

  return {
    name: player.fullName,
    rounds,
    totalStrokes,
    holesPlayed,
    isCut,
    teeTime: player.teeTime,
  };
}

export function computeHoleResults(golfers: GolferScore[], roundIndex: number): HoleResult[] {
  return PARS.map((par, holeIndex) => {
    const scores = golfers
      .map(g => ({ name: g.name, score: g.rounds[roundIndex]?.[holeIndex] ?? 0 }))
      .filter(s => s.score > 0);

    if (scores.length === 0) {
      return { hole: holeIndex + 1, par, bestScore: null, points: 0, contributor: null };
    }

    const best = scores.reduce((a, b) => (a.score <= b.score ? a : b));
    const points = best.score < par ? par - best.score : 0;

    return {
      hole: holeIndex + 1,
      par,
      bestScore: best.score,
      points,
      contributor: best.name,
    };
  });
}

export function calculateStandings(
  players: Player[],
  draftPicks: DraftPicks,
): TeamStanding[] {
  const playerMap = new Map<string, Player>();
  for (const p of players) {
    playerMap.set(p.fullName.toLowerCase(), p);
  }

  const standings: TeamStanding[] = [];

  for (const [owner, golferNames] of Object.entries(draftPicks)) {
    const golfers: GolferScore[] = golferNames.map(name => {
      const player = playerMap.get(name.toLowerCase());
      if (!player) {
        return { name, rounds: [[], [], [], []], totalStrokes: 0, holesPlayed: 0, isCut: false, teeTime: '' };
      }
      return buildGolferScore(player);
    });

    const roundPoints: [number, number, number, number] = [0, 0, 0, 0];
    for (let r = 0; r < 4; r++) {
      const holeResults = computeHoleResults(golfers, r);
      roundPoints[r] = holeResults.reduce((sum, h) => sum + h.points, 0);
    }
    const totalPoints = roundPoints.reduce((a, b) => a + b, 0);

    standings.push({ owner, golfers, totalPoints, roundPoints });
  }

  standings.sort((a, b) => b.totalPoints - a.totalPoints);
  return standings;
}

export interface GolferRanking {
  name: string;
  owner: string;
  points: number;
  birdies: number;
  eagles: number;
}

export function rankGolfers(
  players: Player[],
  draftPicks: DraftPicks,
): GolferRanking[] {
  const playerMap = new Map<string, Player>();
  for (const p of players) {
    playerMap.set(p.fullName.toLowerCase(), p);
  }

  const rankings: GolferRanking[] = [];

  for (const [owner, golferNames] of Object.entries(draftPicks)) {
    for (const name of golferNames) {
      const player = playerMap.get(name.toLowerCase());
      let points = 0;
      let birdies = 0;
      let eagles = 0;

      if (player) {
        const rounds = [player.round1, player.round2, player.round3, player.round4];
        for (const roundStr of rounds) {
          const scores = parseScores(roundStr);
          scores.forEach((score, hIdx) => {
            if (score > 0 && score < PARS[hIdx]) {
              const diff = PARS[hIdx] - score;
              points += diff;
              if (diff === 1) birdies++;
              else eagles++;
            }
          });
        }
      }

      rankings.push({ name, owner, points, birdies, eagles });
    }
  }

  return rankings;
}

/**
 * Compute a "recency" value for each birdie/eagle event.
 *
 * Each golfer's total holes played across all rounds gives us a global timeline position.
 * An event's recency = totalHolesPlayed - holesPlayedUpToThisEvent.
 * Lower recency = happened more recently.
 */
function getGolferTotalHolesPlayed(player: Player): number {
  let total = 0;
  for (const roundStr of [player.round1, player.round2, player.round3, player.round4]) {
    const scores = parseScores(roundStr);
    total += scores.filter(s => s > 0).length;
  }
  return total;
}

export function detectBirdiesAndEagles(
  players: Player[],
  draftPicks: DraftPicks,
): { owner: string; golfer: string; hole: number; round: number; score: number; par: number; label: string; recency: number; apiOrder: number; totalPlayed: number }[] {
  const playerMap = new Map<string, { player: Player; apiIndex: number }>();
  players.forEach((p, i) => {
    playerMap.set(p.fullName.toLowerCase(), { player: p, apiIndex: i });
  });

  const events: { owner: string; golfer: string; hole: number; round: number; score: number; par: number; label: string; recency: number; apiOrder: number; totalPlayed: number }[] = [];

  for (const [owner, golferNames] of Object.entries(draftPicks)) {
    for (const name of golferNames) {
      const entry = playerMap.get(name.toLowerCase());
      if (!entry) continue;
      const { player, apiIndex } = entry;
      const rounds = [player.round1, player.round2, player.round3, player.round4];
      const totalHolesPlayed = getGolferTotalHolesPlayed(player);

      rounds.forEach((roundStr, rIdx) => {
        const scores = parseScores(roundStr);
        scores.forEach((score, hIdx) => {
          if (score > 0 && score < PARS[hIdx]) {
            const diff = PARS[hIdx] - score;
            const label = diff === 1 ? 'Birdie' : diff === 2 ? 'Eagle' : 'Albatross';
            const eventGlobal = rIdx * 18 + (hIdx + 1);
            const holesAgo = totalHolesPlayed - eventGlobal;
            events.push({ owner, golfer: name, hole: hIdx + 1, round: rIdx + 1, score, par: PARS[hIdx], label, recency: holesAgo, apiOrder: apiIndex, totalPlayed: totalHolesPlayed });
          }
        });
      });
    }
  }

  // Sort: highest round first, then recency within round (lowest = most recent),
  // then API order for ties, then eagles before birdies
  events.sort((a, b) => b.round - a.round || a.recency - b.recency || a.apiOrder - b.apiOrder || (b.par - b.score) - (a.par - a.score));
  return events;
}
