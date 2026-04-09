import type { GolferScore, HoleResult } from '../types';
import { getPars } from '../scoring';

interface Props {
  roundNumber: number;
  holeResults: HoleResult[];
  golfers: GolferScore[];
  roundPoints: number;
}

function scoreColor(diff: number): string {
  if (diff <= -2) return 'text-yellow-400';
  if (diff === -1) return 'text-cyan-400';
  if (diff === 0) return 'text-[var(--text-secondary)]';
  return 'text-[var(--text-muted)]';
}

function strokeColor(diff: number): string {
  if (diff <= -2) return 'stroke-yellow-400';
  if (diff === -1) return 'stroke-cyan-400';
  return 'stroke-[var(--text-muted)]';
}

const cell = 'inline-grid place-items-center w-8 h-8 [&>*]:[grid-area:1/1]';

function ScoreCell({ score, par }: { score: number; par: number }) {
  if (score === 0) return null;
  const diff = score - par;

  // Eagle or better: double circle
  if (diff <= -2) {
    return (
      <span className={`${cell} font-bold text-sm ${scoreColor(diff)}`}>
        <svg className={`w-8 h-8 ${strokeColor(diff)}`} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" strokeWidth="1.5" />
          <circle cx="16" cy="16" r="10" strokeWidth="1" />
        </svg>
        <span>{score}</span>
      </span>
    );
  }

  // Birdie: single circle
  if (diff === -1) {
    return (
      <span className={`${cell} font-bold text-sm ${scoreColor(diff)}`}>
        <svg className={`w-8 h-8 ${strokeColor(diff)}`} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="13" strokeWidth="1.5" />
        </svg>
        <span>{score}</span>
      </span>
    );
  }

  // Par: plain number
  if (diff === 0) {
    return <span className={`${cell} text-sm ${scoreColor(diff)}`}>{score}</span>;
  }

  // Bogey: single square
  if (diff === 1) {
    return (
      <span className={`${cell} text-sm ${scoreColor(diff)}`}>
        <svg className={`w-8 h-8 ${strokeColor(diff)}`} viewBox="0 0 32 32" fill="none">
          <rect x="4" y="4" width="24" height="24" rx="1.5" strokeWidth="1.5" />
        </svg>
        <span>{score}</span>
      </span>
    );
  }

  // Double bogey+: double square
  return (
    <span className={`${cell} text-sm ${scoreColor(diff)}`}>
      <svg className={`w-8 h-8 ${strokeColor(diff)}`} viewBox="0 0 32 32" fill="none">
        <rect x="3" y="3" width="26" height="26" rx="1.5" strokeWidth="1.5" />
        <rect x="7" y="7" width="18" height="18" rx="1" strokeWidth="1" />
      </svg>
      <span>{score}</span>
    </span>
  );
}

