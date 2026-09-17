/**
 * Picks exactly one impostor from the given player ids using a uniform
 * random draw. Pulled out as a pure function so role-fairness is unit
 * testable without spinning up a lobby.
 */
export function assignImpostor(playerIds: string[], rng: () => number = Math.random): string {
  if (playerIds.length < 2) {
    throw new Error("need at least 2 players to assign an impostor");
  }
  const index = Math.floor(rng() * playerIds.length);
  return playerIds[Math.min(index, playerIds.length - 1)];
}
