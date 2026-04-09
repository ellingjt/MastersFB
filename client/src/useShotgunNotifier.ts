import { useEffect, useRef } from 'react';
import type * as signalR from '@microsoft/signalr';
import type { Shotgun } from './shotguns';
import { CURRENT_YEAR } from './constants';
import { playBeerSound } from './sounds';

/**
 * Watches the shotgun list and calls NotifyShotgun on the hub
 * for any newly appearing shotguns. The hub deduplicates server-side.
 */
export function useShotgunNotifier(
  connection: signalR.HubConnection | null,
  shotguns: Shotgun[],
  connected: boolean,
) {
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const isMock = new URLSearchParams(window.location.search).has('mock');
    if (!connection || !connected || shotguns.length === 0 || isMock) return;

    const currentIds = new Set(shotguns.map(s => s.id));
    const prevIds = prevIdsRef.current;

    for (const s of shotguns) {
      // Skip pre-tournament shotguns — not useful in chat
      if (s.id.startsWith('pre_')) continue;
      if (!prevIds.has(s.id)) {
        // New shotgun detected — notify hub (hub will deduplicate)
        const msg = formatShotgunMessage(s);
        connection.invoke('NotifyShotgun', s.id, msg, CURRENT_YEAR).catch(() => {});
        playBeerSound();
      }
    }

    prevIdsRef.current = currentIds;
  }, [connection, connected, shotguns]);
}

function formatShotgunMessage(s: Shotgun): string {
  const count = s.count > 1 ? `${s.count} shotguns` : 'a shotgun';
  return `🍺 ${s.owner} owes ${count} — ${s.reason}`;
}
