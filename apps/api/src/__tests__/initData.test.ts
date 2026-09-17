import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateInitData, InitDataError } from "../telegram/initData.js";

const BOT_TOKEN = "123456:TEST-TOKEN-not-real";

function buildInitData(overrides: Record<string, string> = {}, token = BOT_TOKEN): string {
  const user = JSON.stringify({ id: 42, first_name: "Ada", username: "ada" });
  const params: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user,
    query_id: "AAabc123",
    ...overrides,
  };
  const dataCheckString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const search = new URLSearchParams({ ...params, hash });
  return search.toString();
}

describe("validateInitData", () => {
  it("accepts a correctly signed payload", () => {
    const initData = buildInitData();
    const result = validateInitData(initData, BOT_TOKEN);
    expect(result.user.id).toBe(42);
    expect(result.user.username).toBe("ada");
  });

  it("rejects a payload signed with the wrong bot token (forged user)", () => {
    const initData = buildInitData({}, "999999:WRONG-TOKEN");
    expect(() => validateInitData(initData, BOT_TOKEN)).toThrow(InitDataError);
  });

  it("rejects a payload with a tampered field after signing", () => {
    const initData = buildInitData();
    const params = new URLSearchParams(initData);
    params.set("user", JSON.stringify({ id: 999, first_name: "Eve" }));
    expect(() => validateInitData(params.toString(), BOT_TOKEN)).toThrow(InitDataError);
  });

  it("rejects a payload with no hash", () => {
    const params = new URLSearchParams(buildInitData());
    params.delete("hash");
    expect(() => validateInitData(params.toString(), BOT_TOKEN)).toThrow(InitDataError);
  });

  it("rejects an expired auth_date", () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 60 * 60 * 48); // 48h ago
    const initData = buildInitData({ auth_date: oldTimestamp });
    expect(() => validateInitData(initData, BOT_TOKEN, 24 * 60 * 60)).toThrow(InitDataError);
  });

  it("rejects malformed user JSON", () => {
    const initData = buildInitData({ user: "not-json" });
    expect(() => validateInitData(initData, BOT_TOKEN)).toThrow(InitDataError);
  });
});
