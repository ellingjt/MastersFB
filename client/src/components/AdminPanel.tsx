import { useState } from 'react';
import { CURRENT_YEAR } from '../constants';

export default function AdminPanel() {
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const clearChat = async () => {
    const res = await fetch(`/chat/${CURRENT_YEAR}`, { method: 'DELETE' });
    const data = await res.json();
    addLog(`Cleared ${data.deleted} chat messages`);
  };

  const seedNotifications = async () => {
    const configRes = await fetch(`/config/${CURRENT_YEAR}`);
    const config = await configRes.json();
    const ids = config.preTournamentShotguns.map((s: { id: string }) => s.id);
    const res = await fetch(`/chat/${CURRENT_YEAR}/mark-notified`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids),
    });
    const data = await res.json();
    addLog(`Marked ${data.marked} pre-tournament shotguns as notified`);
  };

  const seedDraftPicks = async () => {
    const res = await fetch(`/config/${CURRENT_YEAR}/seed`, { method: 'POST' });
    const data = await res.json();
    addLog(`Seeded ${data.draftPicks} draft picks for ${data.year}`);
  };

  const viewShotgunState = async () => {
    const res = await fetch(`/shotguns/${CURRENT_YEAR}`);
    const data = await res.json();
    addLog(`Shotgun state: ${data.completedIds.length} completed, tits assigned to: ${data.titsAssignedTo || '(none)'}`);
    addLog(`  IDs: ${data.completedIds.join(', ') || '(none)'}`);
  };

  const resetShotgunCompletions = async () => {
    if (!confirm('Reset all shotgun completions? This cannot be undone.')) return;
    // Get current state and remove all
    const res = await fetch(`/shotguns/${CURRENT_YEAR}`);
    const data = await res.json();
    for (const id of data.completedIds) {
      await fetch(`/shotguns/${CURRENT_YEAR}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completed: false }),
      });
    }
    addLog(`Reset ${data.completedIds.length} shotgun completions`);
  };

  const markShotgunComplete = async () => {
    const id = prompt('Shotgun ID to mark complete:');
    if (!id) return;
    await fetch(`/shotguns/${CURRENT_YEAR}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, completed: true }),
    });
    addLog(`Marked "${id}" as complete`);
  };

  const assignTits = async () => {
    const name = prompt('Assign tits shotgun to (owner name):');
    if (!name) return;
    await fetch(`/shotguns/${CURRENT_YEAR}/tits-assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTo: name }),
    });
    addLog(`Assigned tits shotgun to "${name}"`);
  };

  const checkPolling = async () => {
    const res = await fetch('/masters/polling');
    const data = await res.json();
    addLog(`Polling is ${data.enabled ? 'ENABLED' : 'DISABLED'}`);
  };

  const togglePolling = async (enabled: boolean) => {
    const res = await fetch('/masters/polling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    addLog(`Polling ${data.enabled ? 'ENABLED' : 'DISABLED'}`);
  };

  const viewConfig = async () => {
    const res = await fetch(`/config/${CURRENT_YEAR}`);
    const data = await res.json();
    addLog(`Config loaded: ${Object.keys(data.draftPicks).length} teams, ${data.preTournamentShotguns.length} pre-tournament shotguns, ${data.history.length} history entries`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold m-0">Admin Panel</h1>
          <a href="/" className="text-xs text-[var(--gold)] no-underline hover:underline">&larr; Back to app</a>
        </div>

        <div className="space-y-4">
          {/* Polling */}
          <Section title="Masters.com Polling">
            <Btn onClick={checkPolling}>Check status</Btn>
            <Btn onClick={() => togglePolling(true)}>Enable polling</Btn>
            <Btn onClick={() => togglePolling(false)} color="red">Disable polling</Btn>
          </Section>

          {/* Chat */}
          <Section title="Chat">
            <Btn onClick={clearChat} color="red">Clear all chat messages</Btn>
            <Btn onClick={seedNotifications}>Seed notification dedup (pre-tournament)</Btn>
          </Section>

          {/* Shotguns */}
          <Section title="Shotguns">
            <Btn onClick={viewShotgunState}>View shotgun state</Btn>
            <Btn onClick={markShotgunComplete}>Mark a shotgun complete</Btn>
            <Btn onClick={assignTits}>Assign tits shotgun</Btn>
            <Btn onClick={resetShotgunCompletions} color="red">Reset all completions</Btn>
          </Section>

          {/* Data */}
          <Section title="Data">
            <Btn onClick={viewConfig}>View year config</Btn>
            <Btn onClick={seedDraftPicks}>Re-seed draft picks from config</Btn>
          </Section>

          {/* Log */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">Log</h2>
              {log.length > 0 && (
                <button onClick={() => setLog([])} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer underline">
                  Clear
                </button>
              )}
            </div>
            <div className="p-3 max-h-[300px] overflow-y-auto sidebar-scroll font-mono text-[11px] text-[var(--text-secondary)] space-y-1">
              {log.length === 0 && <div className="text-[var(--text-muted)]">No actions yet</div>}
              {log.map((entry, i) => (
                <div key={i} className="whitespace-pre-wrap">{entry}</div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 text-[10px] text-[var(--text-muted)]">
          Year: {CURRENT_YEAR} &middot; API: {window.location.origin}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">{title}</h2>
      </div>
      <div className="p-3 flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

function Btn({ onClick, children, color }: { onClick: () => void; children: React.ReactNode; color?: 'red' }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded border cursor-pointer transition-colors ${
        color === 'red'
          ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
          : 'border-[var(--border-light)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--masters-green)]'
      }`}
    >
      {children}
    </button>
  );
}
