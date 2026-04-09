import { useState, useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { CURRENT_YEAR } from './constants';
import { playDoorOpen } from './sounds';

export interface ChatMessage {
  username: string;
  message: string;
  type: 'user' | 'system';
  sentAt: string;
}

export function useChat(active: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState(0);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const loadHistory = useCallback(() => {
    fetch(`/chat/${CURRENT_YEAR}?last=100`)
      .then(r => r.json())
      .then((msgs: ChatMessage[]) => setMessages(msgs))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!active) return;

    loadHistory();

    const conn = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/chat')
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .build();

    conn.on('ReceiveMessage', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      if (msg.type === 'system' && msg.message.includes('joined the chat')) {
        playDoorOpen();
      }
    });

    conn.on('UserCountChanged', (count: number) => {
      setActiveUsers(count);
    });

    conn.start()
      .then(() => { setConnected(true); setDisconnected(false); })
      .catch(() => { setDisconnected(true); });

    conn.onreconnecting(() => { setConnected(false); });
    conn.onreconnected(() => {
      setConnected(true);
      setDisconnected(false);
      loadHistory(); // Refresh messages we may have missed
    });
    conn.onclose(() => {
      setConnected(false);
      setDisconnected(true);
    });

    connectionRef.current = conn;

    return () => { conn.stop(); };
  }, [active, loadHistory]);

  // Reconnect when the page becomes visible again (phone unlock, tab switch)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const conn = connectionRef.current;
      if (!conn) return;
      if (conn.state === signalR.HubConnectionState.Disconnected) {
        conn.start()
          .then(() => { setConnected(true); setDisconnected(false); loadHistory(); })
          .catch(() => { setDisconnected(true); });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loadHistory]);

  const reconnect = useCallback(async () => {
    const conn = connectionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Disconnected) return;
    try {
      await conn.start();
      setConnected(true);
      setDisconnected(false);
      loadHistory();
    } catch {
      setDisconnected(true);
    }
  }, [loadHistory]);

  const sendMessage = async (username: string, text: string) => {
    if (!connectionRef.current || !connected || !text.trim()) return;
    await connectionRef.current.invoke('SendMessage', username, text.trim(), CURRENT_YEAR);
  };

  const joinChat = async (username: string) => {
    if (!connectionRef.current || !connected) return;
    await connectionRef.current.invoke('JoinChat', username, CURRENT_YEAR);
  };

  const changeName = async (oldName: string, newName: string) => {
    if (!connectionRef.current || !connected) return;
    await connectionRef.current.invoke('ChangeName', oldName, newName, CURRENT_YEAR);
  };

  return {
    messages,
    connected,
    disconnected,
    activeUsers,
    sendMessage,
    joinChat,
    changeName,
    reconnect,
    connection: connectionRef.current,
  };
}
