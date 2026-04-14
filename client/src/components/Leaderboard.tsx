import { useRef, useEffect, useState } from 'react';
import type { TeamStanding, GolferScore } from '../types';
import type { Shotgun } from '../shotguns';
import { getTeamStreak } from '../streaks';

function getTeamHolesPlayed(team: TeamStanding): { played: number; remaining: number } {
  let totalPlayed = 0;
  let totalRemaining = 0;
  for (const g of team.golfers) {
    const played = g.rounds.reduce((sum, rd) => sum + (rd?.filter(s => s > 0).length ?? 0), 0);
    totalPlayed += played;
    if (g.isCut) {
      // Cut golfers won't play more — no remaining
    } else {
      totalRemaining += 72 - played;
    }
  }
  return { played: totalPlayed, remaining: totalRemaining };
}

function golferHoleLabel(g: GolferScore): string {
  // Find the latest round with scores
  for (let r = 3; r >= 0; r--) {
    const played = g.rounds[r]?.filter(s => s > 0).length ?? 0;
    if (played > 0) {
      if (played === 18) {
        // Check if there's a next round they haven't started yet
        if (r < 3 && (g.rounds[r + 1]?.filter(s => s > 0).length ?? 0) === 0) {
          // Finished this round but hasn't started next — if they have a tee time, show nothing
          if (g.teeTime) return '';
        }
        return 'F';
      }
      return String(played);
    }
  }
  return '';
}

function useRankChanges(standings: TeamStanding[]) {
  const prevOrderRef = useRef<Map<string, number>>(new Map());
  const [changes, setChanges] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const prev = prevOrderRef.current;
    if (prev.size === 0) {
      // First render — store order, no animations
      const initial = new Map<string, number>();
      standings.forEach((t, i) => initial.set(t.owner, i));
      prevOrderRef.current = initial;
      return;
    }

    const newChanges = new Map<string, number>();
    standings.forEach((team, newIdx) => {
      const oldIdx = prev.get(team.owner);
      if (oldIdx !== undefined && oldIdx !== newIdx) {
        newChanges.set(team.owner, oldIdx - newIdx); // positive = moved up
      }
    });

    if (newChanges.size > 0) {
      setChanges(newChanges);
      // Clear after animation
      const timer = setTimeout(() => setChanges(new Map()), 2000);

      const current = new Map<string, number>();
      standings.forEach((t, i) => current.set(t.owner, i));
      prevOrderRef.current = current;

      return () => clearTimeout(timer);
    }

    // Update ref even if no changes
    const current = new Map<string, number>();
    standings.forEach((t, i) => current.set(t.owner, i));
    prevOrderRef.current = current;
  }, [standings]);

  return changes;
}

