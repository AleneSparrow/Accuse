import type { LobbyState } from "@accuse/shared";
import { getInitData } from "./telegram";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export function createLobby(totalRounds?: number) {
  return post<{ lobby: LobbyState }>("/api/lobby", { initData: getInitData(), totalRounds });
}

export function joinLobby(code: string) {
  return post<{ lobby: LobbyState }>("/api/lobby/join", { initData: getInitData(), code });
}

export async function fetchLeaderboard() {
  const res = await fetch(`${API_URL}/api/leaderboard`);
  if (!res.ok) throw new ApiError("Failed to load leaderboard");
  return (await res.json()) as {
    leaderboard: { telegramId: string; displayName: string; avatarUrl: string | null; wins: number; losses: number }[];
  };
}
