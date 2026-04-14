import { useEffect, useRef } from 'react';
import type * as signalR from '@microsoft/signalr';
import type { TeamStanding } from './types';
import { CURRENT_YEAR } from './constants';

export function useLeaderNotifier(
  connection: signalR.HubConnection | null,
  standings: TeamStanding[],
  connected: boolean,
) {
  const prevFirstRef = useRef<string>('');
  const prevLastRef = useRef<string>('');
  const initializedRef = useRef(false);

  useEffect(() => {
    const isMock = new URLSearchParams(window.location.search).has('mock');
    if (!connection || !connected || standings.length === 0 || isMock) return;

    const topScore = standings[0].totalPoints;
    const bottomScore = standings[standings.length - 1].totalPoints;
    const allTied = topScore === bottomScore;

    const firstStr = allTied ? '' : standings.filter(s => s.totalPoints === topScore).map(s => s.owner).sort().join(',');
    const lastStr = allTied ? '' : standings.filter(s => s.totalPoints === bottomScore).map(s => s.owner).sort().join(',');

    // Skip first observation
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevFirstRef.current = firstStr;
      prevLastRef.current = lastStr;
      return;
    }

    // First place changed
    if (firstStr && firstStr !== prevFirstRef.current) {
      const prevFirstSet = new Set(prevFirstRef.current.split(',').filter(Boolean));
      const firstNames = firstStr.split(',');

      for (const owner of firstNames) {
        const isNew = !prevFirstSet.has(owner);
        const wentSolo = !isNew && prevFirstRef.current.includes(',') && !firstStr.includes(',');
        if (isNew) {
          const msg = firstNames.length === 1
            ? `🏆 ${owner} takes the ( . )( . )!`
            : `🏆 ${owner} has their hands on the ( . )( . )!`;
          const id = `leader_first_${firstStr}`;
          connection.invoke('NotifyShotgun', id, msg, CURRENT_YEAR).catch(() => {});
        } else if (wentSolo) {
          const msg = `🏆 ${owner} takes sole possession of the ( . )( . )!`;
          const id = `leader_first_solo_${firstStr}`;
          connection.invoke('NotifyShotgun', id, msg, CURRENT_YEAR).catch(() => {});
        }
      }
    }

    // Last place changed
    if (lastStr && lastStr !== prevLastRef.current) {
      const prevLastSet = new Set(prevLastRef.current.split(',').filter(Boolean));
      const lastNames = lastStr.split(',');

      for (const owner of lastNames) {
        const isNew = !prevLastSet.has(owner);
        const wentSolo = !isNew && prevLastRef.current.includes(',') && !lastStr.includes(',');
        if (isNew) {
          const msg = lastNames.length === 1
            ? `🍆 The 8====D has found a new home with ${owner}!`
            : `🍆 ${owner} grabbed a piece of the 8====D!`;
          const id = `leader_last_${lastStr}`;
          connection.invoke('NotifyShotgun', id, msg, CURRENT_YEAR).catch(() => {});
        } else if (wentSolo) {
          const msg = `🍆 ${owner} is now the sole owner of the 8====D!`;
          const id = `leader_last_solo_${lastStr}`;
          connection.invoke('NotifyShotgun', id, msg, CURRENT_YEAR).catch(() => {});
        }
      }
    }

    prevFirstRef.current = firstStr;
    prevLastRef.current = lastStr;
  }, [connection, connected, standings]);
}
