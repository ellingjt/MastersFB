import type { TeamStanding } from './types';
import { computeHoleResults, getPars } from './scoring';

export type Streak = 'hot' | 'cold' | null;

/**
 * Analyzes the team's recent best-ball results for streaks.
 *
 * "Hot" = 3+ points scored with NO team bogeys in the streak
 *   (look backwards from the most recent hole until a bogey breaks it)
 *
 * "Cold" = 2+ team bogeys with NO points scored in the streak
 *   (look backwards from the most recent hole until a point breaks it)
 */
export function getTeamStreak(team: TeamStanding): Streak {
  const allResults: { points: number; isBogey: boolean }[] = [];
  const pars = getPars();

  for (let r = 0; r < 4; r++) {
    const hasScores = team.golfers.some(g => g.rounds[r]?.some(s => s > 0));
    if (!hasScores) continue;
    const results = computeHoleResults(team.golfers, r);
    for (const h of results) {
      if (h.bestScore === null) continue;
      allResults.push({
        points: h.points,
        isBogey: h.bestScore > pars[h.hole - 1],
      });
    }
  }

  if (allResults.length < 3) return null;

  // Walk backwards from most recent hole to find the current streak
  let hotPoints = 0;
  let coldBogeys = 0;

  // Check for hot streak: count consecutive points from the end with no bogeys
  for (let i = allResults.length - 1; i >= 0; i--) {
    const h = allResults[i];
    if (h.isBogey) break; // bogey ends the hot streak
    if (h.points > 0) hotPoints += h.points;
  }

  if (hotPoints >= 3) return 'hot';

  // Check for cold streak: count consecutive bogeys from the end with no points
  for (let i = allResults.length - 1; i >= 0; i--) {
    const h = allResults[i];
    if (h.points > 0) break; // a point ends the cold streak
    if (h.isBogey) coldBogeys++;
  }

  if (coldBogeys >= 2) return 'cold';

  return null;
}
