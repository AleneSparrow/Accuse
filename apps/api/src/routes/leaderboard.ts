import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

// Simple all-time leaderboard ranked by wins. Wins/losses reset is left as a
// TODO for a real weekly cron job — MVP scope keeps a single running total.
export function registerLeaderboardRoutes(app: FastifyInstance) {
  app.get("/api/leaderboard", async (_req, reply) => {
    const users = await prisma.user.findMany({
      orderBy: [{ wins: "desc" }, { losses: "asc" }],
      take: 50,
    });
    return reply.send({
      leaderboard: users.map((u) => ({
        telegramId: u.telegramId,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        wins: u.wins,
        losses: u.losses,
      })),
    });
  });
}
