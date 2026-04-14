import { useState, useEffect } from 'react';

interface Snapshot {
  timestamp: string;
  data: string; // JSON: { "teamName": { points, winProb } }
}

interface ParsedPoint {
  time: Date;
  teams: Record<string, { points: number; winProb: number }>;
}

// Distinct colors for each team — colorblind friendly
const TEAM_COLORS: Record<string, string> = {
  'Dan F': '#f59e0b',  // amber
  'Josh': '#3b82f6',   // blue
  'Rich': '#8b5cf6',   // violet
  'Matt': '#ec4899',   // pink
  'Dan S': '#14b8a6',  // teal
  'Cory': '#c8a951',   // gold
  'Seth': '#f97316',   // orange
  'Bill': '#6366f1',   // indigo
  'Eric': '#22d3ee',   // cyan
  'Dan R': '#a3e635',  // lime
};

export default function WinProbChart() {
  const [data, setData] = useState<ParsedPoint[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);

  useEffect(() => {
    fetch('/winprobability/2026')
      .then(r => r.json())
      .then((snapshots: Snapshot[]) => {
        const parsed: ParsedPoint[] = snapshots.map(s => ({
          time: new Date(s.timestamp),
          teams: JSON.parse(s.data),
        }));
        setData(parsed);
      })
      .catch(() => {});
  }, []);

  if (data.length < 2) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">Win Probability</h2>
        </div>
        <div className="p-4 text-center text-xs text-[var(--text-muted)]">
          Not enough data yet — chart will appear as the tournament progresses.
        </div>
      </div>
    );
  }

  const teamNames = Object.keys(data[0].teams);

  // Chart dimensions
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Use index-based x-axis (each snapshot = evenly spaced point)
  const xScale = (idx: number) => padding.left + (idx / (data.length - 1)) * chartW;
  const yScale = (pct: number) => padding.top + chartH - (pct / 100) * chartH;

  // Build paths
  const paths: { name: string; d: string; color: string; lastPct: number }[] = teamNames.map(name => {
    const points = data.map((d, idx) => {
      const pct = d.teams[name]?.winProb ?? 0;
      return { x: xScale(idx), y: yScale(pct), pct };
    });
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return {
      name,
      d,
      color: TEAM_COLORS[name] ?? '#888',
      lastPct: points[points.length - 1].pct,
    };
  });

  // Sort by last percentage descending for legend
  const sortedPaths = [...paths].sort((a, b) => b.lastPct - a.lastPct);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div
        className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className={`text-[var(--text-muted)] text-xs transition-transform ${collapsed ? '' : 'rotate-90'}`}>&#9654;</span>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] m-0">Win Probability</h2>
        </div>
      </div>
      {!collapsed && (
        <div className="p-4">
          {/* Chart */}
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full"
            >
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map(pct => (
                <g key={pct}>
                  <line
                    x1={padding.left} y1={yScale(pct)}
                    x2={width - padding.right} y2={yScale(pct)}
                    stroke="var(--border)" strokeWidth="1"
                  />
                  <text
                    x={padding.left - 5} y={yScale(pct) + 4}
                    textAnchor="end" fontSize="10" fill="var(--text-muted)"
                  >
                    {pct}%
                  </text>
                </g>
              ))}

              {/* Lines */}
              {paths.map(p => (
                <path
                  key={p.name}
                  d={p.d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={hoveredTeam === p.name ? 3 : 1.5}
                  opacity={hoveredTeam && hoveredTeam !== p.name ? 0.2 : 1}
                  style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
                />
              ))}

            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
            {sortedPaths.map(p => (
              <div
                key={p.name}
                className="flex items-center gap-1.5 text-[11px] cursor-pointer"
                onMouseEnter={() => setHoveredTeam(p.name)}
                onMouseLeave={() => setHoveredTeam(null)}
              >
                <div className="w-3 h-1.5 rounded-sm" style={{ backgroundColor: p.color }} />
                <span className={`${hoveredTeam === p.name ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'} transition-colors`}>
                  {p.name} ({p.lastPct.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
