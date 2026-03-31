export interface RoundData {
  roundNumber: number;
  theme: string;
  categories: string[];
  items: { name: string; category: string }[];
  explanation: string;
}

export interface GameState {
  rounds: RoundData[];
  currentRound: number;
  scores: number[]; // per-round scores (0 or 1 per item)
  completed: boolean;
  date: string;
  started?: boolean;
  username?: string;
  scoreSubmitted?: boolean;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  date: string;
}
