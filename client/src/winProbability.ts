import type { TeamStanding } from './types';

interface TeamProjection {
  owner: string;
  currentPoints: number;
  holesPlayed: number;
  holesRemaining: number;
  rate: number;
  expectedFinal: number;
  winProbability: number;
}

/**
 * Estimate win probability for each team using Monte Carlo simulation.
 *
 * - Blended rate: team rate regresses toward field average
 * - High variance (4x) to reflect golf's streakiness
 * - Fat tails: small chance of a breakout or collapse each simulation
 * - No team is truly eliminated while holes remain
 */
export function calculateWinProbabilities(standings: TeamStanding[]): TeamProjection[] {
  // Field-wide average scoring rate
  let totalFieldPoints = 0;
  let totalFieldHoles = 0;
  for (const team of standings) {
    for (const g of team.golfers) {
      if (g.isCut) continue;
      const played = g.rounds.reduce((sum, rd) => sum + (rd?.filter(s => s > 0).length ?? 0), 0);
      totalFieldHoles += played;
    }
    totalFieldPoints += team.totalPoints;
  }
  const fieldRate = totalFieldHoles > 0 ? totalFieldPoints / totalFieldHoles : 0.1;

  const projections: TeamProjection[] = standings.map(team => {
    const activeGolfers = team.golfers.filter(g => !g.isCut);
    let totalHolesPlayed = 0;
    let totalHolesRemaining = 0;

    for (const g of activeGolfers) {
      const played = g.rounds.reduce((sum, rd) => sum + (rd?.filter(s => s > 0).length ?? 0), 0);
      totalHolesPlayed += played;
      totalHolesRemaining += 72 - played;
    }

    // Blended rate: regress toward field average
    // Lower confidence cap (50%) keeps things more open
    const teamRate = totalHolesPlayed > 0 ? team.totalPoints / totalHolesPlayed : fieldRate;
    const confidence = Math.min(totalHolesPlayed / 150, 0.5);
    const rate = teamRate * confidence + fieldRate * (1 - confidence);

    const expectedFinal = team.totalPoints + rate * totalHolesRemaining;

    return {
      owner: team.owner,
      currentPoints: team.totalPoints,
      holesPlayed: totalHolesPlayed,
      holesRemaining: totalHolesRemaining,
      rate,
      expectedFinal,
      winProbability: 0,
    };
  });

  // If no one has holes remaining, the leader wins
  const anyHolesLeft = projections.some(p => p.holesRemaining > 0);
  if (!anyHolesLeft) {
    const maxPts = Math.max(...projections.map(p => p.currentPoints));
    for (const p of projections) {
      p.winProbability = p.currentPoints === maxPts ? 1 : 0;
    }
    return projections;
  }

  // Monte Carlo simulation
  const simulations = 10000;
  const wins = new Map<string, number>();
  for (const p of projections) wins.set(p.owner, 0);

  let seed = 42;
  const random = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };
  const normalRandom = () => {
    const u1 = random();
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
  };

  for (let i = 0; i < simulations; i++) {
    let bestScore = -Infinity;
    let bestOwner = '';

    for (const p of projections) {
      const expectedRemaining = p.rate * p.holesRemaining;

      // High base variance (4x) for golf's streakiness
      let stdDev = Math.sqrt(p.holesRemaining) * Math.max(fieldRate, 0.08) * 4;

      // Fat tail: 10% chance of a breakout or collapse (2x extra variance)
      const fatTail = random();
      if (fatTail < 0.1) {
        stdDev *= 2;
      }

      const simRemaining = Math.max(0, expectedRemaining + normalRandom() * stdDev);
      const simFinal = p.currentPoints + simRemaining;

      if (simFinal > bestScore) {
        bestScore = simFinal;
        bestOwner = p.owner;
      }
    }

    wins.set(bestOwner, (wins.get(bestOwner) ?? 0) + 1);
  }

  for (const p of projections) {
    p.winProbability = (wins.get(p.owner) ?? 0) / simulations;
  }

  return projections;
}
