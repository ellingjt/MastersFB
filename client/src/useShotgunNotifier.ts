import { useEffect, useRef } from 'react';
import type * as signalR from '@microsoft/signalr';
import type { Shotgun, BogeyWatch } from './shotguns';
import { CURRENT_YEAR } from './constants';
import { playBeerSound } from './sounds';

/**
 * Watches the shotgun list and bogey watches, notifying chat via the hub.
 * The hub deduplicates server-side.
 */
export function useShotgunNotifier(
  connection: signalR.HubConnection | null,
  shotguns: Shotgun[],
  bogeyWatches: BogeyWatch[],
  connected: boolean,
) {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const prevWatchIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const isMock = new URLSearchParams(window.location.search).has('mock');
    if (!connection || !connected || isMock) return;

    // Shotgun notifications
    const currentIds = new Set(shotguns.map(s => s.id));
    const prevIds = prevIdsRef.current;

    for (const s of shotguns) {
      if (s.id.startsWith('pre_')) continue;
      if (!prevIds.has(s.id)) {
        const msg = formatShotgunMessage(s);
        connection.invoke('NotifyShotgun', s.id, msg, CURRENT_YEAR).catch(() => {});
        playBeerSound();
      }
    }
    prevIdsRef.current = currentIds;

    // Bogey watch notifications
    const currentWatchIds = new Set(bogeyWatches.map(w => w.id));
    const prevWatchIds = prevWatchIdsRef.current;

    for (const w of bogeyWatches) {
      if (!prevWatchIds.has(w.id)) {
        const msg = `⚠️ BOGEY WATCH: ${w.owner}'s team — R${w.round} hole ${w.hole}. ${w.lastGolfer.split(' ').pop()} needs to save it!`;
        connection.invoke('NotifyShotgun', w.id, msg, CURRENT_YEAR).catch(() => {});
      }
    }
    prevWatchIdsRef.current = currentWatchIds;
  }, [connection, connected, shotguns, bogeyWatches]);
}

function formatShotgunMessage(s: Shotgun): string {
  const count = s.count > 1 ? `${s.count} shotguns` : 'a shotgun';
  return `🍺 ${s.owner} owes ${count} — ${s.reason}`;
}
