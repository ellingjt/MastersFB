import { useRef, useState, useEffect } from 'react';
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

interface FeedEvent {
  key: string;
  owner: string;
  golfer: string;
  hole: number;
  round: number;
  label: string;
}

function eventKey(e: { golfer: string; hole: number; round: number }) {
  return `${e.golfer}_R${e.round}H${e.hole}`;
}

const STORAGE_KEY = 'masters-live-feed';

function loadStoredFeed(): FeedEvent[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveStoredFeed(feed: FeedEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(feed));
}

export default function LiveFeed({ players, draftPicks, onSelectPlayer }: Props) {
  const rawEvents = detectBirdiesAndEagles(players, draftPicks);
  const [feed, setFeed] = useState<FeedEvent[]>(loadStoredFeed);
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (rawEvents.length === 0) return;

    const currentKeys = new Set(rawEvents.map(eventKey));
    const feedKeys = new Set(feed.map(e => e.key));

    // Find genuinely new events (in current data but not in our stored feed)
    const newEvents: FeedEvent[] = [];
    for (const e of rawEvents) {
      const k = eventKey(e);
      if (!feedKeys.has(k)) {
        newEvents.push({ key: k, owner: e.owner, golfer: e.golfer, hole: e.hole, round: e.round, label: e.label });
      }
    }

    // Remove events that are no longer in the data (e.g. score correction)
    const surviving = feed.filter(e => currentKeys.has(e.key));

    if (newEvents.length > 0 || surviving.length !== feed.length) {
      // Sort new events by recency before prepending (match main sort order)
      const eventMap = new Map(rawEvents.map(e => [eventKey(e), e]));
      newEvents.sort((a, b) => {
        const ea = eventMap.get(a.key);
        const eb = eventMap.get(b.key);
        if (!ea || !eb) return 0;
        return eb.round - ea.round || ea.recency - eb.recency || ea.apiOrder - eb.apiOrder || (eb.par - eb.score) - (ea.par - ea.score);
      });

      const updated = [...newEvents, ...surviving];
      setFeed(updated);
      saveStoredFeed(updated);

      // Only flash if not first load
      if (initializedRef.current) {
        setNewKeys(new Set(newEvents.map(e => e.key)));
        setTimeout(() => setNewKeys(new Set()), 2000);
      }
    }

    initializedRef.current = true;
  }, [rawEvents]);

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden bg-[var(--bg-card)] flex flex-col">
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">Live Feed</h2>
        {feed.length > 0 && (
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{feed.length}</span>
        )}
      </div>
      {feed.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-[var(--text-muted)]">
          No birdies or eagles yet.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)]/50 overflow-y-auto max-h-[200px] lg:max-h-[30vh] sidebar-scroll">
          {feed.map((e) => {
            const isNew = newKeys.has(e.key);
            return (
              <div
                key={e.key}
                className={`px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer ${isNew ? 'animate-flash-green' : ''}`}
                onClick={() => onSelectPlayer(e.golfer)}
              >
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${labelStyle(e.label)}`}>
                  {shortLabel(e.label)}
                </span>
                <div className="flex-1 min-w-0 truncate">
                  <span className="font-medium text-[var(--text-primary)]">{e.golfer}</span>
                  <span className="text-[var(--text-muted)] ml-1">#{e.hole} R{e.round}</span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] shrink-0">{e.owner}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function shortLabel(l: string) {
  if (l === 'Albatross') return 'Alb';
  return l;
}
