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

    // Group new shotguns by owner to batch cut notifications
    const newByOwner = new Map<string, Shotgun[]>();
    for (const s of shotguns) {
      if (s.id.startsWith('pre_')) continue;
      if (!prevIds.has(s.id)) {
        if (!newByOwner.has(s.owner)) newByOwner.set(s.owner, []);
        newByOwner.get(s.owner)!.push(s);
      }
    }

    for (const [owner, ownerShotguns] of newByOwner) {
      const cuts = ownerShotguns.filter(s => s.id.startsWith('cut_'));
      const others = ownerShotguns.filter(s => !s.id.startsWith('cut_'));

      // Send grouped cut notification
      if (cuts.length > 0) {
        const names = cuts.map(s => s.reason.replace(' missed the cut', ''));
        const count = cuts.length;
        const msg = count === 1
          ? `🍺 ${owner} owes a shotgun — ${names[0]} missed the cut`
          : `🍺 ${owner} owes ${count} shotguns — ${names.join(', ')} missed the cut`;
        const id = `cut_batch_${owner}_${cuts.map(s => s.id).sort().join('_')}`;
        connection.invoke('NotifyShotgun', id, msg, CURRENT_YEAR).catch(() => {});
        playBeerSound();
      }

      // Send individual non-cut notifications
      for (const s of others) {
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
