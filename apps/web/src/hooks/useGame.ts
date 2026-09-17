import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, GameResult, LobbyState, RoundState } from "@accuse/shared";
import { GameSocket } from "../lib/ws";

export interface GameHook {
  lobby: LobbyState | null;
  round: RoundState | null;
  chat: ChatMessage[];
  result: GameResult | null;
  role: { isImpostor: boolean } | null;
  aiSuggestion: string | null;
  error: string | null;
  clearError: () => void;
  send: GameSocket["send"];
}

export function useGame(lobbyId: string | null): GameHook {
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [round, setRound] = useState<RoundState | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [role, setRole] = useState<{ isImpostor: boolean } | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<GameSocket | null>(null);

  useEffect(() => {
    if (!lobbyId) return;
    const socket = new GameSocket(lobbyId);
    socketRef.current = socket;

    const unsubscribe = socket.on((event) => {
      const e = event as { type: string } & Record<string, unknown>;
      switch (e.type) {
        case "lobby_state":
          setLobby(e.lobby as LobbyState);
          break;
        case "round_state":
          setRound(e.round as RoundState);
          break;
        case "chat_message":
          setChat((prev) => [...prev.slice(-99), e.message as ChatMessage]);
          break;
        case "game_result":
          setResult(e.result as GameResult);
          break;
        case "your_role":
          setRole({ isImpostor: Boolean(e.isImpostor) });
          break;
        case "ai_suggestion":
          setAiSuggestion(e.text as string);
          break;
        case "error":
          setError(e.message as string);
          break;
        case "kicked":
          setError("You were removed from the lobby.");
          break;
      }
    });

    return () => {
      unsubscribe();
      socket.close();
      socketRef.current = null;
    };
  }, [lobbyId]);

  // Reset round-scoped state on a fresh round or a rematch back to waiting.
  useEffect(() => {
    if (lobby?.status === "waiting") {
      setRound(null);
      setResult(null);
      setRole(null);
      setAiSuggestion(null);
      setChat([]);
    }
  }, [lobby?.status]);

  const send = useMemo(() => (msg: Parameters<GameSocket["send"]>[0]) => socketRef.current?.send(msg), []);

  return { lobby, round, chat, result, role, aiSuggestion, error, clearError: () => setError(null), send };
}
