import type { Player, DraftPicks, TournamentState } from '../types';

interface Props {
  tournament: TournamentState;
  draftPicks: DraftPicks;
  onSelectPlayer: (golferName: string) => void;
}

interface CutWatchEntry {
  golfer: string;
  owner: string;
  toPar: number;
  holeLabel: string;
  status: 'below' | 'on_line' | 'danger' | 'safe';
  label: string;
}

function getHoleLabel(player: Player): string {
  const rounds = [player.round1, player.round2, player.round3, player.round4];
  for (let r = 3; r >= 0; r--) {
    const scores = rounds[r]?.split('|').map(Number) ?? [];
    const played = scores.filter(s => s > 0).length;
    if (played > 0) {
      if (played === 18) {
        // Check if next round hasn't started
        if (r < 3) {
          const nextScores = rounds[r + 1]?.split('|').map(Number) ?? [];
          if (nextScores.every(s => s === 0)) return player.teeTime ? '' : 'F';
        }
        return 'F';
      }
      return String(played);
    }
  }
  return '';
}

export default function CutWatch({ tournament, draftPicks, onSelectPlayer }: Props) {
  // Show until the cut has happened (R3 starts)
  // Hide if no cut line data or if we're past R2
  if (tournament.projectedCutLine === null) return null;
  if (tournament.currentRound > 2) return null;

  // Hide once the cut has happened: all players finished R2 or R3 has started
  const r3Started = tournament.players.some(p => {
    const scores = p.round3?.split('|').map(Number) ?? [];
    return scores.some(s => s > 0);
  });
  if (r3Started) return null;

  // Hide once the entire field has finished R2 (no one mid-R2 and no one yet to start R2)
  // i.e. every player either has 18 R2 scores or withdrew
  const allFieldFinishedR2 = tournament.players.length > 0 &&
    !tournament.players.some(p => {
      const r2Scores = p.round2?.split('|').map(Number) ?? [];
      const r2Played = r2Scores.filter(s => s > 0).length;
      return r2Played < 18; // Anyone with fewer than 18 R2 scores means R2 isn't done
    });
  if (allFieldFinishedR2) return null;
  const cutLine = tournament.projectedCutLine;
  const playerMap = new Map<string, Player>();
  for (const p of tournament.players) {
    playerMap.set(p.fullName.toLowerCase(), p);
  }

  // Find drafted golfers near the cut line
  const entries: CutWatchEntry[] = [];
  for (const [owner, golfers] of Object.entries(draftPicks)) {
    for (const name of golfers) {
      const player = playerMap.get(name.toLowerCase());
      if (!player || !player.toPar) continue;

      const toPar = parseInt(player.toPar, 10);
      if (isNaN(toPar)) continue;

      const diff = toPar - cutLine;

      let status: CutWatchEntry['status'];
      let label: string;

      if (diff > 0) {
        status = 'below';
        label = 'BELOW CUT';
      } else if (diff === 0) {
        status = 'on_line';
        label = 'ON THE LINE';
      } else if (diff === -1) {
        status = 'danger';
        label = `Safe by 1`;
      } else {
        continue; // Don't show golfers safely above the cut
      }

      entries.push({ golfer: name, owner, toPar, holeLabel: getHoleLabel(player), status, label });
    }
  }

  if (entries.length === 0) return null;

  // Sort: below cut first, then on line, then danger zone
  const statusOrder = { below: 0, on_line: 1, danger: 2, safe: 3 };
  entries.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.toPar - a.toPar);

  const formatToPar = (n: number) => n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">Cut Watch</h2>
          <span className="text-[11px]">&#9986;</span>
        </div>
        <span className="text-[10px] text-[var(--text-muted)]">
          Projected cut: <span className="font-bold text-[var(--text-primary)]">{formatToPar(cutLine)}</span>
        </span>
      </div>
      <div className="divide-y divide-[var(--border)]/50">
        {entries.map(e => (
          <div
            key={e.golfer}
            className="px-4 py-2 flex items-center gap-3 text-xs cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
            onClick={() => onSelectPlayer(e.golfer)}
          >
            <span className={`font-bold tabular-nums w-8 text-right ${
              e.toPar > 0 ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
            }`}>
              {formatToPar(e.toPar)}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-[var(--text-primary)]">{e.golfer}</span>
              {e.holeLabel && <span className="text-[var(--text-muted)] ml-1">({e.holeLabel})</span>}
              <span className="text-[var(--text-muted)] ml-1">{e.owner}</span>
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              e.status === 'below'
                ? 'bg-red-500/15 text-red-400 border border-red-500/25'
                : e.status === 'on_line'
                ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/25'
                : 'bg-[var(--badge-bg)] text-[var(--text-muted)] border border-[var(--badge-border)]'
            }`}>
              {e.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
