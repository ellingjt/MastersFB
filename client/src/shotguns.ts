import type { TeamStanding } from './types';
import { computeHoleResults } from './scoring';

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
  // Only counts when all active (non-cut) golfers have played the hole
  for (const team of standings) {
    const activeGolfers = team.golfers.filter(g => !g.isCut);
    for (let r = 0; r < 4; r++) {
      const hasScores = team.golfers.some(g => g.rounds[r]?.some(s => s > 0));
      if (!hasScores) continue;
      const holeResults = computeHoleResults(team.golfers, r);
      for (const h of holeResults) {
        if (h.bestScore === null) continue;
        // Check all active golfers have a score for this hole
        const allPlayed = activeGolfers.every(g => (g.rounds[r]?.[h.hole - 1] ?? 0) > 0);
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

  // 3. Ending with the Dick (last place) — only after tournament is complete (R4 has scores)
  const tournamentComplete = standings.some(t => t.golfers.some(g => g.rounds[3]?.some(s => s > 0)));
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
