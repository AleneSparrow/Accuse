import { useEffect, useState } from "react";
import { PHASE_DURATIONS_MS, type RoundPhase } from "@accuse/shared";

const PHASE_LABELS: Record<RoundPhase, string> = {
  prompt: "Get ready",
  answer: "Write your answer",
  debate: "Debate & discuss",
  vote: "Vote for the impostor",
  reveal: "Reveal",
};

const PHASE_DURATIONS: Partial<Record<RoundPhase, number>> = {
  answer: PHASE_DURATIONS_MS.answer,
  debate: PHASE_DURATIONS_MS.debate,
  vote: PHASE_DURATIONS_MS.vote,
  reveal: PHASE_DURATIONS_MS.reveal,
};

export function PhaseBanner({ phase, phaseEndsAt, roundNumber, totalRounds }: {
  phase: RoundPhase;
  phaseEndsAt: string | null;
  roundNumber: number;
  totalRounds: number;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!phaseEndsAt) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [phaseEndsAt]);

  const endsAt = phaseEndsAt ? new Date(phaseEndsAt).getTime() : null;
  const remainingMs = endsAt ? Math.max(0, endsAt - now) : null;
  const remainingSec = remainingMs !== null ? Math.ceil(remainingMs / 1000) : null;
  const duration = PHASE_DURATIONS[phase];
  const pct = remainingMs !== null && duration ? Math.max(0, Math.min(100, (remainingMs / duration) * 100)) : 100;

  return (
    <div className="phase-banner">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="phase-label">
            Round {roundNumber} / {totalRounds} · {PHASE_LABELS[phase]}
          </div>
        </div>
        {remainingSec !== null && <div className="phase-timer">{remainingSec}s</div>}
      </div>
      {duration && (
        <div className="timer-bar-track">
          <div className="timer-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
