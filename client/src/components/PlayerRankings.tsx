import type { Player, DraftPicks } from '../types';
import { rankGolfers, type GolferRanking } from '../scoring';

interface Props {
  players: Player[];
  draftPicks: DraftPicks;
  onSelectPlayer: (golferName: string) => void;
}

export default function PlayerRankings({ players, draftPicks, onSelectPlayer }: Props) {
  const rankings = rankGolfers(players, draftPicks);
  const sorted = [...rankings].sort((a, b) => b.points - a.points);
  const top5 = sorted.slice(0, 5);
  const bottom5 = [...sorted].reverse().slice(0, 5);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <RankingCard title="Top Players" golfers={top5} onSelectPlayer={onSelectPlayer} />
      <RankingCard title="Worst Players" golfers={bottom5} onSelectPlayer={onSelectPlayer} isWorst />
    </div>
  );
}

function RankingCard({ title, golfers, onSelectPlayer, isWorst }: { title: string; golfers: GolferRanking[]; onSelectPlayer: (name: string) => void; isWorst?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">{title}</h2>
      </div>
      <div className="divide-y divide-[var(--border)]/50">
        {golfers.map((g, idx) => (
          <div
            key={g.name}
            className="px-3 py-2 flex items-center gap-2.5 text-xs cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
            onClick={() => onSelectPlayer(g.name)}
          >
            <span className={`w-5 text-center font-bold ${idx === 0 && !isWorst ? 'text-[var(--gold)]' : 'text-[var(--text-muted)]'}`}>
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[var(--text-primary)] truncate">{g.name}</div>
              <div className="text-[10px] text-[var(--text-muted)]">
                {g.owner}'s team
                {(g.birdies > 0 || g.eagles > 0) && (
                  <span className="ml-1">
                    &middot;{' '}
                    {g.birdies > 0 && <span className="text-cyan-400">{g.birdies}B</span>}
                    {g.birdies > 0 && g.eagles > 0 && ' '}
                    {g.eagles > 0 && <span className="text-yellow-400">{g.eagles}E</span>}
                  </span>
                )}
              </div>
            </div>
            <span className={`font-bold tabular-nums ${
              !isWorst && idx === 0 ? 'text-[var(--gold)]' : 'text-[var(--text-primary)]'
            }`}>
              {g.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
