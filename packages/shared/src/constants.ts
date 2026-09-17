export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const DEFAULT_ROUNDS = 3;

export const PHASE_DURATIONS_MS = {
  answer: 50_000,
  debate: 75_000,
  vote: 30_000,
  reveal: 12_000,
} as const;

export const SUPPORTER_STARS_PRICE = 50;

export const LOBBY_CODE_LENGTH = 5;
export const LOBBY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1

export const MAX_CHAT_MESSAGE_LENGTH = 240;
export const MAX_ANSWER_LENGTH = 220;
export const CHAT_RATE_LIMIT_PER_10S = 8;

export const SCENARIO_CATEGORIES = [
  "crime",
  "mystery",
  "workplace",
  "sci-fi",
] as const;
