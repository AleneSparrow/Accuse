import OpenAI from "openai";
import { env } from "../env.js";

export const aiEnabled = Boolean(env.OPENAI_API_KEY);

export const openai = aiEnabled
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })
  : null;

/** Wraps an AI call with a hard timeout so the game loop never stalls on a slow model. */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AI call timed out")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
