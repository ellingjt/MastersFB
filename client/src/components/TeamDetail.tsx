import { useState } from 'react';
import type { TeamStanding } from '../types';
import type { Shotgun } from '../shotguns';
import type { YearConfig } from '../api';
import { computeHoleResults } from '../scoring';
import { getTrophies } from '../history';
import Scorecard from './Scorecard';

interface Props {
  standings: TeamStanding[];
  owner: string;
  onBack: () => void;
  shotguns: Shotgun[];
  completedIds: string[];
  onToggleShotgun: (id: string, completed: boolean) => void;
  history: YearConfig['history'];
}

export default function TeamDetail({ standings, owner, onBack, shotguns, completedIds, onToggleShotgun, history }: Props) {
  const team = standings.find(s => s.owner === owner);

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-muted)]">Team not found.</p>
        <button onClick={onBack} className="text-[var(--gold)] text-sm mt-2 bg-transparent border-none cursor-pointer">
          Back to leaderboard
        </button>
      </div>
    );
  }

  const rank = standings.indexOf(team) + 1;

  // Count each golfer's point contributions across all rounds
  const contributions = new Map<string, number>();
  for (let r = 0; r < 4; r++) {
    const results = computeHoleResults(team.golfers, r);
    for (const h of results) {
      if (h.points > 0 && h.contributor) {
        contributions.set(h.contributor, (contributions.get(h.contributor) ?? 0) + h.points);
      }
    }
  }

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <nav className="text-xs flex items-center gap-1.5 text-[var(--text-muted)]">
        <button
          onClick={onBack}
          className="text-[var(--gold-dim)] hover:text-[var(--gold)] bg-transparent border-none cursor-pointer p-0 text-xs transition-colors"
        >
          Leaderboard
        </button>
        <span className="text-[var(--border-light)]">/</span>
        <span className="text-[var(--text-secondary)]">{team.owner}</span>
      </nav>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] m-0">{team.owner}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">Rank #{rank} of {standings.length}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[var(--gold)] tabular-nums leading-none">{team.totalPoints}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mt-1">total pts</div>
          </div>
        </div>

        {/* Round breakdown bar */}
        <div className="flex gap-2 mt-4">
          {team.roundPoints.map((rp, i) => (
            <div key={i} className="flex-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] px-3 py-2 text-center">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">R{i + 1}</div>
              <div className={`text-sm font-bold tabular-nums mt-0.5 ${rp > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>
                {rp > 0 ? rp : '\u2013'}
              </div>
            </div>
          ))}
        </div>

        {/* Golfer cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
          {team.golfers.map(g => (
            <div
              key={g.name}
              className={`rounded border px-3 py-2 ${
                g.isCut
                  ? 'bg-[var(--bg-primary)] border-[var(--border)] opacity-50'
                  : 'bg-[var(--bg-primary)] border-[var(--border-light)]'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-semibold text-xs text-[var(--text-primary)]">{g.name}</span>
                {g.isCut && (
                  <span className="text-[9px] font-bold uppercase bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded tracking-wider">Cut</span>
                )}
                {!g.isCut && g.holesPlayed === 0 && g.teeTime && (
                  <span className="text-[10px] text-[var(--gold)] font-medium">{g.teeTime}</span>
                )}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                {g.holesPlayed === 0 && g.teeTime
                  ? 'Hasn\u2019t teed off'
                  : `${g.holesPlayed} holes` + (contributions.get(g.name) ? ` \u00b7 ${contributions.get(g.name)} pts contributed` : '')
                }
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trophy case */}
      <TrophyCase owner={team.owner} history={history} />

      {/* Shotgun tracker */}
      <ShotgunTracker shotguns={shotguns} completedIds={completedIds} onToggle={onToggleShotgun} />

      {/* Scorecards per round */}
      {[0, 1, 2, 3].map(roundIdx => {
        const hasScores = team.golfers.some(g => g.rounds[roundIdx]?.some(s => s > 0));
        if (!hasScores) return null;
        const holeResults = computeHoleResults(team.golfers, roundIdx);
        return (
          <Scorecard
            key={roundIdx}
            roundNumber={roundIdx + 1}
            holeResults={holeResults}
            golfers={team.golfers}
            roundPoints={team.roundPoints[roundIdx]}
          />
        );
      })}
    </div>
  );
}

function ShotgunRulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-5 max-w-sm mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)] m-0">Shotgun Rules</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer text-lg leading-none">&times;</button>
        </div>
        <div className="space-y-2 text-xs text-[var(--text-secondary)]">
          <div className="flex gap-2">
            <span className="text-[var(--gold)] shrink-0">1x</span>
            <span>Player misses the cut</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[var(--gold)] shrink-0">1x</span>
            <span>Team bogey (best ball on a hole is bogey)</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[var(--gold)] shrink-0">2x</span>
            <span>Team double bogey or worse</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[var(--gold)] shrink-0">1x</span>
            <span>Ending with the <span style={{ backgroundImage: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00cc00, #0088ff, #8800ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>8====D</span> (last place)</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[var(--gold)] shrink-0">1x</span>
            <span>Ending with the <span className="text-[var(--gold)]">( . )( . )</span> — assign a shotgun to any player</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShotgunTracker({ shotguns, completedIds, onToggle }: { shotguns: Shotgun[]; completedIds: string[]; onToggle: (id: string, completed: boolean) => void }) {
  const [showRules, setShowRules] = useState(false);

  if (shotguns.length === 0) return null;

  const totalBeers = shotguns.reduce((sum, s) => sum + s.count, 0);
  const completedBeers = shotguns.reduce((sum, s) => sum + (completedIds.includes(s.id) ? s.count : 0), 0);

  return (
    <>
    {showRules && <ShotgunRulesModal onClose={() => setShowRules(false)} />}
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">Shotgun Tracker</h3>
          <button
            onClick={() => setShowRules(true)}
            className="w-4 h-4 rounded-full border border-[var(--text-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] bg-transparent cursor-pointer flex items-center justify-center text-[10px] font-bold leading-none transition-colors"
            title="Shotgun rules"
          >
            ?
          </button>
        </div>
        <span className="text-[11px] text-[var(--text-muted)] tabular-nums">{completedBeers}/{totalBeers} completed</span>
      </div>
      <div className="divide-y divide-[var(--border)]/50">
        {shotguns.map(s => {
          const done = completedIds.includes(s.id);
          return (
            <div key={s.id} className="px-4 py-2.5 flex items-center gap-3">
              <button
                onClick={() => onToggle(s.id, !done)}
                className={`shrink-0 w-7 h-7 rounded-md border flex items-center justify-center cursor-pointer transition-all ${
                  done
                    ? 'bg-[var(--masters-green)] border-[var(--masters-green)] text-white'
                    : 'bg-transparent border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--masters-green)]'
                }`}
              >
                <svg viewBox="0 0 16 20" fill="none" className="w-3.5 h-4.5">
                  <rect x="2" y="4" width="10" height="14" rx="1.5"
                    fill={done ? 'white' : 'none'}
                    stroke={done ? 'white' : 'currentColor'}
                    strokeWidth="1.2"
                    opacity={done ? 0.9 : 0.5}
                  />
                  <rect x="2" y="4" width="10" height="5" rx="1" fill="white" opacity={done ? 0.3 : 0.1} />
                  <path d="M12 7h2a1 1 0 011 1v3a1 1 0 01-1 1h-2"
                    stroke={done ? 'white' : 'currentColor'}
                    strokeWidth="1.2"
                    opacity={done ? 0.9 : 0.5}
                  />
                </svg>
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium ${done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-primary)]'}`}>
                  {s.reason}
                </div>
                {s.count > 1 && (
                  <div className="text-[10px] text-[var(--text-muted)]">{s.count} shotguns</div>
                )}
              </div>
              {done && (
                <span className="text-[9px] font-bold uppercase text-[var(--masters-green)] tracking-wider">Done</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}

function TrophyCase({ owner, history }: { owner: string; history: YearConfig['history'] }) {
  const trophies = getTrophies(owner, history);

  if (trophies.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border)]">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">Trophy Case</h3>
      </div>
      <div className="px-4 py-3 flex flex-wrap gap-2">
        {trophies.map(t => t.type === 'first' ? (
          <div
            key={`w-${t.year}`}
            className="flex items-center gap-1.5 rounded-md border border-[var(--gold)]/25 bg-[var(--gold-bg)] px-3 py-1.5"
          >
            <span className="text-sm font-bold text-[var(--gold)]">( . )( . )</span>
            <span className="text-xs font-semibold text-[var(--gold)] tabular-nums">
              {t.year}{t.note && <span className="cursor-help" title={t.note}>*</span>}
            </span>
          </div>
        ) : (
          <div
            key={`l-${t.year}`}
            className="flex items-center gap-1.5 rounded-md border border-[var(--badge-border)] bg-[var(--badge-bg)] px-3 py-1.5"
          >
            <span className="text-sm font-bold" style={{ backgroundImage: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00cc00, #0088ff, #8800ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>8====D</span>
            <span className="text-xs font-semibold text-[var(--text-muted)] tabular-nums">{t.year}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
