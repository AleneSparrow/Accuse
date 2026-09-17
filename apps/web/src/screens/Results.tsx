import type { GameResult, LobbyState } from "@accuse/shared";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { shareInviteLink, hapticNotify } from "../lib/telegram";
import { useEffect } from "react";

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME ?? "your_bot";

export function Results({
  result,
  lobby,
  isHost,
  onRematch,
}: {
  result: GameResult;
  lobby: LobbyState;
  isHost: boolean;
  onRematch: () => void;
}) {
  useEffect(() => {
    hapticNotify(result.impostorCaught ? "success" : "error");
  }, [result.impostorCaught]);

  const sorted = [...result.scoreboard].sort((a, b) => b.roundsWon - a.roundsWon);

  return (
    <div className="screen stack">
      <div className="masthead">
        <div>
          <h1 style={{ fontSize: 26 }}>{result.impostorCaught ? "Humans Win!" : "Impostor Wins!"}</h1>
          <p className="tagline">
            {result.impostorCaught ? "The group caught the impostor." : "The impostor slipped away undetected."}
          </p>
        </div>
      </div>

      <div className="card">
        {sorted.map((entry, i) => (
          <div className="scoreboard-row" key={entry.playerId}>
            <span style={{ color: "var(--bone-dim)", width: 18, fontWeight: 700 }}>{i + 1}</span>
            <PlayerAvatar name={entry.displayName} avatarUrl={entry.avatarUrl} size={34} />
            <span className="player-name">{entry.displayName}</span>
            {entry.wasImpostor && <span className="impostor-tag">Impostor</span>}
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{entry.roundsWon} rd</span>
          </div>
        ))}
      </div>

      <div className="stack">
        {isHost && (
          <button className="btn btn-primary" onClick={onRematch}>
            Rematch
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => shareInviteLink(BOT_USERNAME, lobby.code)}>
          Invite More Friends
        </button>
      </div>
    </div>
  );
}
