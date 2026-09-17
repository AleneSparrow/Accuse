import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { PublicPlayer } from "@accuse/shared";
import { useGame } from "../hooks/useGame";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { PhaseBanner } from "../components/PhaseBanner";
import { Toast } from "../components/Toast";
import { Skeleton } from "../components/Skeleton";
import { Results } from "./Results";
import { getInitData, hapticImpact, hapticNotify } from "../lib/telegram";
import { MAX_ANSWER_LENGTH, MAX_CHAT_MESSAGE_LENGTH } from "@accuse/shared";

export function Game() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const navigate = useNavigate();
  const { lobby, round, chat, result, role, aiSuggestion, error, clearError, send } = useGame(lobbyId ?? null);

  const [myTelegramId, setMyTelegramId] = useState<string | null>(null);
  const [roleAcked, setRoleAcked] = useState(false);
  const [answerDraft, setAnswerDraft] = useState("");
  const [answerSent, setAnswerSent] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [voteSent, setVoteSent] = useState(false);
  const [chatDraft, setChatDraft] = useState("");

  useEffect(() => {
    try {
      const params = new URLSearchParams(getInitData());
      const user = JSON.parse(params.get("user") ?? "null");
      setMyTelegramId(user?.id != null ? String(user.id) : null);
    } catch {
      setMyTelegramId(null);
    }
  }, []);

  const me = useMemo(() => lobby?.players.find((p) => p.telegramId === myTelegramId), [lobby, myTelegramId]);

  // Reset per-round input state whenever the phase (or round number) changes.
  useEffect(() => {
    setAnswerDraft("");
    setAnswerSent(false);
    setSelectedVote(null);
    setVoteSent(false);
  }, [round?.roundNumber, round?.phase]);

  useEffect(() => {
    if (!lobby) return;
    if (lobby.status === "waiting") navigate(`/lobby/${lobby.id}`, { replace: true });
  }, [lobby?.status, lobby?.id, navigate]);

  useEffect(() => {
    if (aiSuggestion) hapticImpact("light");
  }, [aiSuggestion]);

  if (!lobby || (lobby.status === "in_progress" && !round)) {
    return (
      <div className="screen stack">
        <Skeleton height={60} />
        <Skeleton height={200} />
      </div>
    );
  }

  if (result && me) {
    return <Results result={result} lobby={lobby} isHost={me.isHost} onRematch={() => send({ type: "rematch" })} />;
  }

  if (!round || !me) {
    return (
      <div className="screen stack">
        <Skeleton height={60} />
        <Skeleton height={200} />
      </div>
    );
  }

  const orderedPlayers = [...lobby.players].sort((a, b) => a.id.localeCompare(b.id));
  const nameFor = (playerId: string): string => {
    if (round.revealNames) return orderedPlayers.find((p) => p.id === playerId)?.displayName ?? "Unknown";
    const idx = orderedPlayers.findIndex((p) => p.id === playerId);
    return `Player ${idx + 1}`;
  };

  function submitAnswer() {
    if (!answerDraft.trim()) return;
    send({ type: "submit_answer", text: answerDraft.trim() });
    setAnswerSent(true);
    hapticImpact("medium");
  }

  function castVote(targetId: string) {
    if (voteSent) return;
    setSelectedVote(targetId);
  }

  function confirmVote() {
    if (!selectedVote) return;
    send({ type: "cast_vote", votedForId: selectedVote });
    setVoteSent(true);
    hapticNotify("success");
  }

  function sendChat() {
    if (!chatDraft.trim()) return;
    send({ type: "chat_message", text: chatDraft.trim() });
    setChatDraft("");
  }

  return (
    <div className="screen stack" style={{ flex: 1 }}>
      <PhaseBanner phase={round.phase} phaseEndsAt={round.phaseEndsAt} roundNumber={round.roundNumber} totalRounds={lobby.totalRounds} />

      {round.roundNumber === 1 && round.phase === "prompt" && role && !roleAcked ? (
        <RoleScreen isImpostor={role.isImpostor} onContinue={() => setRoleAcked(true)} />
      ) : (
        <>
          <div className="card">
            <div className="tagline" style={{ marginBottom: 4, textTransform: "uppercase", fontWeight: 700 }}>
              {round.scenario.category}
            </div>
            <p style={{ fontSize: 17, lineHeight: 1.4, margin: 0 }}>{round.scenario.prompt}</p>
          </div>

          {round.phase === "prompt" && <div className="empty-state">Get ready…</div>}

          {round.phase === "answer" && (
            <AnswerPhase
              isImpostor={role?.isImpostor ?? false}
              draft={answerDraft}
              setDraft={setAnswerDraft}
              sent={answerSent}
              onSubmit={submitAnswer}
              aiSuggestion={aiSuggestion}
              onRequestSuggestion={() => send({ type: "request_ai_suggestion" })}
            />
          )}

          {round.phase === "debate" && (
            <DebatePhase
              answers={round.answers}
              nameFor={nameFor}
              revealNames={round.revealNames}
              isHost={me.isHost}
              onToggleReveal={(v) => send({ type: "toggle_reveal_names", revealNames: v })}
              chat={chat}
              chatDraft={chatDraft}
              setChatDraft={setChatDraft}
              onSendChat={sendChat}
            />
          )}

          {round.phase === "vote" && (
            <VotePhase
              players={orderedPlayers}
              meId={me.id}
              nameFor={nameFor}
              revealNames={round.revealNames}
              selected={selectedVote}
              voteSent={voteSent}
              onSelect={castVote}
              onConfirm={confirmVote}
            />
          )}

          {round.phase === "reveal" && <RevealPhase round={round} nameFor={nameFor} totalRounds={lobby.totalRounds} />}
        </>
      )}

      {error && <Toast message={error} onDismiss={clearError} />}
    </div>
  );
}

