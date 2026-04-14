import { useState, useEffect } from 'react';
import type { TeamStanding } from '../types';

interface Props {
  standings: TeamStanding[];
  show: boolean;
}

interface ConfettiPill {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
  type: 'tits' | 'dick';
}

export default function TournamentOverlay({ standings, show }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [confetti, setConfetti] = useState<ConfettiPill[]>([]);

  useEffect(() => {
    if (!show || dismissed) return;

    const pills: ConfettiPill[] = [];
    for (let i = 0; i < 60; i++) {
      pills.push({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 3 + Math.random() * 4,
        size: 0.6 + Math.random() * 0.6,
        type: Math.random() > 0.15 ? 'tits' : 'dick',
      });
    }
    setConfetti(pills);
  }, [show, dismissed]);

  if (!show || dismissed || standings.length === 0) return null;

  const topScore = standings[0].totalPoints;
  const bottomScore = standings[standings.length - 1].totalPoints;
  const winners = standings.filter(s => s.totalPoints === topScore);
  const losers = standings.filter(s => s.totalPoints === bottomScore);
  const tiedWin = winners.length > 1;
  const tiedLose = losers.length > 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setDismissed(true)}
    >
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map(pill => (
          <div
            key={pill.id}
            className="absolute animate-confetti-fall"
            style={{
              left: `${pill.x}%`,
              top: '-40px',
              animationDelay: `${pill.delay}s`,
              animationDuration: `${pill.duration}s`,
              transform: `scale(${pill.size})`,
            }}
          >
            {pill.type === 'tits' ? (
              <span className="text-[11px] font-bold text-[var(--gold)] bg-[var(--gold)]/20 border border-[var(--gold)]/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                ( . )( . )
              </span>
            ) : (
              <span className="text-[11px] font-bold border border-white/10 px-1.5 py-0.5 rounded bg-white/5 whitespace-nowrap">
                <span style={{ backgroundImage: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00cc00, #0088ff, #8800ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>8====D</span>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      <div
        className="relative bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-2xl max-w-lg w-full mx-4 p-8 text-center animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Winners */}
        <div className="mb-6">
          <div className="text-[var(--gold)] text-5xl mb-3">🏆</div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] m-0" style={{ fontFamily: "'Georgia', serif" }}>
            {winners.map(w => w.owner).join(' & ')}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {tiedWin ? 'Co-Champions' : 'Champion'} &middot; {topScore} pts
          </p>
          <div className="mt-3 inline-block">
            <span className="text-lg font-bold text-[var(--gold)] bg-[var(--gold)]/10 border border-[var(--gold)]/25 px-3 py-1 rounded-lg">
              ( . )( . )
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">Masters for Beers 2026</p>
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--border)] my-5" />

        {/* Losers */}
        <div className="mb-4">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">Last Place</p>
          <h2 className="text-xl font-bold text-[var(--text-primary)] m-0">
            {losers.map(l => l.owner).join(' & ')}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {tiedLose ? 'Co-holders' : 'Sole owner'} &middot; {bottomScore} pts
          </p>
          <div className="mt-2 inline-block">
            <span className="text-lg font-bold border border-white/10 px-3 py-1 rounded-lg bg-white/5">
              <span style={{ backgroundImage: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00cc00, #0088ff, #8800ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>8====D</span>
            </span>
          </div>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="mt-4 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border border-[var(--border)] rounded-md px-4 py-2 cursor-pointer transition-colors"
        >
          Tap to dismiss
        </button>
      </div>
    </div>
  );
}