export default function Scorecard({ roundNumber, holeResults, golfers, roundPoints }: Props) {
  const pars = getPars();
  const front9 = holeResults.slice(0, 9);
  const back9 = holeResults.slice(9, 18);

  const thBase = 'px-1.5 py-2 text-center text-[11px] uppercase tracking-wider';
  const tdBase = 'px-1.5 py-2 text-center text-sm tabular-nums overflow-hidden';
  const dividerCol = 'bg-[var(--bg-primary)]';

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
      <div className="px-4 py-3 flex justify-between items-center border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold m-0 text-[var(--text-secondary)]">Round {roundNumber}</h3>
        <span className="text-sm font-bold text-[var(--gold)] tabular-nums">{roundPoints} pts</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
              <th className={`${thBase} text-left sticky left-0 bg-[var(--bg-card)] min-w-[80px] sm:min-w-[140px] z-20`}>Hole</th>
              {front9.map((_, i) => (
                <th key={i} className={`${thBase} w-10`}>{i + 1}</th>
              ))}
              <th className={`${thBase} w-10 ${dividerCol} font-bold`}>Out</th>
              {back9.map((_, i) => (
                <th key={i + 9} className={`${thBase} w-10`}>{i + 10}</th>
              ))}
              <th className={`${thBase} w-10 ${dividerCol} font-bold`}>In</th>
              <th className={`${thBase} w-9 ${dividerCol} font-bold`}>Tot</th>
            </tr>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
              <td className={`${tdBase} text-left sticky left-0 bg-[var(--bg-card)] font-medium z-20`}>Par</td>
              {pars.slice(0, 9).map((p, i) => (
                <td key={i} className={tdBase}>{p}</td>
              ))}
              <td className={`${tdBase} ${dividerCol} font-medium`}>{pars.slice(0, 9).reduce((a, b) => a + b, 0)}</td>
              {pars.slice(9).map((p, i) => (
                <td key={i + 9} className={tdBase}>{p}</td>
              ))}
              <td className={`${tdBase} ${dividerCol} font-medium`}>{pars.slice(9).reduce((a, b) => a + b, 0)}</td>
              <td className={`${tdBase} ${dividerCol} font-medium`}>{pars.reduce((a, b) => a + b, 0)}</td>
            </tr>
          </thead>
          <tbody>
            {golfers.map(g => {
              const scores = g.rounds[roundNumber - 1] ?? [];
              if (scores.every(s => s === 0)) return null;
              const front = scores.slice(0, 9);
              const back = scores.slice(9, 18);
              const frontTotal = front.reduce((a, b) => a + b, 0);
              const backTotal = back.reduce((a, b) => a + b, 0);
              return (
                <tr key={g.name} className="border-b border-[var(--border)]/50">
                  <td className={`${tdBase} text-left sticky left-0 bg-[var(--bg-card)] text-[var(--text-secondary)] truncate max-w-[140px] sm:max-w-[140px] max-w-[80px] z-20`}>
                    <span className="hidden sm:inline">{g.name}</span>
                    <span className="sm:hidden">{g.name.split(' ').pop()}</span>
                  </td>
                  {front.map((s, i) => (
                    <td key={i} className={tdBase}>
                      <div className="flex items-center justify-center">
                        <ScoreCell score={s} par={pars[i]} />
                      </div>
                    </td>
                  ))}
                  <td className={`${tdBase} ${dividerCol} font-medium text-[var(--text-secondary)]`}>
                    {frontTotal > 0 ? frontTotal : ''}
                  </td>
                  {back.map((s, i) => (
                    <td key={i + 9} className={tdBase}>
                      <div className="flex items-center justify-center">
                        <ScoreCell score={s} par={pars[i + 9]} />
                      </div>
                    </td>
                  ))}
                  <td className={`${tdBase} ${dividerCol} font-medium text-[var(--text-secondary)]`}>
                    {backTotal > 0 ? backTotal : ''}
                  </td>
                  <td className={`${tdBase} ${dividerCol} font-bold text-[var(--text-primary)]`}>
                    {frontTotal + backTotal > 0 ? frontTotal + backTotal : ''}
                  </td>
                </tr>
              );
            })}
            {/* Score row */}
            <tr className="border-t border-[var(--gold-dim)]/30 bg-[var(--gold-bg)]">
              <td className={`${tdBase} text-left sticky left-0 bg-[var(--bg-elevated)] text-[var(--gold)] font-bold z-20`}>
                Score
              </td>
              {front9.map((h, i) => (
                <td key={i} className={`${tdBase} ${h.points > 0 ? 'text-[var(--gold)] font-bold' : 'text-[var(--text-muted)]'}`}>
                  {h.bestScore !== null ? h.points.toString() : ''}
                </td>
              ))}
              <td className={`${tdBase} ${dividerCol} text-[var(--gold)] font-bold`}>
                {front9.reduce((s, h) => s + h.points, 0)}
              </td>
              {back9.map((h, i) => (
                <td key={i + 9} className={`${tdBase} ${h.points > 0 ? 'text-[var(--gold)] font-bold' : 'text-[var(--text-muted)]'}`}>
                  {h.bestScore !== null ? h.points.toString() : ''}
                </td>
              ))}
              <td className={`${tdBase} ${dividerCol} text-[var(--gold)] font-bold`}>
                {back9.reduce((s, h) => s + h.points, 0)}
              </td>
              <td className={`${tdBase} ${dividerCol} text-[var(--gold)] font-bold text-sm`}>
                {roundPoints}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
