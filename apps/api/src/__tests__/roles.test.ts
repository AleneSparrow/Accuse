import { describe, expect, it } from "vitest";
import { assignImpostor } from "../game/roles.js";

describe("assignImpostor", () => {
  it("throws with fewer than 2 players", () => {
    expect(() => assignImpostor(["a"])).toThrow();
    expect(() => assignImpostor([])).toThrow();
  });

  it("always returns one of the given player ids", () => {
    const players = ["a", "b", "c", "d", "e"];
    for (let i = 0; i < 50; i++) {
      const impostor = assignImpostor(players);
      expect(players).toContain(impostor);
    }
  });

  it("is deterministic for a given rng", () => {
    const players = ["a", "b", "c", "d"];
    expect(assignImpostor(players, () => 0)).toBe("a");
    expect(assignImpostor(players, () => 0.99)).toBe("d");
    expect(assignImpostor(players, () => 0.5)).toBe("c");
  });

  it("distributes roughly uniformly over many draws", () => {
    const players = ["a", "b", "c", "d"];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
    const trials = 4000;
    for (let i = 0; i < trials; i++) {
      counts[assignImpostor(players)]++;
    }
    for (const id of players) {
      const share = counts[id] / trials;
      expect(share).toBeGreaterThan(0.18);
      expect(share).toBeLessThan(0.32);
    }
  });
});
