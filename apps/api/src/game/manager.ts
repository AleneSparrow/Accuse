import { nanoid, customAlphabet } from "nanoid";
import type { WebSocket } from "ws";
import {
  LOBBY_CODE_ALPHABET,
  LOBBY_CODE_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PHASE_DURATIONS_MS,
  type ChatMessage,
  type GameResult,
  type LobbyState,
  type PublicPlayer,
  type RoundState,
  type ScoreboardEntry,
} from "@accuse/shared";
import { prisma } from "../lib/prisma.js";
import { assignImpostor } from "./roles.js";
import { tallyVotes } from "./voteTally.js";
import { generateScenario, suggestImpostorAnswer } from "../ai/impostor.js";
import type { LobbyRoom, PlayerConn, RoundInternal } from "./types.js";

const genCode = customAlphabet(LOBBY_CODE_ALPHABET, LOBBY_CODE_LENGTH);
const MAX_AI_SUGGESTIONS_PER_ROUND = 3;

type Broadcast = (room: LobbyRoom, event: unknown, onlyUserId?: string) => void;

export class LobbyManager {
  private rooms = new Map<string, LobbyRoom>();
  private codeToId = new Map<string, string>();

  private broadcast: Broadcast = (room, event, onlyUserId) => {
    const payload = JSON.stringify(event);
    for (const [userId, player] of room.players) {
      if (onlyUserId && userId !== onlyUserId) continue;
      if (player.ws && player.ws.readyState === player.ws.OPEN) {
        player.ws.send(payload);
      }
    }
  };

  getRoom(lobbyId: string): LobbyRoom | undefined {
    return this.rooms.get(lobbyId);
  }

  getRoomByCode(code: string): LobbyRoom | undefined {
    const id = this.codeToId.get(code.toUpperCase());
    return id ? this.rooms.get(id) : undefined;
  }

  async ensureUser(telegramId: string, displayName: string, avatarUrl: string | null) {
    return prisma.user.upsert({
      where: { telegramId },
      update: { displayName, avatarUrl: avatarUrl ?? undefined },
      create: { telegramId, displayName, avatarUrl },
    });
  }

  async createLobby(user: { id: string; telegramId: string; displayName: string; avatarUrl: string | null }, totalRounds: number) {
    let code = genCode();
    while (this.codeToId.has(code) || (await prisma.lobby.findUnique({ where: { code } }))) {
      code = genCode();
    }

    const lobby = await prisma.lobby.create({
      data: { code, hostId: user.id, totalRounds, status: "waiting" },
    });
    const lobbyPlayer = await prisma.lobbyPlayer.create({
      data: { lobbyId: lobby.id, userId: user.id, isHost: true },
    });

    const room: LobbyRoom = {
      id: lobby.id,
      code: lobby.code,
      status: "waiting",
      hostUserId: user.id,
      totalRounds,
      currentRoundNumber: 0,
      revealNames: true,
      players: new Map(),
      round: null,
      usedPrompts: new Set(),
      roundsWon: new Map(),
      createdAt: lobby.createdAt.toISOString(),
    };
    room.players.set(user.id, toPlayerConn(lobbyPlayer.id, user, true));
    this.rooms.set(room.id, room);
    this.codeToId.set(room.code, room.id);
    return room;
  }

  async joinLobby(code: string, user: { id: string; telegramId: string; displayName: string; avatarUrl: string | null }) {
    const room = this.getRoomByCode(code);
    if (!room) throw new GameError("Lobby not found");
    if (room.status !== "waiting") throw new GameError("Game already started");
    if (!room.players.has(user.id) && room.players.size >= MAX_PLAYERS) throw new GameError("Lobby is full");

    let existing = room.players.get(user.id);
    if (!existing) {
      const lobbyPlayer = await prisma.lobbyPlayer.create({
        data: { lobbyId: room.id, userId: user.id, isHost: false },
      });
      existing = toPlayerConn(lobbyPlayer.id, user, false);
      room.players.set(user.id, existing);
    }
    return room;
  }

