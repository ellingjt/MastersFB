import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { ChatMessage } from '../useChat';

const USERNAME_KEY = 'masters-chat-username';

interface Props {
  messages: ChatMessage[];
  connected: boolean;
  disconnected: boolean;
  activeUsers: number;
  onSend: (username: string, message: string) => void;
  onJoin: (username: string) => void;
  onChangeName: (oldName: string, newName: string) => void;
  onReconnect: () => void;
  onInputFocusChange?: (focused: boolean) => void;
}

const ChatPanel = forwardRef<{ focus: () => void }, Props>(function ChatPanel(
  { messages, connected, disconnected, activeUsers, onSend, onJoin, onChangeName, onReconnect, onInputFocusChange },
  ref,
) {
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY) ?? '');
  const [isPickingName, setIsPickingName] = useState(() => !localStorage.getItem(USERNAME_KEY));
  const [nameInput, setNameInput] = useState('');
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const messagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const saveName = useCallback(() => {
    const name = nameInput.trim();
    if (!name) return;
    const oldName = username;
    localStorage.setItem(USERNAME_KEY, name);
    setUsername(name);
    setIsPickingName(false);
    if (oldName && oldName !== name) {
      onChangeName(oldName, name);
    } else {
      onJoin(name);
    }
  }, [nameInput, username, onJoin, onChangeName]);

  // Auto-join when connected with existing username
  const hasJoined = useRef(false);
  useEffect(() => {
    if (connected && username && !isPickingName && !hasJoined.current) {
      hasJoined.current = true;
      onJoin(username);
    }
  }, [connected, username, isPickingName, onJoin]);

  const sendMessage = useCallback(() => {
    const text = draft.trim();
    if (!text || !connected) return;
    setDraft('');
    onSend(username, text);
  }, [draft, username, connected, onSend]);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  };

  if (isPickingName) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden flex flex-col flex-1">
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">Chat</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3">
          <p className="text-xs text-[var(--text-muted)] text-center">Pick a name to join chat</p>
          <div className="flex gap-2 w-full max-w-[200px]">
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              placeholder="Your name..."
              autoFocus
              className="flex-1 text-xs border border-[var(--border-light)] rounded px-2.5 py-1.5 bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--masters-green)]"
            />
            <button
              onClick={saveName}
              className="text-xs bg-[var(--masters-green)] text-white px-3 py-1.5 rounded border-none cursor-pointer hover:opacity-90"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">Chat</h2>
          {activeUsers > 0 && (
            <span className="text-[10px] text-[var(--text-muted)]">({activeUsers})</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {connected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
          <span className="text-[10px] text-[var(--text-muted)]">{username}</span>
          <button
            onClick={() => { setIsPickingName(true); setNameInput(username); }}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer p-0 underline"
          >
            change
          </button>
        </div>
      </div>

      <div ref={messagesRef} className="flex-1 overflow-y-auto sidebar-scroll relative max-h-[300px] lg:max-h-[400px]">
        {disconnected && (
          <div className="sticky top-0 z-10 bg-red-500/10 border-b border-red-500/20 px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] text-red-400">Disconnected</span>
            <button
              onClick={onReconnect}
              className="text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/25 rounded px-2 py-0.5 cursor-pointer"
            >
              Reconnect
            </button>
          </div>
        )}
        {messages.length === 0 && !disconnected && (
          <div className="p-4 text-center text-xs text-[var(--text-muted)]">No messages yet</div>
        )}
        {messages.map((msg, i) => (
          msg.type === 'system' ? (
            <div key={i} className="px-3 py-1.5 text-center">
              <span className="text-[10px] text-[var(--text-muted)] italic">{msg.message}</span>
            </div>
          ) : (
            <div key={i} className="px-3 py-1.5 text-xs hover:bg-[var(--bg-card-hover)]">
              <div className="flex items-baseline gap-1.5">
                <span className="font-semibold text-[var(--gold)]">{msg.username}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{formatTime(msg.sentAt)}</span>
              </div>
              <div className="text-[var(--text-primary)] break-words mt-0.5">{msg.message}</div>
            </div>
          )
        ))}
      </div>

      <div className="border-t border-[var(--border)] p-2 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            onFocus={() => onInputFocusChange?.(true)}
            onBlur={() => onInputFocusChange?.(false)}
            placeholder="Type a message..."
            className="flex-1 text-xs border border-[var(--border)] rounded px-2.5 py-1.5 bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--masters-green)]"
          />
          <button
            onClick={sendMessage}
            disabled={!connected || !draft.trim()}
            className="text-xs bg-[var(--masters-green)] text-white px-3 py-1.5 rounded border-none cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
});

export default ChatPanel;
