import { InitDataError } from "../telegram/initData.js";
import { GameError } from "../game/manager.js";

export function handleError(err: unknown, reply: { status: (c: number) => { send: (b: unknown) => unknown } }) {
  if (err instanceof InitDataError) return reply.status(401).send({ error: "Invalid Telegram auth" });
  if (err instanceof GameError) return reply.status(400).send({ error: err.message });
  throw err;
}
