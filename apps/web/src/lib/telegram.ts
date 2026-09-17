import WebApp from "@twa-dev/sdk";

const isTelegram = typeof window !== "undefined" && Boolean(window.Telegram?.WebApp?.initData);

export function initTelegram() {
  if (!isTelegram) return;
  try {
    WebApp.ready();
    WebApp.expand();
    WebApp.setHeaderColor("#0b0b0d");
    WebApp.setBackgroundColor("#0b0b0d");
  } catch {
    // not fatal — dev in a plain browser
  }
}

export function getInitData(): string {
  if (isTelegram) return WebApp.initData;
  // Dev fallback so the app is clickable outside Telegram. The API will
  // reject this in production since it won't pass HMAC validation.
  return window.localStorage.getItem("dev_init_data") ?? "";
}

export function getStartParam(): string | null {
  if (isTelegram) return WebApp.initDataUnsafe?.start_param ?? null;
  const url = new URL(window.location.href);
  return url.searchParams.get("startapp") ?? url.searchParams.get("start");
}

export function hapticImpact(style: "light" | "medium" | "heavy" = "light") {
  if (!isTelegram) return;
  try {
    WebApp.HapticFeedback.impactOccurred(style);
  } catch {
    // ignore
  }
}

export function hapticNotify(type: "success" | "error" | "warning") {
  if (!isTelegram) return;
  try {
    WebApp.HapticFeedback.notificationOccurred(type);
  } catch {
    // ignore
  }
}

export function shareInviteLink(botUsername: string, lobbyCode: string) {
  if (!isTelegram) {
    void navigator.clipboard?.writeText(`https://t.me/${botUsername}?startapp=${lobbyCode}`);
    return;
  }
  const url = `https://t.me/${botUsername}?startapp=${lobbyCode}`;
  const text = "🎭 Join my round of ACCUSE — find the AI impostor before it's too late.";
  WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
}

export function switchToInlineInvite() {
  if (!isTelegram) return;
  try {
    WebApp.switchInlineQuery("invite", ["users", "groups", "channels"]);
  } catch {
    // ignore — inline mode may not be enabled on the bot yet
  }
}

export { isTelegram };