  connect(room: LobbyRoom, userId: string, ws: WebSocket) {
    const player = room.players.get(userId);
    if (!player) throw new GameError("You are not in this lobby");
    player.ws = ws;
    player.connected = true;
    this.sendLobbyState(room);
    if (room.round) this.sendRoundStateTo(room, userId);
  }

  disconnect(room: LobbyRoom, userId: string) {
    const player = room.players.get(userId);
    if (!player) return;
    player.connected = false;
    player.ws = null;
    this.sendLobbyState(room);
  }

  setReady(room: LobbyRoom, userId: string, isReady: boolean) {
    const player = room.players.get(userId);
    if (!player) return;
    player.isReady = isReady;
    this.sendLobbyState(room);
  }

  kickPlayer(room: LobbyRoom, requesterId: string, targetLobbyPlayerId: string) {
    if (requesterId !== room.hostUserId) throw new GameError("Only the host can kick players");
    const target = findByLobbyPlayerId(room, targetLobbyPlayerId);
    if (!target) return;
    room.players.delete(target.userId);
    if (target.ws) {
      target.ws.send(JSON.stringify({ type: "kicked" }));
      target.ws.close();
    }
    this.sendLobbyState(room);
  }

  async startGame(room: LobbyRoom, requesterId: string) {
    if (requesterId !== room.hostUserId) throw new GameError("Only the host can start the game");
    if (room.status !== "waiting") throw new GameError("Game already started");
    const readyCount = [...room.players.values()].filter((p) => p.isReady || p.isHost).length;
    if (room.players.size < MIN_PLAYERS) throw new GameError(`Need at least ${MIN_PLAYERS} players`);
    if (readyCount < room.players.size) throw new GameError("All players must be ready");

    room.status = "in_progress";
    const impostorPlayerId = assignImpostor([...room.players.values()].map((p) => p.lobbyPlayerId));
    room.roundsWon = new Map();
    await prisma.lobby.update({ where: { id: room.id }, data: { status: "in_progress" } });

    this.sendLobbyState(room);
    await this.beginRound(room, 1, impostorPlayerId);
  }

  private async beginRound(room: LobbyRoom, roundNumber: number, impostorPlayerId: string) {
    room.currentRoundNumber = roundNumber;
    const scenario = await generateScenario(room.usedPrompts);
    room.usedPrompts.add(scenario.prompt);

    const dbRound = await prisma.round.create({
      data: {
        lobbyId: room.id,
        roundNumber,
        category: scenario.category,
        prompt: scenario.prompt,
        impostorPlayerId,
        phase: "prompt",
      },
    });

    const round: RoundInternal = {
      dbRoundId: dbRound.id,
      roundNumber,
      phase: "prompt",
      category: scenario.category,
      prompt: scenario.prompt,
      impostorPlayerId,
      phaseEndsAt: null,
      answers: new Map(),
      votes: new Map(),
      aiSuggestionCount: 0,
      timer: null,
    };
    room.round = round;

    this.sendRoundStateToAll(room);
    // brief beat on the prompt screen, then move to answering
    round.timer = setTimeout(
      () => this.runTimer(room, () => this.enterPhase(room, "answer", PHASE_DURATIONS_MS.answer)),
      3_500,
    );
  }

  /**
   * All round-phase timers eventually call async code (AI generation, Prisma writes).
   * A bare setTimeout(async () => ...) turns any rejection into an unhandled
   * rejection that can crash the whole process — taking every concurrent game
   * down with it. Route every timer callback through here so a failure only
   * ends the one room it happened in.
   */
  private runTimer(room: LobbyRoom, fn: () => void | Promise<void>) {
    Promise.resolve()
      .then(fn)
      .catch((err) => {
        console.error("[LobbyManager] round timer failed", err);
        this.failRound(room);
      });
  }

  private failRound(room: LobbyRoom) {
    if (room.round?.timer) clearTimeout(room.round.timer);
    room.round = null;
    room.status = "finished";
    this.broadcast(room, { type: "error", message: "This game hit an error and had to end. Please start a new one." });
    this.sendLobbyState(room);
  }

