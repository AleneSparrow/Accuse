import type { FastifyInstance } from "fastify";
import { createLobbySchema, joinLobbySchema, DEFAULT_ROUNDS } from "@accuse/shared";
import { env } from "../env.js";
import { validateInitData, telegramDisplayName } from "../telegram/initData.js";
import { lobbyManager, serializeLobby } from "../game/manager.js";
import { handleError } from "./helpers.js";

export function registerLobbyRoutes(app: FastifyInstance) {
  app.post("/api/lobby", async (req, reply) => {
    const body = createLobbySchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Invalid request" });
    if (!env.TELEGRAM_BOT_TOKEN) return reply.status(500).send({ error: "Server not configured" });

    try {
      const { user } = validateInitData(body.data.initData, env.TELEGRAM_BOT_TOKEN);
      const dbUser = await lobbyManager.ensureUser(String(user.id), telegramDisplayName(user), user.photo_url ?? null);
      const room = await lobbyManager.createLobby(dbUser, body.data.totalRounds ?? DEFAULT_ROUNDS);
      return reply.send({ lobby: serializeLobby(room) });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.post("/api/lobby/join", async (req, reply) => {
    const body = joinLobbySchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Invalid request" });
    if (!env.TELEGRAM_BOT_TOKEN) return reply.status(500).send({ error: "Server not configured" });

    try {
      const { user } = validateInitData(body.data.initData, env.TELEGRAM_BOT_TOKEN);
      const dbUser = await lobbyManager.ensureUser(String(user.id), telegramDisplayName(user), user.photo_url ?? null);
      const room = await lobbyManager.joinLobby(body.data.code, dbUser);
      return reply.send({ lobby: serializeLobby(room) });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.get("/api/lobby/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const room = lobbyManager.getRoom(id);
    if (!room) return reply.status(404).send({ error: "Lobby not found" });
    return reply.send({ lobby: serializeLobby(room) });
  });
}
