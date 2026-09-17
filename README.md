# ACCUSE

An AI social deduction party game for Telegram. One player is secretly the AI impostor —
everyone else has to catch them before the votes are in. 3–8 players, 5–12 minute rounds,
plays entirely inside a Telegram Mini App.

- `apps/web` — the Mini App frontend (Vite + React + TypeScript)
- `apps/api` — REST + WebSocket API, game engine, and the Telegram bot (Fastify + grammY + Prisma/SQLite)
- `packages/shared` — types, zod schemas, and constants shared by both

## How a round works

1. Host opens the Mini App, creates a lobby, and shares the invite link.
2. 3–8 players join. The host starts the game once everyone is ready.
3. One player is secretly assigned as the **impostor** (AI-assisted answers). Everyone else is human.
4. Each round (3 by default):
   - **Prompt** — a scenario is shown (crime / mystery / workplace / sci-fi).
   - **Answer** (50s) — everyone writes an in-character answer. The impostor can request an AI-written suggestion and edit it before sending.
   - **Debate** (75s) — answers are shown (names can be toggled on/off by the host) and everyone chats.
   - **Vote** (30s) — vote for who you think the impostor is.
   - **Reveal** — vote tally shown; the impostor's identity is fully revealed after the final round, along with the scoreboard.
5. Humans win the game if the impostor is caught in more rounds than not; otherwise the impostor wins.
6. Rematch, or invite more friends for a new lobby.

## Prerequisites

- Node.js 20+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- An HTTPS tunnel for local development (Telegram Mini Apps require HTTPS) — [ngrok](https://ngrok.com) is the easiest option
- (Optional) An OpenAI-compatible API key — without one, the game falls back to a static scenario/answer pool so it's still fully playable

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in:

| Variable | What it's for |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | From BotFather, required for both the bot and initData validation |
| `MINI_APP_URL` | Public HTTPS URL the bot points the "Open ACCUSE" button at (your web ngrok URL, or your deployed frontend) |
| `API_PUBLIC_URL` | Public HTTPS URL of the API, used to register the Telegram webhook |
| `TELEGRAM_WEBHOOK_SECRET` | Any random string — makes the webhook path unguessable |
| `DATABASE_URL` | SQLite file path for Prisma, `file:./dev.db` works locally |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | Any OpenAI-compatible endpoint. Omit `OPENAI_API_KEY` to run fully on the static fallback content |
| `VITE_API_URL` / `VITE_WS_URL` | Where the frontend finds the API, from the browser's perspective |
| `VITE_BOT_USERNAME` | Your bot's `@username` (no `@`), used to build `t.me` invite links |

## 3. Set up the database

```bash
npm run prisma:generate
npm run prisma:migrate
```

## 4. Create your bot and point it at the Mini App

1. Talk to [@BotFather](https://t.me/BotFather), run `/newbot`, and save the token into `.env` as `TELEGRAM_BOT_TOKEN`.
2. Run `/setmenubutton` (or `/mybots` → your bot → **Bot Settings** → **Menu Button**) and set the Mini App URL to your `MINI_APP_URL` (an https ngrok URL while developing, your real domain in production).
3. Optionally run `/setinline` so players can share invites straight into a group chat via the "Share to a chat" button.
4. Optionally run `/setdomain` if Telegram asks you to allowlist your Mini App's domain.

## 5. Expose HTTPS tunnels for local development

Telegram requires HTTPS for both the Mini App and the bot webhook. With ngrok:

```bash
ngrok http 5173   # frontend -> use this URL as MINI_APP_URL
ngrok http 4000   # api      -> use this URL as API_PUBLIC_URL
```

Update `.env` with the two ngrok URLs, restart the API so it re-registers the webhook, and re-set the Menu Button URL in BotFather.

## 6. Run it

```bash
npm run dev          # runs both the API and the web app
# or individually:
npm run dev:api
npm run dev:web
```

The API listens on `PORT` (default `4000`) and serves the WebSocket at `/ws`. The web app runs on `5173`.

Open the bot in Telegram and tap the Menu Button (or `/play`) to launch the Mini App. Two different Telegram accounts (or the same account in two browser tabs while testing outside Telegram) can join the same lobby via the invite link/code to play a full game end-to-end.

> **Testing outside Telegram:** the Home screen has a "dev identity" helper for local UI iteration, but the API always validates `initData`'s HMAC signature against `TELEGRAM_BOT_TOKEN` — forged/dev data is rejected. For a real two-player test, open the Mini App from two separate Telegram accounts.

## Docker

```bash
docker compose up --build
```

This builds and runs the API (with SQLite persisted in a named volume) on port `4000` and the web app (built and served via nginx) on port `8080`. Set `.env` first — `docker-compose.yml` reads `API_PUBLIC_URL`, `VITE_WS_URL`, and `VITE_BOT_USERNAME` to bake the right URLs into the frontend build.

## Tests

```bash
npm test
```

Covers: role assignment fairness, vote tallying (majority / tie / no-votes), and Telegram `initData` HMAC validation (accepts correctly signed payloads, rejects forged/tampered/expired ones).

## Project structure

```
apps/web          Mini App frontend (Vite + React + TS)
apps/api          Fastify API, WebSocket game loop, grammY bot, Prisma schema
packages/shared    Shared types, zod schemas, constants, i18n strings
```

## Design notes / scope

- Live game state (lobby membership, round phase, timers, answers, votes, chat) lives in-memory on the API process, keyed by lobby, with server-authoritative `setTimeout` phase transitions. Rounds and their answers/votes are persisted to SQLite for the leaderboard and history; a server restart mid-game currently drops in-flight games (fine for an MVP; would move to Redis/durable timers for real scale).
- The impostor is assigned once per match (not per round) so the group has multiple rounds to build a case — full identity reveal is held until after the final round.
- Chat and lobby membership are not end-to-end persisted beyond what's needed for the leaderboard; this keeps the hot path simple.
- **Out of scope by design:** crypto/TON/wallets/airdrops, voice chat, paid features (Telegram Stars cosmetics are a `TODO` for v2 — see `packages/shared/src/constants.ts` and the scoreboard screen for where they'd hook in).

## Anti-abuse

- All API/WS actions require a validated Telegram `initData` HMAC signature (see `apps/api/src/telegram/initData.ts`).
- Chat is rate-limited per connection (`CHAT_RATE_LIMIT_PER_10S` in `packages/shared/src/constants.ts`).
- Only the host can start the game, kick players, toggle name reveal, or trigger a rematch.
