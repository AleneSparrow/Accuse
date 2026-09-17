import { z } from "zod";
import { MAX_ANSWER_LENGTH, MAX_CHAT_MESSAGE_LENGTH } from "./constants.js";

export const telegramInitDataSchema = z.object({
  initData: z.string().min(1, "initData is required"),
});

export const createLobbySchema = z.object({
  initData: z.string().min(1),
  totalRounds: z.number().int().min(1).max(6).optional(),
});

export const createSupporterInvoiceSchema = z.object({
  initData: z.string().min(1),
});

export const joinLobbySchema = z.object({
  initData: z.string().min(1),
  code: z.string().min(4).max(8),
});

// ---- WebSocket client -> server messages ----

export const wsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("auth"), initData: z.string(), lobbyId: z.string() }),
  z.object({ type: z.literal("ready"), isReady: z.boolean() }),
  z.object({ type: z.literal("start_game") }),
  z.object({ type: z.literal("kick_player"), playerId: z.string() }),
  z.object({ type: z.literal("submit_answer"), text: z.string().min(1).max(MAX_ANSWER_LENGTH) }),
  z.object({ type: z.literal("request_ai_suggestion") }),
  z.object({ type: z.literal("chat_message"), text: z.string().min(1).max(MAX_CHAT_MESSAGE_LENGTH) }),
  z.object({ type: z.literal("cast_vote"), votedForId: z.string() }),
  z.object({ type: z.literal("toggle_reveal_names"), revealNames: z.boolean() }),
  z.object({ type: z.literal("rematch") }),
  z.object({ type: z.literal("ping") }),
]);

export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

// ---- WebSocket server -> client messages are untyped-passthrough of shared types ----
// (kept loose here; see ServerEvent union in types.ts consumers)
