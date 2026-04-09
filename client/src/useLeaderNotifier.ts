import { useEffect, useRef } from 'react';
import type * as signalR from '@microsoft/signalr';
import type { TeamStanding } from './types';
import { CURRENT_YEAR } from './constants';

export function useLeaderNotifier(
  connection: signalR.HubConnection | null,
  standings: TeamStanding[],
  connected: boolean,
) {
  const prevStateRef = useRef<string | null>(null);

  useEffect(() => {
    const isMock = new URLSearchParams(window.location.search).has('mock');
    if (!connection || !connected || standings.length === 0 || isMock) return;

    const topScore = standings[0].totalPoints;
    const bottomScore = standings[standings.length - 1].totalPoints;
    const allTied = topScore === bottomScore;

    const firstNames = allTied ? [] : standings.filter(s => s.totalPoints === topScore).map(s => s.owner).sort();
    const lastNames = allTied ? [] : standings.filter(s => s.totalPoints === bottomScore).map(s => s.owner).sort();

    const stateKey = `${firstNames.join(',')}|${lastNames.join(',')}`;

    const prevState = prevStateRef.current;
    prevStateRef.current = stateKey;

    // Skip first observation
    if (prevState === null) return;
    // No change
    if (prevState === stateKey) return;

    const prevFirstNames = prevState.split('|')[0].split(',').filter(Boolean);
    const prevLastNames = prevState.split('|')[1].split(',').filter(Boolean);
    const prevFirstSet = new Set(prevFirstNames);
    const prevLastSet = new Set(prevLastNames);

    // Detect first place changes
    const firstChanged = firstNames.join(',') !== prevFirstNames.join(',');
    if (firstChanged && firstNames.length > 0) {
      for (const owner of firstNames) {
        const isNew = !prevFirstSet.has(owner);
        const wentSolo = !isNew && prevFirstNames.length > 1 && firstNames.length === 1;
        if (isNew) {
          const msg = firstNames.length === 1
            ? `🏆 ${owner} takes the ( . )( . )!`
            : `🏆 ${owner} has their hands on the ( . )( . )!`;
          const id = `leader_first_${owner}_${topScore}_${firstNames.length}`;
          connection.invoke('NotifyShotgun', id, msg, CURRENT_YEAR).catch(() => {});
        } else if (wentSolo) {
          const msg = `🏆 ${owner} takes sole possession of the ( . )( . )!`;
          const id = `leader_first_solo_${owner}_${topScore}`;
          connection.invoke('NotifyShotgun', id, msg, CURRENT_YEAR).catch(() => {});
        }
      }
    }

    // Detect last place changes
    const lastChanged = lastNames.join(',') !== prevLastNames.join(',');
    if (lastChanged && lastNames.length > 0) {
      for (const owner of lastNames) {
        const isNew = !prevLastSet.has(owner);
        const wentSolo = !isNew && prevLastNames.length > 1 && lastNames.length === 1;
        if (isNew) {
          const msg = lastNames.length === 1
            ? `🍆 The 8====D has found a new home with ${owner}!`
            : `🍆 ${owner} grabbed a piece of the 8====D!`;
          const id = `leader_last_${owner}_${bottomScore}_${lastNames.length}`;
          connection.invoke('NotifyShotgun', id, msg, CURRENT_YEAR).catch(() => {});
        } else if (wentSolo) {
          const msg = `🍆 ${owner} is now the sole owner of the 8====D!`;
          const id = `leader_last_solo_${owner}_${bottomScore}`;
          connection.invoke('NotifyShotgun', id, msg, CURRENT_YEAR).catch(() => {});
        }
      }
    }
  }, [connection, connected, standings]);
}
