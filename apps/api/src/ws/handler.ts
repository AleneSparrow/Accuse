import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { wsClientMessageSchema, CHAT_RATE_LIMIT_PER_10S } from "@accuse/shared";
import { env } from "../env.js";
import { validateInitData, telegramDisplayName, InitDataError } from "../telegram/initData.js";
import { lobbyManager, GameError } from "../game/manager.js";
import type { LobbyRoom } from "../game/types.js";

interface ConnState {
  room: LobbyRoom;
  userId: string;
  chatTimestamps: number[];
}

export function registerWebsocket(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (socket) => {
    const ws = socket as unknown as WebSocket;
    let state: ConnState | null = null;

    ws.on("message", async (raw: Buffer) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: "error", message: "Malformed message" });
        return;
      }

      const result = wsClientMessageSchema.safeParse(parsed);
      if (!result.success) {
        send(ws, { type: "error", message: "Invalid message shape" });
        return;
      }
      const msg = result.data;

      try {
        if (msg.type === "auth") {
          if (!env.TELEGRAM_BOT_TOKEN) throw new GameError("Server not configured");
          const { user } = validateInitData(msg.initData, env.TELEGRAM_BOT_TOKEN);
          const dbUser = await lobbyManager.ensureUser(String(user.id), telegramDisplayName(user), user.photo_url ?? null);
          const room = lobbyManager.getRoom(msg.lobbyId);
          if (!room) throw new GameError("Lobby not found");
          lobbyManager.connect(room, dbUser.id, ws);
          state = { room, userId: dbUser.id, chatTimestamps: [] };
          return;
        }

        if (!state) throw new GameError("Send auth first");
        const { room, userId } = state;

        switch (msg.type) {
          case "ready":
            lobbyManager.setReady(room, userId, msg.isReady);
            break;
          case "start_game":
            await lobbyManager.startGame(room, userId);
            break;
          case "kick_player":
            lobbyManager.kickPlayer(room, userId, msg.playerId);
            break;
          case "submit_answer":
            lobbyManager.submitAnswer(room, userId, msg.text);
            break;
          case "request_ai_suggestion":
            await lobbyManager.requestAiSuggestion(room, userId);
            break;
          case "chat_message": {
            const now = Date.now();
            state.chatTimestamps = state.chatTimestamps.filter((t) => now - t < 10_000);
            if (state.chatTimestamps.length >= CHAT_RATE_LIMIT_PER_10S) {
              throw new GameError("You're sending messages too fast");
            }
            state.chatTimestamps.push(now);
            lobbyManager.chatMessage(room, userId, msg.text);
            break;
          }
          case "cast_vote":
            lobbyManager.castVote(room, userId, msg.votedForId);
            break;
          case "toggle_reveal_names":
            lobbyManager.toggleRevealNames(room, userId, msg.revealNames);
            break;
          case "rematch":
            await lobbyManager.rematch(room, userId);
            break;
          case "ping":
            send(ws, { type: "pong" });
            break;
        }
      } catch (err) {
        if (err instanceof GameError || err instanceof InitDataError) {
          send(ws, { type: "error", message: err.message });
        } else {
          app.log.error(err);
          send(ws, { type: "error", message: "Something went wrong" });
        }
      }
    });

    ws.on("close", () => {
      if (state) lobbyManager.disconnect(state.room, state.userId);
    });
  });
}

function send(ws: WebSocket, event: unknown) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
}
