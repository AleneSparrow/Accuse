import type { ChatMessage, GameResult, LobbyState, RoundState } from "./types.js";

export type ServerEvent =
  | { type: "lobby_state"; lobby: LobbyState }
  | { type: "round_state"; round: RoundState }
  | { type: "chat_message"; message: ChatMessage }
  | { type: "game_result"; result: GameResult }
  | { type: "your_role"; isImpostor: boolean; aiSuggestion: string | null }
  | { type: "ai_suggestion"; text: string }
  | { type: "error"; message: string }
  | { type: "kicked" }
  | { type: "pong" };
