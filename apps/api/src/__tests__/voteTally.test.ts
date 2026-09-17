import { describe, expect, it } from "vitest";
import { tallyVotes } from "../game/voteTally.js";

describe("tallyVotes", () => {
  it("catches the impostor on a clear majority", () => {
    const result = tallyVotes({ v1: "imp", v2: "imp", v3: "human1" }, "imp");
    expect(result.votedForId).toBe("imp");
    expect(result.impostorCaught).toBe(true);
    expect(result.isTie).toBe(false);
  });

  it("lets the impostor escape when votes are split on someone else", () => {
    const result = tallyVotes({ v1: "human1", v2: "human1", v3: "imp" }, "imp");
    expect(result.votedForId).toBe("human1");
    expect(result.impostorCaught).toBe(false);
  });

  it("treats a tie as no catch", () => {
    const result = tallyVotes({ v1: "imp", v2: "human1" }, "imp");
    expect(result.isTie).toBe(true);
    expect(result.votedForId).toBeNull();
    expect(result.impostorCaught).toBe(false);
  });

  it("handles no votes cast at all", () => {
    const result = tallyVotes({}, "imp");
    expect(result.votedForId).toBeNull();
    expect(result.impostorCaught).toBe(false);
    expect(result.isTie).toBe(false);
  });

  it("counts votes per candidate correctly", () => {
    const result = tallyVotes({ v1: "a", v2: "a", v3: "b", v4: "a" }, "a");
    expect(result.counts).toEqual({ a: 3, b: 1 });
    expect(result.votedForId).toBe("a");
    expect(result.impostorCaught).toBe(true);
  });
});