function RoleScreen({ isImpostor, onContinue }: { isImpostor: boolean; onContinue: () => void }) {
  return (
    <div className="role-reveal">
      <span className="tagline">You are</span>
      <span className="role-word" style={{ color: isImpostor ? "var(--accent)" : "var(--bone)" }}>
        {isImpostor ? "The Impostor" : "Human"}
      </span>
      <p className="tagline" style={{ maxWidth: 320 }}>
        {isImpostor
          ? "Blend in. Answer like a human would — the AI will help if you ask for it."
          : "Answer honestly and watch closely. Someone here isn't human."}
      </p>
      <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onContinue}>
        Got it
      </button>
    </div>
  );
}

function AnswerPhase({
  isImpostor,
  draft,
  setDraft,
  sent,
  onSubmit,
  aiSuggestion,
  onRequestSuggestion,
}: {
  isImpostor: boolean;
  draft: string;
  setDraft: (v: string) => void;
  sent: boolean;
  onSubmit: () => void;
  aiSuggestion: string | null;
  onRequestSuggestion: () => void;
}) {
  return (
    <div className="stack">
      <textarea
        className="field"
        rows={4}
        maxLength={MAX_ANSWER_LENGTH}
        placeholder="Type your answer…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {isImpostor && (
        <button className="btn btn-secondary" onClick={onRequestSuggestion}>
          Get AI Suggestion
        </button>
      )}
      {aiSuggestion && (
        <div className="card">
          <div className="tagline" style={{ marginBottom: 6 }}>
            Suggested answer
          </div>
          <p style={{ margin: "0 0 10px" }}>{aiSuggestion}</p>
          <button className="btn btn-secondary" onClick={() => setDraft(aiSuggestion)}>
            Use this
          </button>
        </div>
      )}
      <button className="btn btn-primary" onClick={onSubmit} disabled={sent || !draft.trim()}>
        {sent ? "Answer Submitted" : "Submit"}
      </button>
    </div>
  );
}

