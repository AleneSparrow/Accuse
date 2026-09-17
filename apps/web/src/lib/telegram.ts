type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: { start_param?: string; user?: { id: number; first_name?: string; username?: string; photo_url?: string } };
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  HapticFeedback?: {
    impactOccurred?: (style: "light" | "medium" | "heavy") => void;
    notificationOccurred?: (type: "success" | "error" | "warning") => void;
  };
  openTelegramLink?: (url: string) => void;
  switchInlineQuery?: (query: string, choose_chat_types?: string[]) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function getWebApp(): TelegramWebApp | undefined {
  return typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
}

export function initTelegram() {
  const wa = getWebApp();
  if (!wa) return;
  try {
    wa.ready?.();
    wa.expand?.();
    wa.setHeaderColor?.("#0b0b0d");
    wa.setBackgroundColor?.("#0b0b0d");
  } catch {
    // not fatal
  }
}

export function getInitData(): string {
  const fromTg = getWebApp()?.initData;
  if (fromTg) return fromTg;
  return window.localStorage.getItem("dev_init_data") ?? "";
}

export function isTelegram(): boolean {
  return Boolean(getWebApp()?.initData);
}

export function getStartParam(): string | null {
  const fromTg = getWebApp()?.initDataUnsafe?.start_param;
  if (fromTg) return fromTg;
  const url = new URL(window.location.href);
  return url.searchParams.get("tgWebAppStartParam") ?? url.searchParams.get("startapp") ?? url.searchParams.get("start");
}

export function hapticImpact(style: "light" | "medium" | "heavy" = "light") {
  try {
    getWebApp()?.HapticFeedback?.impactOccurred?.(style);
  } catch {
    // ignore
  }
}

export function hapticNotify(type: "success" | "error" | "warning") {
  try {
    getWebApp()?.HapticFeedback?.notificationOccurred?.(type);
  } catch {
    // ignore
  }
}

export function shareInviteLink(botUsername: string, lobbyCode: string) {
  const url = `https://t.me/${botUsername}?startapp=${lobbyCode}`;
  const text = "🎭 Join my round of ACCUSE — find the AI impostor before it's too late.";
  const wa = getWebApp();
  if (wa?.openTelegramLink) {
    wa.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    return;
  }
  void navigator.clipboard?.writeText(url);
}

export function switchToInlineInvite() {
  try {
    getWebApp()?.switchInlineQuery?.("invite", ["users", "groups", "channels"]);
  } catch {
    // ignore
  }
}
