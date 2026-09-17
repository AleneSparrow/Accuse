import Fastify from "fastify";
import cors from "@fastify/cors";
import websocketPlugin from "@fastify/websocket";
import { env, corsOrigins } from "./env.js";
import { registerLobbyRoutes } from "./routes/lobby.js";
import { registerLeaderboardRoutes } from "./routes/leaderboard.js";
import { registerTelegramWebhook, setTelegramWebhook } from "./telegram/bot.js";
import { registerWebsocket } from "./ws/handler.js";

const app = Fastify({ logger: true });

// Defense in depth: a single unhandled rejection anywhere (e.g. a missed await
// in a future change) would otherwise crash the whole process and drop every
// concurrent game. Log it and keep serving instead.
process.on("unhandledRejection", (reason) => {
  app.log.error({ err: reason }, "unhandled rejection");
});
process.on("uncaughtException", (err) => {
  app.log.error({ err }, "uncaught exception");
});

await app.register(cors, { origin: corsOrigins, credentials: true });
await app.register(websocketPlugin);

app.get("/health", async () => ({ ok: true }));

registerLobbyRoutes(app);
registerLeaderboardRoutes(app);
registerTelegramWebhook(app);
registerWebsocket(app);

const port = env.PORT;
app.listen({ port, host: "0.0.0.0" }, async (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`ACCUSE API listening on ${address}`);
  try {
    await setTelegramWebhook();
  } catch (e) {
    app.log.warn({ err: e }, "could not set Telegram webhook (set API_PUBLIC_URL to enable)");
  }
});
