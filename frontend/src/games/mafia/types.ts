export type Role = 'citizen' | 'mafia' | 'doctor' | 'police';
export type Phase =
  | 'lobby'
  | 'roleReveal'
  | 'day'
  | 'vote'
  | 'voteResult'
  | 'night'
  | 'result';

export interface Player {
  id: string;
  name: string;
  role: Role;
  alive: boolean;
  isMe: boolean;
  voteTarget?: string;
  seat: number;
}

export interface GameState {
  phase: Phase;
  players: Player[];
  dayCount: number;
  timer: number;
  chatLog: ChatMessage[];
  winner?: 'mafia' | 'citizen';
  eliminatedThisRound?: string;
}

export interface ChatMessage {
  playerId: string;
  text: string;
  timestamp: number;
  isMafia?: boolean;
}