  private enterPhase(room: LobbyRoom, phase: RoundInternal["phase"], durationMs: number) {
    const round = room.round;
    if (!round) return;
    round.phase = phase;
    round.phaseEndsAt = new Date(Date.now() + durationMs).toISOString();
    if (round.timer) clearTimeout(round.timer);
    round.timer = setTimeout(() => this.runTimer(room, () => this.advancePhase(room)), durationMs);
    this.sendRoundStateToAll(room);
  }

  private async advancePhase(room: LobbyRoom) {
    const round = room.round;
    if (!round) return;

    if (round.phase === "answer") {
      this.autoSubmitMissingAnswers(room);
      this.enterPhase(room, "debate", PHASE_DURATIONS_MS.debate);
      return;
    }
    if (round.phase === "debate") {
      this.enterPhase(room, "vote", PHASE_DURATIONS_MS.vote);
      return;
    }
    if (round.phase === "vote") {
      await this.finishRound(room);
      return;
    }
  }

  private autoSubmitMissingAnswers(room: LobbyRoom) {
    const round = room.round;
    if (!round) return;
    for (const player of room.players.values()) {
      if (round.answers.has(player.lobbyPlayerId)) continue;
      const text =
        player.lobbyPlayerId === round.impostorPlayerId
          ? "I didn't have anything to add, honestly."
          : "Sorry, ran out of time to answer!";
      round.answers.set(player.lobbyPlayerId, {
        text,
        submittedAt: new Date().toISOString(),
        isAutoSubmitted: true,
      });
    }
  }

  private async finishRound(room: LobbyRoom) {
    const round = room.round;
    if (!round) return;
    const votesObj = Object.fromEntries(round.votes);
    const tally = tallyVotes(votesObj, round.impostorPlayerId);

    for (const player of room.players.values()) {
      const humansWon = tally.impostorCaught;
      const playerIsImpostor = player.lobbyPlayerId === round.impostorPlayerId;
      const playerWon = playerIsImpostor ? !humansWon : humansWon;
      if (playerWon) {
        room.roundsWon.set(player.lobbyPlayerId, (room.roundsWon.get(player.lobbyPlayerId) ?? 0) + 1);
      }
    }

    round.phase = "reveal";
    round.phaseEndsAt = new Date(Date.now() + PHASE_DURATIONS_MS.reveal).toISOString();
    await this.persistRound(room, round);

    const isFinalRound = round.roundNumber >= room.totalRounds;
    this.sendRoundStateToAll(room, isFinalRound);

    round.timer = setTimeout(
      () =>
        this.runTimer(room, async () => {
          if (isFinalRound) {
            await this.endGame(room);
          } else {
            await this.beginRound(room, round.roundNumber + 1, round.impostorPlayerId);
          }
        }),
      PHASE_DURATIONS_MS.reveal,
    );
  }

  private async persistRound(room: LobbyRoom, round: RoundInternal) {
    try {
      await prisma.round.update({ where: { id: round.dbRoundId }, data: { phase: "reveal" } });
      const playersByLobbyPlayerId = new Map([...room.players.values()].map((p) => [p.lobbyPlayerId, p]));
      await prisma.$transaction([
        ...[...round.answers.entries()].map(([lobbyPlayerId, answer]) => {
          const player = playersByLobbyPlayerId.get(lobbyPlayerId);
          if (!player) return prisma.answer.count({ where: { id: "noop" } });
          return prisma.answer.upsert({
            where: { roundId_lobbyPlayerId: { roundId: round.dbRoundId, lobbyPlayerId } },
            update: { text: answer.text, isAutoSubmitted: answer.isAutoSubmitted },
            create: {
              roundId: round.dbRoundId,
              lobbyPlayerId,
              userId: player.userId,
              text: answer.text,
              isAutoSubmitted: answer.isAutoSubmitted,
            },
          });
        }),
        ...[...round.votes.entries()].map(([voterLobbyPlayerId, votedForLobbyPlayerId]) => {
          const voter = playersByLobbyPlayerId.get(voterLobbyPlayerId);
          if (!voter) return prisma.vote.count({ where: { id: "noop" } });
          return prisma.vote.upsert({
            where: { roundId_voterPlayerId: { roundId: round.dbRoundId, voterPlayerId: voterLobbyPlayerId } },
            update: { votedForId: votedForLobbyPlayerId },
            create: {
              roundId: round.dbRoundId,
              voterPlayerId: voterLobbyPlayerId,
              voterId: voter.userId,
              votedForId: votedForLobbyPlayerId,
            },
          });
        }),
      ]);
    } catch (err) {
      // Persistence is best-effort; in-memory state already drove the live game.
      console.error("failed to persist round", err);
    }
  }

