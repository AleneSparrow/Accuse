import type { SCENARIO_CATEGORIES } from "./constants.js";
export type ScenarioCategory = (typeof SCENARIO_CATEGORIES)[number];

export type LobbyStatus = "waiting" | "in_progress" | "finished";

export type RoundPhase = "prompt" | "answer" | "debate" | "vote" | "reveal";

export interface PublicPlayer {
  id: string;
  telegramId: string;
  displayName: string;
  avatarUrl: string | null;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
  wins: number;
  losses: number;
  isSupporter: boolean;
}

export interface LobbyState {
  id: string;
  code: string;
  status: LobbyStatus;
  hostId: string;
  totalRounds: number;
  currentRound: number;
  players: PublicPlayer[];
  createdAt: string;
}

export interface RoundAnswer {
  playerId: string;
  text: string;
  submittedAt: string;
  isAutoSubmitted: boolean;
}

export interface RoundState {
  roundNumber: number;
  phase: RoundPhase;
  scenario: {
    category: ScenarioCategory;
    prompt: string;
  };
  phaseEndsAt: string | null;
  answers: RoundAnswer[];
  revealNames: boolean;
  votes?: Record<string, string>; // voterId -> votedForId (only visible after reveal)
  impostorId?: string; // only present in reveal
}

export interface ChatMessage {
  id: string;
  playerId: string;
  displayName: string;
  text: string;
  sentAt: string;
}

export interface ScoreboardEntry {
  playerId: string;
  displayName: string;
  avatarUrl: string | null;
  wasImpostor: boolean;
  correctVote: boolean;
  roundsWon: number;
}

export interface GameResult {
  impostorId: string;
  impostorCaught: boolean;
  scoreboard: ScoreboardEntry[];
}
