import type { TeamStanding } from './types';
import { computeHoleResults, getPars } from './scoring';

export type Streak = 'hot' | 'cold' | null;

/**
 * Build a team timeline: each golfer's holes are interleaved by
 * how recently they were completed. Then check best-ball results
 * in that order for hot/cold streaks.
 *
 * Hot: 3+ points in the last 4 best-ball holes (by team timeline), no bogeys.
 * Cold: 0 points in the last 6 best-ball holes (by team timeline).
 */
export function getTeamStreak(team: TeamStanding): Streak {
  const pars = getPars();
  const nonCut = team.golfers.filter(g => !g.isCut);

  // Build a timeline of (golfer, round, hole) ordered by when each was completed.
  // A golfer through N holes completed them in order: hole 1 first, hole N last.
  // Across golfers, we interleave by "team holes remaining after this event":
  //   teamHolesAfter = sum of (each golfer's played - their position at that point)
  // Simpler: assign each hole a "team sequence number".
  // The last hole completed by ANY golfer = most recent.
  // Walk each golfer's holes and assign a global sequence based on
  // how many other golfer-holes were completed after it.

  // For each golfer, compute their holes played per round
  interface GolferHole {
    golferIdx: number;
    round: number;
    hole: number; // 1-indexed
    // How many holes this golfer played AFTER this one (including other rounds)
    golferHolesAfter: number;
  }

  const allGolferHoles: GolferHole[] = [];
  for (let gi = 0; gi < nonCut.length; gi++) {
    const g = nonCut[gi];
    let totalPlayed = 0;
    for (let r = 0; r < 4; r++) {
      totalPlayed += g.rounds[r]?.filter(s => s > 0).length ?? 0;
    }

    let holesSoFar = 0;
    for (let r = 0; r < 4; r++) {
      const scores = g.rounds[r] ?? [];
      for (let h = 0; h < scores.length; h++) {
        if (scores[h] > 0) {
          holesSoFar++;
          allGolferHoles.push({
            golferIdx: gi,
            round: r,
            hole: h + 1,
            golferHolesAfter: totalPlayed - holesSoFar,
          });
        }
      }
    }
  }

  // Sort by golferHolesAfter descending (most holes remaining = oldest),
  // i.e. ascending = most recent last.
  // For ties (two golfers both have 3 holes remaining), order doesn't matter much.
  allGolferHoles.sort((a, b) => b.golferHolesAfter - a.golferHolesAfter);

  // For each (round, hole), find the most recent golfer completion.
  // = the entry with the lowest golferHolesAfter for that hole.
  const holeRecency = new Map<string, number>();
  for (const gh of allGolferHoles) {
    const key = `${gh.round}_${gh.hole}`;
    const existing = holeRecency.get(key);
    if (existing === undefined || gh.golferHolesAfter < existing) {
      holeRecency.set(key, gh.golferHolesAfter);
    }
  }

  // Sort holes by recency: lowest golferHolesAfter = most recent
  const bestBallOrder = [...holeRecency.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => {
      const [r, h] = key.split('_').map(Number);
      return { round: r, hole: h };
    });

  // Now get the actual best-ball results in this order
  const resultsByKey = new Map<string, { points: number; isBogey: boolean }>();
  for (let r = 0; r < 4; r++) {
    const hasScores = team.golfers.some(g => g.rounds[r]?.some(s => s > 0));
    if (!hasScores) continue;
    const results = computeHoleResults(team.golfers, r);
    for (const h of results) {
      if (h.bestScore === null) continue;
      resultsByKey.set(`${r}_${h.hole}`, {
        points: h.points,
        isBogey: h.bestScore > pars[h.hole - 1],
      });
    }
  }

  const timeline: { points: number; isBogey: boolean }[] = [];
  for (const bh of bestBallOrder) {
    const result = resultsByKey.get(`${bh.round}_${bh.hole}`);
    if (result) timeline.push(result);
  }

  if (timeline.length < 4) return null;

  // Hot: 4 most recent have 3+ points and no bogeys
  const recent4 = timeline.slice(0, 4);
  const pts4 = recent4.reduce((sum, h) => sum + h.points, 0);
  const bog4 = recent4.some(h => h.isBogey);
  if (pts4 >= 3 && !bog4) return 'hot';

  // Cold: 6 most recent have 0 points
  if (timeline.length >= 6) {
    const recent6 = timeline.slice(0, 6);
    const pts6 = recent6.reduce((sum, h) => sum + h.points, 0);
    if (pts6 === 0) return 'cold';
  }

  return null;
}