  private async endGame(room: LobbyRoom) {
    room.status = "finished";
    const impostorId = room.round?.impostorPlayerId ?? "";
    const finalVotes = room.round?.votes ?? new Map<string, string>();
    const scoreboard: ScoreboardEntry[] = [];
    let humanRoundWins = 0;
    let impostorRoundWins = 0;

    for (const player of room.players.values()) {
      const isImpostor = player.lobbyPlayerId === impostorId;
      const roundsWon = room.roundsWon.get(player.lobbyPlayerId) ?? 0;
      if (isImpostor) impostorRoundWins = roundsWon;
      else humanRoundWins = Math.max(humanRoundWins, roundsWon);
      scoreboard.push({
        playerId: player.lobbyPlayerId,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl,
        wasImpostor: isImpostor,
        correctVote: finalVotes.get(player.lobbyPlayerId) === impostorId,
        roundsWon,
      });
    }
    const impostorOverallCaught = humanRoundWins > impostorRoundWins;

    const result: GameResult = { impostorId, impostorCaught: impostorOverallCaught, scoreboard };

    await prisma.lobby.update({ where: { id: room.id }, data: { status: "finished" } });
    for (const player of room.players.values()) {
      const isImpostor = player.lobbyPlayerId === impostorId;
      const won = isImpostor ? !impostorOverallCaught : impostorOverallCaught;
      await prisma.user.update({
        where: { id: player.userId },
        data: won ? { wins: { increment: 1 } } : { losses: { increment: 1 } },
      });
    }

    this.broadcast(room, { type: "game_result", result });
  }

  submitAnswer(room: LobbyRoom, userId: string, text: string) {
    const round = room.round;
    const player = room.players.get(userId);
    if (!round || !player) return;
    if (round.phase !== "answer") throw new GameError("Not accepting answers right now");
    round.answers.set(player.lobbyPlayerId, {
      text: text.trim(),
      submittedAt: new Date().toISOString(),
      isAutoSubmitted: false,
    });
    this.sendRoundStateToAll(room);
  }

  async requestAiSuggestion(room: LobbyRoom, userId: string) {
    const round = room.round;
    const player = room.players.get(userId);
    if (!round || !player) return;
    if (player.lobbyPlayerId !== round.impostorPlayerId) throw new GameError("Only the impostor gets AI help");
    if (round.aiSuggestionCount >= MAX_AI_SUGGESTIONS_PER_ROUND) {
      throw new GameError("No more AI suggestions this round");
    }
    round.aiSuggestionCount += 1;
    const otherAnswers = [...round.answers.values()].map((a) => a.text);
    const suggestion = await suggestImpostorAnswer(round.prompt, otherAnswers);
    this.broadcast(room, { type: "ai_suggestion", text: suggestion }, userId);
  }

  castVote(room: LobbyRoom, userId: string, votedForLobbyPlayerId: string) {
    const round = room.round;
    const voter = room.players.get(userId);
    const target = findByLobbyPlayerId(room, votedForLobbyPlayerId);
    if (!round || !voter || !target) return;
    if (round.phase !== "vote") throw new GameError("Voting is closed");
    if (voter.userId === target.userId) throw new GameError("You cannot vote for yourself");
    round.votes.set(voter.lobbyPlayerId, target.lobbyPlayerId);
    this.sendRoundStateToAll(room);
  }

