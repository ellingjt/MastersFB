import { CURRENT_YEAR } from '../constants';

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Flag pole */}
      <line x1="26" y1="2" x2="26" y2="28" stroke="var(--gold)" strokeWidth="1.2" />
      {/* Flag */}
      <path d="M26 2 L38 7 L26 12 Z" fill="var(--gold)" />
      {/* Beer can body */}
      <rect x="8" y="18" width="22" height="30" rx="3" fill="var(--masters-green)" stroke="var(--gold-dim)" strokeWidth="0.8" />
      {/* Can top rim */}
      <ellipse cx="19" cy="18" rx="11" ry="3" fill="var(--bg-elevated)" stroke="var(--gold-dim)" strokeWidth="0.8" />
      {/* Can label stripe */}
      <rect x="8" y="28" width="22" height="8" fill="var(--gold)" opacity="0.2" />
      {/* Label text - M */}
      <text x="19" y="35" textAnchor="middle" fill="var(--gold)" fontSize="8" fontWeight="bold" fontFamily="Georgia, serif">M</text>
      {/* Can bottom rim */}
      <ellipse cx="19" cy="48" rx="11" ry="3" fill="var(--masters-green)" stroke="var(--gold-dim)" strokeWidth="0.8" />
      {/* Tab on top */}
      <ellipse cx="19" cy="17" rx="4" ry="1.2" fill="var(--text-muted)" opacity="0.6" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zm0 13a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zm8-5a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zm11.24-5.24a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zm-12.37 9.42a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 11-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zm12.37 0a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zM4.87 4.76a.75.75 0 010 1.06L3.81 6.88a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zM10 7a3 3 0 100 6 3 3 0 000-6z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 01.26.77 7 7 0 009.958 7.967.75.75 0 011.067.853A8.5 8.5 0 116.647 1.921a.75.75 0 01.808.083z" clipRule="evenodd" />
    </svg>
  );
}

interface Props {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onLogoClick: () => void;
  soundMuted: boolean;
  onToggleSound: () => void;
}

export default function Header({ theme, onToggleTheme, onLogoClick, soundMuted, onToggleSound }: Props) {
  return (
    <header className="bg-[var(--bg-header)] border-b border-[var(--border)]">
      <div className="max-w-[1400px] mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer" onClick={onLogoClick}>
          <Logo className="w-7 h-9 sm:w-8 sm:h-10 shrink-0" />
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-tight m-0 text-[var(--text-primary)]" style={{ fontFamily: "'Georgia', serif" }}>
              <span className="text-[var(--gold)]">Masters</span> for Beers
            </h1>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mt-0">
              {CURRENT_YEAR} <span className="hidden sm:inline">&middot; Augusta National</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSound}
            className="p-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title={soundMuted ? 'Unmute sounds' : 'Mute sounds'}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              {soundMuted ? (
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071a1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10a7.971 7.971 0 00-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243a1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z" clipRule="evenodd" />
              )}
            </svg>
          </button>
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)]">Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}
