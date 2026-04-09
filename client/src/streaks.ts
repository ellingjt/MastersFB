import type { TeamStanding } from './types';
import { computeHoleResults, getPars } from './scoring';

export type Streak = 'hot' | 'cold' | null;

/**
 * Analyzes the last N holes of best-ball results for a team.
 * "Hot" = 3+ points in last 6 played holes
 * "Cold" = 2+ team bogeys/double bogeys in last 6 played holes
 */
export function getTeamStreak(team: TeamStanding): Streak {
  // Collect all played hole results in order
  const allResults: { points: number; isBogey: boolean }[] = [];

  for (let r = 0; r < 4; r++) {
    const hasScores = team.golfers.some(g => g.rounds[r]?.some(s => s > 0));
    if (!hasScores) continue;
    const results = computeHoleResults(team.golfers, r);
    const pars = getPars();
    for (const h of results) {
      if (h.bestScore === null) continue;
      allResults.push({
        points: h.points,
        isBogey: h.bestScore > pars[h.hole - 1],
      });
    }
  }

  // Look at last 6 played holes
  const recent = allResults.slice(-6);
  if (recent.length < 3) return null;

  const recentPoints = recent.reduce((sum, h) => sum + h.points, 0);
  const recentBogeys = recent.filter(h => h.isBogey).length;

  if (recentPoints >= 3) return 'hot';
  if (recentBogeys >= 2) return 'cold';
  return null;
}
