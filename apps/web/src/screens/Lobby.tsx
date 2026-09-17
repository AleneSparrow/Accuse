import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MIN_PLAYERS } from "@accuse/shared";
import { useGame } from "../hooks/useGame";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { Toast } from "../components/Toast";
import { Skeleton } from "../components/Skeleton";
import { shareInviteLink, switchToInlineInvite, isTelegram, hapticImpact } from "../lib/telegram";
import { getInitData } from "../lib/telegram";

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME ?? "your_bot";

export function Lobby() {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const navigate = useNavigate();
  const { lobby, error, clearError, send } = useGame(lobbyId ?? null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(getInitData());
      const user = JSON.parse(params.get("user") ?? "null");
      setMyUserId(user?.id != null ? String(user.id) : null);
    } catch {
      setMyUserId(null);
    }
  }, []);

  const me = useMemo(() => lobby?.players.find((p) => p.telegramId === myUserId), [lobby, myUserId]);

  useEffect(() => {
    if (lobby?.status === "in_progress") navigate(`/game/${lobby.id}`, { replace: true });
  }, [lobby?.status, lobby?.id, navigate]);

  if (!lobby) {
    return (
      <div className="screen stack">
        <Skeleton height={40} />
        <Skeleton height={120} />
        <Skeleton height={52} />
      </div>
    );
  }

  const allReady = lobby.players.every((p) => p.isReady || p.isHost);
  const canStart = me?.isHost && lobby.players.length >= MIN_PLAYERS && allReady;

  return (
    <div className="screen stack">
      <div className="masthead">
        <div>
          <h1 style={{ fontSize: 22 }}>
            LOBBY <span className="accent">{lobby.code}</span>
          </h1>
          <p className="tagline">{lobby.players.length}/8 players</p>
        </div>
        <button className="btn-ghost" onClick={() => navigate("/")}>
          Leave
        </button>
      </div>

      <div className="card">
        {lobby.players.map((p) => (
          <div className="player-row" key={p.id}>
            <PlayerAvatar name={p.displayName} avatarUrl={p.avatarUrl} />
            <span className="player-name">
              {p.isSupporter ? "⭐ " : ""}
              {p.displayName}
              {p.telegramId === myUserId ? " (you)" : ""}
            </span>
            {!p.connected && <span className="badge badge-offline">offline</span>}
            {p.isHost ? (
              <span className="badge badge-host">Host</span>
            ) : (
              <span className={`badge ${p.isReady ? "badge-ready" : "badge-waiting"}`}>
                {p.isReady ? "Ready" : "Waiting"}
              </span>
            )}
            {me?.isHost && !p.isHost && (
              <button className="btn-ghost" onClick={() => send({ type: "kick_player", playerId: p.id })}>
                Kick
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="stack">
        <button
          className="btn btn-secondary"
          onClick={() => {
            hapticImpact();
            shareInviteLink(BOT_USERNAME, lobby.code);
          }}
        >
          Invite Friends
        </button>
        {isTelegram() && (
          <button className="btn btn-secondary" onClick={() => switchToInlineInvite(lobby.code)}>
            Share to a chat
          </button>
        )}
      </div>

      {!me?.isHost && (
        <button
          className={`btn ${me?.isReady ? "btn-secondary" : "btn-primary"}`}
          onClick={() => send({ type: "ready", isReady: !me?.isReady })}
        >
          {me?.isReady ? "Not Ready" : "Ready Up"}
        </button>
      )}

      {me?.isHost && (
        <button className="btn btn-primary" disabled={!canStart} onClick={() => send({ type: "start_game" })}>
          {lobby.players.length < MIN_PLAYERS
            ? `Need ${MIN_PLAYERS - lobby.players.length} more player(s)`
            : !allReady
              ? "Waiting for everyone to be ready"
              : "Start Game"}
        </button>
      )}

      {error && <Toast message={error} onDismiss={clearError} />}
    </div>
  );
}
