import crypto from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface ParsedInitData {
  user: TelegramUser;
  authDate: number;
  raw: string;
}

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // 24h

/**
 * Validates Telegram WebApp initData per the HMAC scheme documented at
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * secret_key = HMAC_SHA256("WebAppData", bot_token)
 * expected   = HMAC_SHA256(secret_key, data_check_string)
 */
export function validateInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number = MAX_AUTH_AGE_SECONDS
): ParsedInitData {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new InitDataError("missing hash");
  }
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const expectedBuf = Buffer.from(expectedHash, "hex");
  const actualBuf = Buffer.from(hash, "hex");
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    throw new InitDataError("invalid hash");
  }

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Number.isNaN(authDate)) {
    throw new InitDataError("missing auth_date");
  }
  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > maxAgeSeconds) {
    throw new InitDataError("initData expired");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new InitDataError("missing user");
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new InitDataError("malformed user payload");
  }
  if (!user || typeof user.id !== "number") {
    throw new InitDataError("malformed user payload");
  }

  return { user, authDate, raw: initData };
}

export class InitDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InitDataError";
  }
}
