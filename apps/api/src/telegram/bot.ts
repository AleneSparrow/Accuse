import { Bot, InlineKeyboard, Keyboard, webhookCallback, type Context } from "grammy";
import type { FastifyInstance } from "fastify";
import { env } from "../env.js";

export const bot = env.TELEGRAM_BOT_TOKEN ? new Bot(env.TELEGRAM_BOT_TOKEN) : null;

if (bot) {
  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim();
    await sendOpenGame(ctx, payload);
  });

  bot.command("play", async (ctx) => {
    await sendOpenGame(ctx);
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    if (ctx.message.text.startsWith("/")) return;
    await sendOpenGame(ctx);
  });

  bot.on("inline_query", async (ctx) => {
    const lobbyCode = ctx.inlineQuery.query.trim();
    const deepLink = `https://t.me/${ctx.me.username}?startapp=${encodeURIComponent(lobbyCode || "join")}`;
    await ctx.answerInlineQuery(
      [
        {
          type: "article",
          id: "invite",
          title: lobbyCode ? `Invite to ACCUSE — lobby ${lobbyCode}` : "Invite to ACCUSE",
          description: "Sends a tappable invite link — web_app buttons don't work outside private chats with the bot.",
          input_message_content: {
            message_text: `🎭 Join my round of ACCUSE — find the AI impostor before it's too late.\n${deepLink}`,
          },
          // Note: a web_app InlineKeyboardButton is only usable in a private chat with the
          // bot itself — Telegram silently blocks sending it in any other chat. Use a plain
          // url button (t.me deep link) so the invite actually sends.
          reply_markup: new InlineKeyboard().url("Open ACCUSE", deepLink),
        },
      ],
      { cache_time: 0 },
    );
  });
}

async function sendOpenGame(ctx: Context, payload?: string) {
  const appUrl = miniAppUrl(payload);
  const replyKb = new Keyboard().webApp("🎭 Open ACCUSE", appUrl).resized().persistent();
  const inlineKb = new InlineKeyboard().webApp("🎭 Open ACCUSE", appUrl);

  if (bot && ctx.from?.id) {
    try {
      await bot.api.setChatMenuButton({
        chat_id: ctx.from.id,
        menu_button: { type: "web_app", text: "Play ACCUSE", web_app: { url: appUrl } },
      });
    } catch {
      // non-fatal
    }
  }

  await ctx.reply(
    payload
      ? "You've been invited to ACCUSE. Tap the button below to join — it opens inside Telegram."
      : "ACCUSE opens inside Telegram. Tap the button below to play.",
    { reply_markup: replyKb },
  );
  await ctx.reply("Or use this button:", { reply_markup: inlineKb });
}

function miniAppUrl(startapp?: string): string {
  const base = env.MINI_APP_URL ?? "https://web-production-84a77.up.railway.app";
  if (!startapp) return base;
  const url = new URL(base);
  url.searchParams.set("tgWebAppStartParam", startapp);
  return url.toString();
}

export function registerTelegramWebhook(app: FastifyInstance) {
  if (!bot) {
    app.log.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }
  const path = `/telegram/webhook/${env.TELEGRAM_WEBHOOK_SECRET}`;
  const handler = webhookCallback(bot, "fastify");
  app.post(path, async (req, reply) => {
    try {
      await handler(req, reply);
    } catch (err) {
      app.log.error({ err }, "telegram webhook handler failed");
      if (!reply.sent) {
        return reply.code(200).send({ ok: true });
      }
    }
  });
  app.log.info(`Telegram webhook registered at ${path}`);
}

export async function setTelegramWebhook() {
  if (!bot || !env.API_PUBLIC_URL) return;
  const url = `${env.API_PUBLIC_URL}/telegram/webhook/${env.TELEGRAM_WEBHOOK_SECRET}`;
  await bot.api.setWebhook(url, {
    allowed_updates: ["message", "callback_query", "inline_query"],
    drop_pending_updates: true,
  });
}
