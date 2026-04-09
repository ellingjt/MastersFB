import type { Player, DraftPicks } from '../types';
import { detectBirdiesAndEagles } from '../scoring';

interface Props {
  players: Player[];
  draftPicks: DraftPicks;
  onSelectPlayer: (golferName: string) => void;
}

function labelStyle(label: string) {
  if (label === 'Eagle' || label === 'Albatross') {
    return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  }
  return 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25';
}

export default function LiveFeed({ players, draftPicks, onSelectPlayer }: Props) {
  const events = detectBirdiesAndEagles(players, draftPicks);

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--bg-card)] flex flex-col">
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">Live Feed</h2>
        {events.length > 0 && (
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{events.length}</span>
        )}
      </div>
      {events.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-[var(--text-muted)]">
          No birdies or eagles yet.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]/50 overflow-y-auto max-h-[340px] sidebar-scroll">
          {events.map((e, idx) => (
            <div
              key={idx}
              className="px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
              onClick={() => onSelectPlayer(e.golfer)}
            >
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${labelStyle(e.label)}`}>
                {label(e.label)}
              </span>
              <div className="flex-1 min-w-0 truncate">
                <span className="font-medium text-[var(--text-primary)]">{e.golfer}</span>
                <span className="text-[var(--text-muted)] ml-1">#{e.hole} R{e.round}</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] shrink-0">{e.owner}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function label(l: string) {
  if (l === 'Albatross') return 'Alb';
  return l;
}