function DebatePhase({
  answers,
  nameFor,
  revealNames,
  isHost,
  onToggleReveal,
  chat,
  chatDraft,
  setChatDraft,
  onSendChat,
}: {
  answers: { playerId: string; text: string }[];
  nameFor: (id: string) => string;
  revealNames: boolean;
  isHost: boolean;
  onToggleReveal: (v: boolean) => void;
  chat: { id: string; playerId: string; displayName: string; text: string }[];
  chatDraft: string;
  setChatDraft: (v: string) => void;
  onSendChat: () => void;
}) {
  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      {isHost && (
        <button className="btn-ghost" style={{ alignSelf: "flex-end" }} onClick={() => onToggleReveal(!revealNames)}>
          {revealNames ? "Hide names" : "Show names"}
        </button>
      )}
      <div className="stack">
        {answers.map((a) => (
          <div className="answer-card" key={a.playerId}>
            <div className="answer-author">{nameFor(a.playerId)}</div>
            <div>{a.text}</div>
          </div>
        ))}
      </div>

      <div className="chat-scroll">
        {chat.map((m) => (
          <div className="chat-bubble" key={m.id}>
            <span className="author">{m.displayName}</span>
            {m.text}
          </div>
        ))}
      </div>
      <div className="row">
        <input
          className="field"
          style={{ textTransform: "none", letterSpacing: "normal", fontSize: 15, textAlign: "left" }}
          placeholder="Say something…"
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          value={chatDraft}
          onChange={(e) => setChatDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSendChat()}
        />
        <button className="btn btn-primary" style={{ width: "auto", padding: "12px 18px" }} onClick={onSendChat}>
          Send
        </button>
      </div>
    </div>
  );
}

function VotePhase({
  players,
  meId,
  nameFor,
  revealNames,
  selected,
  voteSent,
  onSelect,
  onConfirm,
}: {
  players: PublicPlayer[];
  meId: string;
  nameFor: (id: string) => string;
  revealNames: boolean;
  selected: string | null;
  voteSent: boolean;
  onSelect: (id: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="stack">
      {players
        .filter((p) => p.id !== meId)
        .map((p) => (
          <button
            key={p.id}
            className={`vote-option ${selected === p.id ? "selected" : ""}`}
            disabled={voteSent}
            onClick={() => onSelect(p.id)}
          >
            <PlayerAvatar name={p.displayName} avatarUrl={revealNames ? p.avatarUrl : null} size={34} />
            <span className="player-name">{nameFor(p.id)}</span>
          </button>
        ))}
      <button className="btn btn-primary" disabled={!selected || voteSent} onClick={onConfirm}>
        {voteSent ? "Vote Cast" : "Accuse"}
      </button>
    </div>
  );
}

function RevealPhase({
  round,
  nameFor,
  totalRounds,
}: {
  round: { votes?: Record<string, string>; impostorId?: string; roundNumber: number };
  nameFor: (id: string) => string;
  totalRounds: number;
}) {
  const counts: Record<string, number> = {};
  for (const votedFor of Object.values(round.votes ?? {})) counts[votedFor] = (counts[votedFor] ?? 0) + 1;
  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const isFinal = round.roundNumber >= totalRounds;

  return (
    <div className="stack">
      <div className="card stack">
        <div className="tagline">Votes this round</div>
        {entries.length === 0 && <div className="empty-state" style={{ padding: 12 }}>No one voted in time.</div>}
        {entries.map(([id, count]) => (
          <div className="row" key={id} style={{ justifyContent: "space-between" }}>
            <span>{nameFor(id)}</span>
            <span style={{ fontWeight: 700 }}>{count}</span>
          </div>
        ))}
      </div>
      {round.impostorId ? (
        <div className="card">
          <div className="tagline">The impostor was</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>{nameFor(round.impostorId)}</div>
        </div>
      ) : (
        <div className="empty-state">{isFinal ? "Tallying final results…" : "Next round starting…"}</div>
      )}
    </div>
  );
}
