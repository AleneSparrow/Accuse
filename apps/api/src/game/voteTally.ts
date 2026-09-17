export interface TallyResult {
  votedForId: string | null; // player with most votes, null on a tie or no votes
  counts: Record<string, number>;
  impostorCaught: boolean;
  isTie: boolean;
}

/**
 * Tallies votes and determines whether the humans caught the impostor.
 * Humans win only when a single player has strictly more votes than every
 * other player AND that player is the impostor (a tie never catches anyone).
 */
export function tallyVotes(votes: Record<string, string>, impostorId: string): TallyResult {
  const counts: Record<string, number> = {};
  for (const votedForId of Object.values(votes)) {
    counts[votedForId] = (counts[votedForId] ?? 0) + 1;
  }

  let topId: string | null = null;
  let topCount = 0;
  let tie = false;
  for (const [id, count] of Object.entries(counts)) {
    if (count > topCount) {
      topCount = count;
      topId = id;
      tie = false;
    } else if (count === topCount && topCount > 0) {
      tie = true;
    }
  }

  const votedForId = tie ? null : topId;
  return {
    votedForId,
    counts,
    isTie: tie,
    impostorCaught: votedForId !== null && votedForId === impostorId,
  };
}
