import type { FastifyInstance } from "fastify";
import { createSupporterInvoiceSchema, SUPPORTER_STARS_PRICE } from "@accuse/shared";
import { env } from "../env.js";
import { validateInitData, telegramDisplayName } from "../telegram/initData.js";
import { lobbyManager } from "../game/manager.js";
import { bot } from "../telegram/bot.js";
import { handleError } from "./helpers.js";

export function registerPaymentRoutes(app: FastifyInstance) {
  app.post("/api/payments/support/invoice-link", async (req, reply) => {
    const body = createSupporterInvoiceSchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? "Invalid request" });
    if (!env.TELEGRAM_BOT_TOKEN || !bot) return reply.status(500).send({ error: "Server not configured" });

    try {
      const { user } = validateInitData(body.data.initData, env.TELEGRAM_BOT_TOKEN);
      const dbUser = await lobbyManager.ensureUser(String(user.id), telegramDisplayName(user), user.photo_url ?? null);

      const link = await bot.api.createInvoiceLink(
        "Support ACCUSE",
        "A one-time tip that unlocks a supporter badge next to your name in every lobby.",
        `supporter:${dbUser.id}`,
        "", // no provider_token for Telegram Stars payments
        "XTR",
        [{ label: "Support ACCUSE", amount: SUPPORTER_STARS_PRICE }],
      );
      return reply.send({ link });
    } catch (err) {
      return handleError(err, reply);
    }
  });
}
