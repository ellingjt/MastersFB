import { useEffect, useRef } from 'react';
import type { Player, DraftPicks } from './types';
import { detectBirdiesAndEagles } from './scoring';
import { playCrowdRoar } from './sounds';

export function useBirdieSounds(players: Player[], draftPicks: DraftPicks) {
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!players.length || !Object.keys(draftPicks).length) return;

    const events = detectBirdiesAndEagles(players, draftPicks);
    const eagleCount = events.filter(e => e.label === 'Eagle' || e.label === 'Albatross').length;

    if (prevCountRef.current === null) {
      prevCountRef.current = eagleCount;
      return;
    }

    if (eagleCount > prevCountRef.current) {
      playCrowdRoar();
    }

    prevCountRef.current = eagleCount;
  }, [players, draftPicks]);
}
