import type { TeamStanding } from './types';
import { computeHoleResults, getPars } from './scoring';

export interface Shotgun {
  id: string;
  owner: string;
  reason: string;
  count: number; // 1 for most, 2 for double bogey
}

export interface ShotgunState {
  completedIds: string[];
  titsAssignedTo: string;
}

export function computeShotguns(
  standings: TeamStanding[],
  shotgunState: ShotgunState,
  preTournamentShotguns: Shotgun[],
): Shotgun[] {
  const shotguns: Shotgun[] = [...preTournamentShotguns];

  // 1. Player misses the cut
  for (const team of standings) {
    for (const g of team.golfers) {
      if (g.isCut) {
        shotguns.push({
          id: `cut_${team.owner}_${g.name}`,
          owner: team.owner,
          reason: `${g.name} missed the cut`,
          count: 1,
        });
      }
    }
  }

  // 2. Team bogey / double bogey (best ball >= par+1 on a hole)
  // Only counts when ALL non-cut golfers who have started this round have completed the hole
  // AND all non-cut golfers have started the round (no one still waiting to tee off)
  for (const team of standings) {
    const nonCutGolfers = team.golfers.filter(g => !g.isCut);
    for (let r = 0; r < 4; r++) {
      const hasScores = team.golfers.some(g => g.rounds[r]?.some(s => s > 0));
      if (!hasScores) continue;
      // All non-cut golfers must have started this round
      const allStarted = nonCutGolfers.every(g => g.rounds[r]?.some(s => s > 0));
      if (!allStarted) continue;
      const holeResults = computeHoleResults(team.golfers, r);
      for (const h of holeResults) {
        if (h.bestScore === null) continue;
        // All non-cut golfers must have played this specific hole
        const allPlayed = nonCutGolfers.every(g => (g.rounds[r]?.[h.hole - 1] ?? 0) > 0);
        if (!allPlayed) continue;
        const diff = h.bestScore - h.par;
        if (diff === 1) {
          shotguns.push({
            id: `bogey_${team.owner}_R${r + 1}H${h.hole}`,
            owner: team.owner,
            reason: `Team bogey on R${r + 1} hole ${h.hole}`,
            count: 1,
          });
        } else if (diff >= 2) {
          shotguns.push({
            id: `dblbogey_${team.owner}_R${r + 1}H${h.hole}`,
            owner: team.owner,
            reason: `Team double bogey on R${r + 1} hole ${h.hole}`,
            count: 2,
          });
        }
      }
    }
  }

  // 3. Ending with the Dick (last place) — only after ALL non-cut golfers have completed R4
  const tournamentComplete = standings.length > 0 && standings.every(t =>
    t.golfers.every(g => g.isCut || g.rounds[3]?.filter(s => s > 0).length === 18)
  );
  if (tournamentComplete && standings.length > 0) {
    const topScore = standings[0].totalPoints;
    const bottomScore = standings[standings.length - 1].totalPoints;
    if (topScore !== bottomScore) {
      for (const team of standings) {
        if (team.totalPoints === bottomScore) {
          shotguns.push({
            id: `lastplace_${team.owner}`,
            owner: team.owner,
            reason: 'Last place finish',
            count: 1,
          });
        }
      }
    }
  }

  // 4. Ending with the Tits — assigned to someone else (or self)
  if (shotgunState.titsAssignedTo) {
    shotguns.push({
      id: `tits_assigned_${shotgunState.titsAssignedTo}`,
      owner: shotgunState.titsAssignedTo,
      reason: 'Assigned by first place',
      count: 1,
    });
  }

  return shotguns;
}

export function getShotgunsByOwner(shotguns: Shotgun[]): Map<string, { total: number; completed: number; shotguns: Shotgun[] }> {
  const map = new Map<string, { total: number; completed: number; shotguns: Shotgun[] }>();

  for (const s of shotguns) {
    if (!map.has(s.owner)) {
      map.set(s.owner, { total: 0, completed: 0, shotguns: [] });
    }
    const entry = map.get(s.owner)!;
    entry.total += s.count;
    entry.shotguns.push(s);
  }

  return map;
}

export interface BogeyWatch {
  id: string;
  owner: string;
  round: number;
  hole: number;
  lastGolfer: string;
}

/**
 * Detect "Team Bogey Watch" — all but 1 active (non-cut) golfer have played
 * a hole and all scored bogey or worse. The last golfer needs to save it.
 * Only triggers if the team has at least 2 active golfers.
 */
export function detectBogeyWatch(standings: TeamStanding[]): BogeyWatch[] {
  const pars = getPars();
  const watches: BogeyWatch[] = [];

  for (const team of standings) {
    for (let r = 0; r < 4; r++) {
      // Only consider golfers who have started this round (have at least 1 score)
      const inRound = team.golfers.filter(g => !g.isCut && g.rounds[r]?.some(s => s > 0));
      if (inRound.length < 2) continue;

      for (let h = 0; h < 18; h++) {
        const scores = inRound.map(g => ({
          name: g.name,
          score: g.rounds[r]?.[h] ?? 0,
        }));

        const played = scores.filter(s => s.score > 0);
        const notPlayed = scores.filter(s => s.score === 0);

        // All but 1 golfer in this round have played the hole, exactly 1 left
        if (notPlayed.length !== 1 || played.length < 1) continue;

        // All who played scored bogey or worse
        const allBogeyOrWorse = played.every(s => s.score > pars[h]);
        if (!allBogeyOrWorse) continue;

        watches.push({
          id: `bogeywatch_${team.owner}_R${r + 1}H${h + 1}`,
          owner: team.owner,
          round: r + 1,
          hole: h + 1,
          lastGolfer: notPlayed[0].name,
        });
      }
    }
  }

  return watches;
}
