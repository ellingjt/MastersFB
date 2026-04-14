export interface Player {
  fullName: string;
  round1: string; // pipe-separated hole scores "4|3|5|..."
  round2: string;
  round3: string;
  round4: string;
  teeTime: string;
  toPar: string;
  status: string;
}

export interface TournamentState {
  currentRound: number;
  players: Player[];
  projectedCutLine: number | null;
}

export interface TeamStanding {
  owner: string;
  golfers: GolferScore[];
  totalPoints: number;
  roundPoints: [number, number, number, number];
}

export interface GolferScore {
  name: string;
  rounds: number[][]; // 4 rounds x 18 holes
  totalStrokes: number;
  holesPlayed: number;
  isCut: boolean;
  teeTime: string;
}

export interface HoleResult {
  hole: number;
  par: number;
  bestScore: number | null;
  points: number;
  contributor: string | null;
}

// Draft picks: { "Josh": ["Golfer1", "Golfer2", ...] }
export type DraftPicks = Record<string, string[]>;
