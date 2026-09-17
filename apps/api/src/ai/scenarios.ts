import type { ScenarioCategory } from "@accuse/shared";

export interface Scenario {
  category: ScenarioCategory;
  prompt: string;
}

// Static fallback pool used when no OPENAI_API_KEY is configured, or the
// AI call fails/times out — the game must never block on the network.
export const FALLBACK_SCENARIOS: Scenario[] = [
  { category: "crime", prompt: "The office safe was found open at 6am with nothing missing. Where were you last night and why?" },
  { category: "crime", prompt: "Someone replaced the break room coffee with decaf for a week. Confess your alibi." },
  { category: "mystery", prompt: "A single muddy footprint leads from the garden into the locked library. Explain your evening." },
  { category: "mystery", prompt: "The ship's cat has vanished along with a box of biscuits. Account for your whereabouts." },
  { category: "workplace", prompt: "Someone reply-all'd the entire company with a meme meant for one friend. Where were you at 2:14pm?" },
  { category: "workplace", prompt: "The shared kitchen fridge was mysteriously cleaned out overnight, including things that were still good. Explain yourself." },
  { category: "sci-fi", prompt: "Life support flickered for exactly nine seconds and no one will admit to being near the panel. What were you doing?" },
  { category: "sci-fi", prompt: "The colony's last seed vault was accessed after hours by someone with your badge code. Justify it." },
  { category: "workplace", prompt: "Someone booked the good conference room under a fake name for a two-hour nap. Was it you, and if not, where were you?" },
  { category: "mystery", prompt: "A neighbor reports hearing someone practicing scales on a piano that doesn't exist in this building. Explain." },
];

export function randomFallbackScenario(exclude: Set<string> = new Set()): Scenario {
  const pool = FALLBACK_SCENARIOS.filter((s) => !exclude.has(s.prompt));
  const list = pool.length > 0 ? pool : FALLBACK_SCENARIOS;
  return list[Math.floor(Math.random() * list.length)];
}
