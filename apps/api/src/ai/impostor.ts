import { env } from "../env.js";
import { aiEnabled, openai, withTimeout } from "./client.js";
import { FALLBACK_SCENARIOS, randomFallbackScenario, type Scenario } from "./scenarios.js";

const AI_TIMEOUT_MS = 8_000;

export async function generateScenario(usedPrompts: Set<string>): Promise<Scenario> {
  if (!aiEnabled || !openai) {
    return randomFallbackScenario(usedPrompts);
  }
  try {
    const completion = await withTimeout(
      openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        temperature: 1,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "You write one-sentence discussion prompts for a party social-deduction game called ACCUSE. " +
              "Each prompt puts every player 'on the spot' to explain themselves in-character, in a crime, mystery, workplace, or sci-fi setting. " +
              "Keep it under 30 words, punchy, and answerable in a sentence or two. Reply with ONLY the prompt text, no quotes, no category label.",
          },
          {
            role: "user",
            content: `Avoid repeating these prompts already used this session: ${[...usedPrompts].join(" | ") || "(none yet)"}`,
          },
        ],
      }),
      AI_TIMEOUT_MS
    );
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return randomFallbackScenario(usedPrompts);
    const category = FALLBACK_SCENARIOS[Math.floor(Math.random() * FALLBACK_SCENARIOS.length)].category;
    return { category, prompt: text };
  } catch {
    return randomFallbackScenario(usedPrompts);
  }
}

/**
 * Produces a human-sounding-but-slightly-off answer for the impostor to
 * start from. The impostor player can edit it before sending, or it is
 * auto-sent verbatim if they let the timer run out.
 */
export async function suggestImpostorAnswer(prompt: string, otherAnswers: string[]): Promise<string> {
  if (!aiEnabled || !openai) {
    return genericFallbackAnswer();
  }
  try {
    const completion = await withTimeout(
      openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        temperature: 0.9,
        max_tokens: 60,
        messages: [
          {
            role: "system",
            content:
              "You are secretly playing as the AI impostor in a social deduction party game. " +
              "Write a short in-character answer to the scenario, 1-2 sentences, casual texting tone, believable as a human but " +
              "just slightly vague or generic so a sharp reader *might* sense something is off. Never mention being an AI. " +
              "Reply with ONLY the answer text.",
          },
          { role: "user", content: `Scenario: ${prompt}` },
          otherAnswers.length
            ? { role: "user", content: `Other players already said: ${otherAnswers.join(" / ")}` }
            : { role: "user", content: "No other answers yet." },
        ],
      }),
      AI_TIMEOUT_MS
    );
    return completion.choices[0]?.message?.content?.trim() || genericFallbackAnswer();
  } catch {
    return genericFallbackAnswer();
  }
}

function genericFallbackAnswer(): string {
  const options = [
    "Honestly I was just around, nothing unusual to report on my end.",
    "I don't really remember anything specific, it was a pretty normal night for me.",
    "I was busy with my own stuff, didn't notice anything out of place.",
    "Nothing to hide here, I was just doing my usual thing.",
  ];
  return options[Math.floor(Math.random() * options.length)];
}