function BeerIcon({ completed, className }: { completed: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 20" fill="none" className={className ?? 'w-3.5 h-[18px]'}>
      {/* Can body */}
      <rect x="2" y="4" width="10" height="14" rx="1.5"
        fill={completed ? 'var(--masters-green-light)' : 'none'}
        stroke={completed ? 'var(--masters-green-light)' : 'var(--text-muted)'}
        strokeWidth="1.2"
        opacity={completed ? 1 : 0.3}
      />
      {/* Foam */}
      <rect x="2" y="4" width="10" height="5" rx="1"
        fill={completed ? 'white' : 'none'}
        opacity={completed ? 0.3 : 0}
      />
      {/* Handle */}
      <path d="M12 7h2a1 1 0 011 1v3a1 1 0 01-1 1h-2"
        stroke={completed ? 'var(--masters-green-light)' : 'var(--text-muted)'}
        strokeWidth="1.2"
        opacity={completed ? 1 : 0.3}
      />
      {/* Checkmark overlay */}
      {completed && (
        <path d="M4.5 11L6.5 13.5L11 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      )}
    </svg>
  );
}

interface Props {
  standings: TeamStanding[];
  onSelectTeam: (owner: string) => void;
  onSelectPlayer: (golferName: string) => void;
  shotgunsByOwner: Map<string, { total: number; completed: number; shotguns: Shotgun[] }>;
  completedIds: string[];
}

export default function Leaderboard({ standings, onSelectTeam, onSelectPlayer, shotgunsByOwner, completedIds }: Props) {
  const topScore = standings[0]?.totalPoints ?? 0;
  const bottomScore = standings[standings.length - 1]?.totalPoints ?? 0;
  const rankChanges = useRankChanges(standings);

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
      {/* Desktop table */}
      <table className="w-full text-sm hidden sm:table">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
            <th className="px-4 py-2.5 w-10 text-center">#</th>
            <th className="px-4 py-2.5">Team</th>
            <th className="px-3 py-2.5 text-center w-16">Pts</th>
            <th className="px-3 py-2.5 text-center w-20">SG</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team, idx) => {
            const isFirst = team.totalPoints === topScore && topScore !== bottomScore;
            const isLast = team.totalPoints === bottomScore && topScore !== bottomScore;
            const change = rankChanges.get(team.owner);
            const movedUp = change !== undefined && change > 0;
            const movedDown = change !== undefined && change < 0;
            const streak = getTeamStreak(team);
            return (
              <tr
                key={team.owner}
                onClick={() => onSelectTeam(team.owner)}
                className={`border-b border-[var(--border)] cursor-pointer transition-all duration-500 hover:bg-[var(--bg-card-hover)] ${
                  isFirst ? 'bg-[var(--gold-bg)]' : ''
                } ${movedUp ? 'animate-flash-green' : ''} ${movedDown ? 'animate-flash-red' : ''}`}
              >
                <td className="px-4 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    {movedUp && <span className="text-emerald-400 text-[10px]">&#9650;</span>}
                    {movedDown && <span className="text-red-400 text-[10px]">&#9660;</span>}
                    {isFirst ? (
                      <span className="text-[var(--gold)] font-bold">{idx + 1}</span>
                    ) : (
                      <span className="text-[var(--text-muted)]">{idx + 1}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${isFirst ? 'text-[var(--gold)]' : 'text-[var(--text-primary)]'}`}>
                      {team.owner}
                    </span>
                    {isFirst && (
                      <span className="text-xs font-bold text-[var(--gold)] bg-[var(--gold)]/10 border border-[var(--gold)]/25 px-1.5 py-0.5 rounded" title="First place prize">( . )( . )</span>
                    )}
                    {isLast && (
                      <span className="text-xs font-bold border border-[var(--badge-border)] px-1.5 py-0.5 rounded bg-[var(--badge-bg)]" title="Last place prize">
                        <span style={{ backgroundImage: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00cc00, #0088ff, #8800ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>8====D</span>
                      </span>
                    )}
                    {streak === 'hot' && (
                      <span title="3+ points in last 6 holes">🔥</span>
                    )}
                    {streak === 'cold' && (
                      <span title="2+ team bogeys in last 6 holes">🥶</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex flex-wrap items-center gap-x-1">
                    {team.golfers.map((g, gi) => {
                      const hole = golferHoleLabel(g);
                      return (
                        <span key={g.name}>
                          {gi > 0 && <span className="mr-1">&middot;</span>}
                          <span
                            className={`hover:text-[var(--text-primary)] transition-colors cursor-pointer ${g.isCut ? 'line-through opacity-50' : ''}`}
                            onClick={(e) => { e.stopPropagation(); onSelectPlayer(g.name); }}
                          >
                            <span className="hidden lg:inline">{g.name}</span>
                            <span className="lg:hidden">{g.name.split(' ').pop()}</span>
                            {hole && <span className="text-[var(--text-muted)] ml-0.5">({hole})</span>}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                  {(() => {
                    const { remaining } = getTeamHolesPlayed(team);
                    const maxPossible = 4 * 72;
                    const pct = (maxPossible - remaining) / maxPossible;
                    return (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--text-muted)] transition-all duration-500"
                            style={{ width: `${pct * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0">{remaining} left</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`font-bold tabular-nums text-base ${isFirst ? 'text-[var(--gold)]' : 'text-[var(--text-primary)]'}`}>
                    {team.totalPoints}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  {(() => {
                    const data = shotgunsByOwner.get(team.owner);
                    if (!data || data.total === 0) return <span className="text-[var(--text-muted)]">&ndash;</span>;
                    return (
                      <div className="flex items-center justify-center gap-0.5">
                        {data.shotguns.flatMap(s =>
                          Array.from({ length: s.count }, (_, i) => (
                            <BeerIcon key={`${s.id}_${i}`} completed={completedIds.includes(s.id)} />
                          ))
                        )}
                      </div>
                    );
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile card list */}
      <div className="sm:hidden divide-y divide-[var(--border)]">
        {standings.map((team, idx) => {
          const isFirst = team.totalPoints === topScore && topScore !== bottomScore;
          const isLast = team.totalPoints === bottomScore && topScore !== bottomScore;
          const change = rankChanges.get(team.owner);
          const movedUp = change !== undefined && change > 0;
          const movedDown = change !== undefined && change < 0;
          const streak = getTeamStreak(team);
          return (
            <div
              key={team.owner}
              onClick={() => onSelectTeam(team.owner)}
              className={`px-4 py-3 cursor-pointer active:bg-[var(--bg-card-hover)] transition-all duration-500 ${
                isFirst ? 'bg-[var(--gold-bg)]' : ''
              } ${movedUp ? 'animate-flash-green' : ''} ${movedDown ? 'animate-flash-red' : ''}`}
            >
            <div className="flex items-center gap-3">
              <div className={`text-sm font-bold w-6 text-center shrink-0 flex flex-col items-center ${isFirst ? 'text-[var(--gold)]' : 'text-[var(--text-muted)]'}`}>
                {movedUp && <span className="text-emerald-400 text-[8px] leading-none">&#9650;</span>}
                <span>{idx + 1}</span>
                {movedDown && <span className="text-red-400 text-[8px] leading-none">&#9660;</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`font-semibold text-sm ${isFirst ? 'text-[var(--gold)]' : 'text-[var(--text-primary)]'}`}>
                    {team.owner}
                  </span>
                  {isFirst && (
                    <span className="text-[10px] font-bold text-[var(--gold)] bg-[var(--gold)]/10 border border-[var(--gold)]/25 px-1 py-0.5 rounded">( . )( . )</span>
                  )}
                  {isLast && (
                    <span className="text-[10px] font-bold border border-[var(--badge-border)] px-1 py-0.5 rounded bg-[var(--badge-bg)]">
                      <span style={{ backgroundImage: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00cc00, #0088ff, #8800ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>8====D</span>
                    </span>
                  )}
                  {streak === 'hot' && <span title="Heating up">🔥</span>}
                  {streak === 'cold' && <span title="Choking">🥶</span>}
                  {(() => {
                    const data = shotgunsByOwner.get(team.owner);
                    if (!data || data.total === 0) return null;
                    const icons = data.shotguns.flatMap(s =>
                      Array.from({ length: s.count }, (_, i) => (
                        <BeerIcon key={`${s.id}_${i}`} completed={completedIds.includes(s.id)} />
                      ))
                    );
                    return (
                      <span className="inline-flex items-center gap-0.5 flex-wrap ml-1">
                        {icons}
                      </span>
                    );
                  })()}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                  {team.golfers.map((g, gi) => {
                    const hole = golferHoleLabel(g);
                    return (
                      <span key={g.name}>
                        {gi > 0 && ' \u00b7 '}
                        <span
                          className={`hover:text-[var(--text-primary)] transition-colors ${g.isCut ? 'line-through opacity-50' : ''}`}
                          onClick={(e) => { e.stopPropagation(); onSelectPlayer(g.name); }}
                        >
                          {g.name.split(' ').pop()}
                          {hole && <span className="text-[var(--text-muted)] ml-0.5">({hole})</span>}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-bold tabular-nums text-lg leading-none ${isFirst ? 'text-[var(--gold)]' : 'text-[var(--text-primary)]'}`}>
                  {team.totalPoints}
                </div>
              </div>
            </div>
            {(() => {
              const { remaining } = getTeamHolesPlayed(team);
              const maxPossible = 4 * 72;
              const pct = (maxPossible - remaining) / maxPossible;
              return (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--text-muted)] transition-all duration-500"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)] tabular-nums shrink-0 whitespace-nowrap">{remaining} left</span>
                </div>
              );
            })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
