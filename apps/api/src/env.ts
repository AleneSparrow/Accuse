import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  MINI_APP_URL: z.string().url().optional(),
  API_PUBLIC_URL: z.string().url().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).default("dev-secret"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  CORS_EXTRA_ORIGINS: z.string().default(""),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
});

export const env = envSchema.parse(process.env);

export const corsOrigins = [env.CORS_ORIGIN, ...env.CORS_EXTRA_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)];
