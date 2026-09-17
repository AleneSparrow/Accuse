import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import type { FastifyInstance } from "fastify";
import { env } from "../env.js";

export const bot = env.TELEGRAM_BOT_TOKEN ? new Bot(env.TELEGRAM_BOT_TOKEN) : null;

if (bot) {
  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim();
    const appUrl = miniAppUrl(payload);
    const keyboard = new InlineKeyboard().webApp("🎭 Open ACCUSE", appUrl);
    await ctx.reply(
      payload
        ? "You've been invited to a round of ACCUSE. One of you is lying — it might be the machine. Tap below to join."
        : "Welcome to ACCUSE — the social deduction party game. Create a lobby, invite friends, and find the impostor before they find you.",
      { reply_markup: keyboard }
    );
  });

  bot.command("play", async (ctx) => {
    const keyboard = new InlineKeyboard().webApp("🎭 Play ACCUSE", miniAppUrl());
    await ctx.reply("Ready to play? Open the Mini App to create or join a lobby.", { reply_markup: keyboard });
  });

  bot.on("inline_query", async (ctx) => {
    const appUrl = miniAppUrl();
    await ctx.answerInlineQuery(
      [
        {
          type: "article",
          id: "invite",
          title: "Invite to ACCUSE",
          input_message_content: {
            message_text: "🎭 Join my round of ACCUSE — find the AI impostor before it's too late.",
          },
          reply_markup: new InlineKeyboard().webApp("Open ACCUSE", appUrl),
        },
      ],
      { cache_time: 0 }
    );
  });
}

function miniAppUrl(startapp?: string): string {
  const base = env.MINI_APP_URL ?? "https://example.com";
  if (!startapp) return base;
  const url = new URL(base);
  url.searchParams.set("startapp", startapp);
  return url.toString();
}

export function registerTelegramWebhook(app: FastifyInstance) {
  if (!bot) {
    app.log.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }
  const path = `/telegram/webhook/${env.TELEGRAM_WEBHOOK_SECRET}`;
  const handler = webhookCallback(bot, "fastify");
  app.post(path, (req, reply) => handler(req, reply));
  app.log.info(`Telegram webhook registered at ${path}`);
}

export async function setTelegramWebhook() {
  if (!bot || !env.API_PUBLIC_URL) return;
  const url = `${env.API_PUBLIC_URL}/telegram/webhook/${env.TELEGRAM_WEBHOOK_SECRET}`;
  await bot.api.setWebhook(url);
}
