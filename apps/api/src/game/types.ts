import type { WebSocket } from "ws";
import type { RoundPhase } from "@accuse/shared";

export interface PlayerConn {
  lobbyPlayerId: string; // Prisma LobbyPlayer.id
  userId: string; // Prisma User.id
  telegramId: string;
  displayName: string;
  avatarUrl: string | null;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
  ws: WebSocket | null;
  wins: number;
  losses: number;
}

export interface RoundAnswerInternal {
  text: string;
  submittedAt: string;
  isAutoSubmitted: boolean;
}

export interface RoundInternal {
  dbRoundId: string;
  roundNumber: number;
  phase: RoundPhase;
  category: string;
  prompt: string;
  impostorPlayerId: string;
  phaseEndsAt: string | null;
  answers: Map<string, RoundAnswerInternal>; // lobbyPlayerId -> answer
  votes: Map<string, string>; // voterLobbyPlayerId -> votedForLobbyPlayerId
  aiSuggestionSent: boolean;
  timer: NodeJS.Timeout | null;
}

export interface LobbyRoom {
  id: string;
  code: string;
  status: "waiting" | "in_progress" | "finished";
  hostUserId: string;
  totalRounds: number;
  currentRoundNumber: number;
  revealNames: boolean;
  players: Map<string, PlayerConn>; // userId -> PlayerConn
  round: RoundInternal | null;
  usedPrompts: Set<string>;
  roundsWon: Map<string, number>; // lobbyPlayerId -> humans-won count (impostor rounds count for impostor player if they win)
  createdAt: string;
}