  chatMessage(room: LobbyRoom, userId: string, text: string): ChatMessage {
    const player = room.players.get(userId);
    if (!player) throw new GameError("Not in lobby");
    const message: ChatMessage = {
      id: nanoid(10),
      playerId: player.lobbyPlayerId,
      displayName: player.displayName,
      text: text.trim(),
      sentAt: new Date().toISOString(),
    };
    this.broadcast(room, { type: "chat_message", message });
    return message;
  }

  toggleRevealNames(room: LobbyRoom, userId: string, revealNames: boolean) {
    if (userId !== room.hostUserId) throw new GameError("Only the host can toggle this");
    room.revealNames = revealNames;
    this.sendRoundStateToAll(room);
  }

  async rematch(room: LobbyRoom, userId: string) {
    if (userId !== room.hostUserId) throw new GameError("Only the host can start a rematch");
    if (room.status !== "finished") throw new GameError("Game is not finished yet");
    room.status = "waiting";
    room.currentRoundNumber = 0;
    room.round = null;
    room.usedPrompts = new Set();
    room.roundsWon = new Map();
    for (const player of room.players.values()) player.isReady = player.isHost;
    await prisma.lobby.update({ where: { id: room.id }, data: { status: "waiting", currentRound: 0 } });
    this.sendLobbyState(room);
  }

  private sendLobbyState(room: LobbyRoom) {
    this.broadcast(room, { type: "lobby_state", lobby: serializeLobby(room) });
  }

  private sendRoundStateToAll(room: LobbyRoom, revealImpostor = false) {
    for (const userId of room.players.keys()) this.sendRoundStateTo(room, userId, revealImpostor);
  }

  private sendRoundStateTo(room: LobbyRoom, userId: string, revealImpostor = false) {
    const round = room.round;
    if (!round) return;
    const player = room.players.get(userId);
    if (!player || !player.ws || player.ws.readyState !== player.ws.OPEN) return;

    const state: RoundState = {
      roundNumber: round.roundNumber,
      phase: round.phase,
      scenario: { category: round.category as RoundState["scenario"]["category"], prompt: round.prompt },
      phaseEndsAt: round.phaseEndsAt,
      revealNames: room.revealNames,
      answers: [...round.answers.entries()].map(([lobbyPlayerId, a]) => ({
        playerId: lobbyPlayerId,
        text: a.text,
        submittedAt: a.submittedAt,
        isAutoSubmitted: a.isAutoSubmitted,
      })),
      ...(round.phase === "reveal" ? { votes: Object.fromEntries(round.votes) } : {}),
      ...(revealImpostor ? { impostorId: round.impostorPlayerId } : {}),
    };
    player.ws.send(JSON.stringify({ type: "round_state", round: state }));

    if (round.roundNumber === 1 && round.phase === "prompt") {
      const isImpostor = player.lobbyPlayerId === round.impostorPlayerId;
      player.ws.send(JSON.stringify({ type: "your_role", isImpostor, aiSuggestion: null }));
    }
  }
}

function findByLobbyPlayerId(room: LobbyRoom, lobbyPlayerId: string): PlayerConn | undefined {
  for (const player of room.players.values()) {
    if (player.lobbyPlayerId === lobbyPlayerId) return player;
  }
  return undefined;
}

function toPlayerConn(lobbyPlayerId: string, user: { id: string; telegramId: string; displayName: string; avatarUrl: string | null }, isHost: boolean): PlayerConn {
  return {
    lobbyPlayerId,
    userId: user.id,
    telegramId: user.telegramId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isHost,
    isReady: isHost,
    connected: false,
    ws: null,
    wins: 0,
    losses: 0,
  };
}

export function serializeLobby(room: LobbyRoom): LobbyState {
  const players: PublicPlayer[] = [...room.players.values()].map((p) => ({
    id: p.lobbyPlayerId,
    telegramId: p.telegramId,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isHost: p.isHost,
    isReady: p.isReady,
    connected: p.connected,
    wins: p.wins,
    losses: p.losses,
  }));
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    hostId: room.players.get(room.hostUserId)?.lobbyPlayerId ?? "",
    totalRounds: room.totalRounds,
    currentRound: room.currentRoundNumber,
    players,
    createdAt: room.createdAt,
  };
}

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}

export const lobbyManager = new LobbyManager();
