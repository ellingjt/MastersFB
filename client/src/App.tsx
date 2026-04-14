import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AdminPanel from './components/AdminPanel';
import Header from './components/Header';
import Leaderboard from './components/Leaderboard';
import TeamDetail from './components/TeamDetail';
import LiveFeed from './components/LiveFeed';
import ChatPanel from './components/ChatPanel';
import PlayerRankings from './components/PlayerRankings';
import CutWatch from './components/CutWatch';
import WinProbChart from './components/WinProbChart';
import TournamentOverlay from './components/TournamentOverlay';
import { fetchScores, fetchDraftPicks, fetchShotgunState, fetchYearConfig, fetchTournamentState, toggleShotgunComplete } from './api';
import { calculateStandings } from './scoring';
import { computeShotguns, getShotgunsByOwner, type ShotgunState } from './shotguns';
import { useTheme } from './useTheme';
import { useChat } from './useChat';
import { useBirdieSounds } from './useBirdieSounds';
import { isMuted, toggleMute } from './sounds';
import { CURRENT_YEAR } from './constants';

export default function App() {
  if (window.location.pathname === '/admin') return <AdminPanel />;

  const [selectedTeam, setSelectedTeamRaw] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('team');
  });
  const { theme, toggle: toggleTheme } = useTheme();
  const [soundMuted, setSoundMuted] = useState(isMuted);
  const queryClient = useQueryClient();
  const chatRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<{ focus: () => void }>(null);
  const [chatInputFocused, setChatInputFocused] = useState(false);
  const [lastSeenCount, setLastSeenCountRaw] = useState(() => {
    return parseInt(localStorage.getItem('masters-chat-seen') ?? '0', 10);
  });
  const setLastSeenCount = useCallback((n: number) => {
    setLastSeenCountRaw(n);
    localStorage.setItem('masters-chat-seen', String(n));
  }, []);

  const setSelectedTeam = useCallback((team: string | null) => {
    setSelectedTeamRaw(team);
    const params = new URLSearchParams(window.location.search);
    if (team) {
      params.set('team', team);
    } else {
      params.delete('team');
    }
    const qs = params.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    window.history.pushState({ team }, '', url);
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      setSelectedTeamRaw(e.state?.team ?? null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);


  const configQuery = useQuery({
    queryKey: ['config', CURRENT_YEAR],
    queryFn: () => fetchYearConfig(CURRENT_YEAR),
    staleTime: Infinity,
  });

  const scoresQuery = useQuery({
    queryKey: ['scores'],
    queryFn: fetchScores,
    refetchInterval: 45_000,
  });

  const tournamentQuery = useQuery({
    queryKey: ['tournament'],
    queryFn: fetchTournamentState,
    refetchInterval: 45_000,
  });

  const picksQuery = useQuery({
    queryKey: ['draftPicks', CURRENT_YEAR],
    queryFn: () => fetchDraftPicks(CURRENT_YEAR),
    staleTime: Infinity,
  });

  const shotgunQuery = useQuery({
    queryKey: ['shotgunState', CURRENT_YEAR],
    queryFn: () => fetchShotgunState(CURRENT_YEAR),
    staleTime: 30_000,
  });

  const winProbQuery = useQuery({
    queryKey: ['winProbHistory', CURRENT_YEAR],
    queryFn: async () => {
      const res = await fetch(`/winprobability/${CURRENT_YEAR}`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const isLoading = scoresQuery.isLoading || picksQuery.isLoading || configQuery.isLoading;
  const isError = scoresQuery.isError || picksQuery.isError;

  const standings = scoresQuery.data && picksQuery.data
    ? calculateStandings(scoresQuery.data, picksQuery.data)
    : [];

  const config = configQuery.data;
  const shotgunState: ShotgunState = shotgunQuery.data ?? { completedIds: [], titsAssignedTo: '' };
  const allShotguns = standings.length > 0
    ? computeShotguns(standings, shotgunState, config?.preTournamentShotguns ?? [])
    : [];
  const shotgunsByOwner = getShotgunsByOwner(allShotguns);

  for (const [, data] of shotgunsByOwner) {
    data.completed = data.shotguns.reduce((sum, s) => {
      return sum + (shotgunState.completedIds.includes(s.id) ? s.count : 0);
    }, 0);
  }

  // Chat
  const chat = useChat(!isLoading);

  // Track unread messages for tab title
  const tabActiveRef = useRef(!document.hidden);
  const tabSeenCountRef = useRef(0);

  useEffect(() => {
    const onVisibility = () => {
      tabActiveRef.current = !document.hidden;
      if (!document.hidden) {
        tabSeenCountRef.current = chat.messages.length;
        document.title = 'Masters for Beers';
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [chat.messages.length]);

  useEffect(() => {
    if (tabActiveRef.current) {
      tabSeenCountRef.current = chat.messages.length;
    } else {
      const unread = chat.messages.length - tabSeenCountRef.current;
      document.title = unread > 0 ? `(${unread}) Masters for Beers` : 'Masters for Beers';
    }
  }, [chat.messages.length]);

  // Sound effects for birdies/eagles
  useBirdieSounds(scoresQuery.data ?? [], picksQuery.data ?? {});

  const onToggleShotgun = async (id: string, completed: boolean) => {
    await toggleShotgunComplete(CURRENT_YEAR, id, completed);
    queryClient.invalidateQueries({ queryKey: ['shotgunState'] });
  };

  // Get latest win probability for a team from the stored snapshots
  const tournamentOver = standings.length > 0 && standings.every(t =>
    t.golfers.every(g => g.isCut || g.rounds[3]?.filter(s => s > 0).length === 18)
  );

  const getWinProb = (owner: string): number | null => {
    // When tournament is over, compute directly (winners get 100%)
    if (tournamentOver && standings.length > 0) {
      const topScore = standings[0].totalPoints;
      return standings.find(s => s.owner === owner)?.totalPoints === topScore ? 100 : 0;
    }
    const history = winProbQuery.data;
    if (!history || history.length === 0) return null;
    const latest = history[history.length - 1];
    try {
      const data = typeof latest.data === 'string' ? JSON.parse(latest.data) : latest.data;
      return data[owner]?.winProb ?? null;
    } catch { return null; }
  };

  const selectPlayer = (golferName: string) => {
    const team = standings.find(s => s.golfers.some(g => g.name === golferName));
    if (team) setSelectedTeam(team.owner);
  };

  const scrollToChat = () => {
    chatRef.current?.scrollIntoView({ behavior: 'smooth' });
    setLastSeenCount(chat.messages.length);
    // Try focusing repeatedly until the scroll completes
    const tryFocus = (attempts: number) => {
      if (attempts <= 0) return;
      setTimeout(() => {
        chatInputRef.current?.focus();
        // Check if the input actually got focus, retry if not
        if (document.activeElement?.tagName !== 'INPUT') tryFocus(attempts - 1);
      }, 300);
    };
    tryFocus(5);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <Header theme={theme} onToggleTheme={toggleTheme} onLogoClick={() => setSelectedTeam(null)} soundMuted={soundMuted} onToggleSound={() => setSoundMuted(toggleMute())} />
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-4">
        {isLoading && (
          <div className="text-center py-16 text-sm text-[var(--text-muted)]">
            Loading scores...
          </div>
        )}
        {isError && (
          <div className="text-center py-16 text-sm text-red-400">
            Failed to load data. Retrying...
          </div>
        )}
        {!isLoading && !isError && (
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <div className="flex-1 min-w-0 w-full">
              {selectedTeam ? (
                <TeamDetail
                  standings={standings}
                  owner={selectedTeam}
                  onBack={() => setSelectedTeam(null)}
                  shotguns={shotgunsByOwner.get(selectedTeam)?.shotguns ?? []}
                  completedIds={shotgunState.completedIds}
                  onToggleShotgun={onToggleShotgun}
                  history={config?.history ?? []}
                  winProbability={getWinProb(selectedTeam!)}
                />
              ) : (
                <div className="space-y-4">
                  <Leaderboard
                    standings={standings}
                    onSelectTeam={setSelectedTeam}
                    onSelectPlayer={selectPlayer}
                    shotgunsByOwner={shotgunsByOwner}
                    completedIds={shotgunState.completedIds}
                  />
                  {tournamentQuery.data && picksQuery.data && (
                    <CutWatch
                      tournament={tournamentQuery.data}
                      draftPicks={picksQuery.data}
                      onSelectPlayer={selectPlayer}
                    />
                  )}
                  <WinProbChart />
                  <PlayerRankings
                    players={scoresQuery.data ?? []}
                    draftPicks={picksQuery.data ?? {}}
                    onSelectPlayer={selectPlayer}
                  />
                </div>
              )}
            </div>

            <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
              <LiveFeed
                players={scoresQuery.data ?? []}
                draftPicks={picksQuery.data ?? {}}
                onSelectPlayer={selectPlayer}
              />
              <div ref={chatRef}>
                <ChatPanel
                ref={chatInputRef}
                messages={chat.messages}
                connected={chat.connected}
                disconnected={chat.disconnected}
                activeUsers={chat.activeUsers}
                onSend={chat.sendMessage}
                onJoin={chat.joinChat}
                onChangeName={chat.changeName}
                onReconnect={chat.reconnect}
                onInputFocusChange={(focused) => {
                  setChatInputFocused(focused);
                  if (focused) setLastSeenCount(chat.messages.length);
                }}
              />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Tournament winner overlay */}
      <TournamentOverlay
        standings={standings}
        show={
          new URLSearchParams(window.location.search).has('beta') ||
          tournamentOver
        }
      />

      {/* Floating chat badge */}
      {!chatInputFocused && (
        <button
          onClick={scrollToChat}
          className="fixed bottom-5 right-5 w-12 h-12 rounded-full bg-[var(--masters-green)] text-white shadow-lg flex items-center justify-center cursor-pointer border-none hover:scale-110 transition-transform z-50"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z" />
          </svg>
          {chat.messages.length > lastSeenCount && (
            <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-[10px] font-bold min-w-5 h-5 px-1 rounded-full flex items-center justify-center">
              {chat.messages.length - lastSeenCount > 99 ? '99+' : chat.messages.length - lastSeenCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
