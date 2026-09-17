// i18n-ready string table. English only for MVP; add locales by adding
// sibling objects and a lookup-by-locale function later.
export const strings = {
  en: {
    appName: "ACCUSE",
    tagline: "One of you is lying. It might be the machine.",
    createLobby: "Create Lobby",
    joinLobby: "Join Lobby",
    inviteFriends: "Invite Friends",
    waitingForPlayers: "Waiting for players",
    ready: "Ready",
    notReady: "Not Ready",
    startGame: "Start Game",
    youAreHuman: "You are HUMAN",
    youAreImpostor: "You are the IMPOSTOR",
    impostorHint: "Blend in. Answer like a human would.",
    phasePrompt: "Read the scenario",
    phaseAnswer: "Write your answer",
    phaseDebate: "Debate & discuss",
    phaseVote: "Vote for the impostor",
    phaseReveal: "Reveal",
    submitAnswer: "Submit",
    getAiSuggestion: "Get AI Suggestion",
    accuseButton: "Accuse",
    rematch: "Rematch",
    humansWin: "Humans Win!",
    impostorWins: "Impostor Wins!",
    caughtTheImpostor: "The group caught the impostor.",
    impostorEscaped: "The impostor slipped away.",
  },
} as const;

export type Locale = keyof typeof strings;
export function t(key: keyof (typeof strings)["en"], locale: Locale = "en"): string {
  return strings[locale][key] ?? strings.en[key];
}
