import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SUPPORTER_STARS_PRICE } from "@accuse/shared";
import { createLobby, joinLobby, createSupporterInvoiceLink, ApiError } from "../lib/api";
import { getStartParam, isTelegram, openInvoice, hapticNotify } from "../lib/telegram";
import { Toast } from "../components/Toast";

export function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devTelegramId, setDevTelegramId] = useState("");

  useEffect(() => {
    const startParam = getStartParam();
    if (startParam) setCode(startParam.toUpperCase());
  }, []);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const { lobby } = await createLobby();
      navigate(`/lobby/${lobby.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create lobby");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (code.trim().length < 4) {
      setError("Enter a valid lobby code");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { lobby } = await joinLobby(code.trim());
      navigate(`/lobby/${lobby.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to join lobby");
    } finally {
      setBusy(false);
    }
  }

  async function handleSupport() {
    setSupportBusy(true);
    setError(null);
    try {
      const { link } = await createSupporterInvoiceLink();
      const status = await openInvoice(link);
      if (status === "paid") {
        hapticNotify("success");
        setError("⭐ Thank you for supporting ACCUSE! Your badge is live.");
      } else if (status === "failed") {
        setError("Payment failed. Please try again.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start payment");
    } finally {
      setSupportBusy(false);
    }
  }

  function saveDevInitData() {
    const fakeUser = { id: Number(devTelegramId) || Date.now() % 100000, first_name: `Tester${devTelegramId || ""}` };
    const params = new URLSearchParams({
      user: JSON.stringify(fakeUser),
      auth_date: String(Math.floor(Date.now() / 1000)),
      hash: "dev-mode-not-validated",
    });
    window.localStorage.setItem("dev_init_data", params.toString());
    setError("Dev identity saved locally. Note: the real API will reject unsigned initData — use the Telegram bot for a full test.");
  }

  return (
    <div className="screen">
      <div className="masthead">
        <div>
          <h1>
            AC<span className="accent">CUSE</span>
          </h1>
          <p className="tagline">One of you is lying. It might be the machine.</p>
        </div>
      </div>

      <div className="stack">
        <button className="btn btn-primary" onClick={handleCreate} disabled={busy}>
          Create Lobby
        </button>

        <div className="card stack">
          <input
            className="field"
            placeholder="CODE"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button className="btn btn-secondary" onClick={handleJoin} disabled={busy}>
            Join Lobby
          </button>
        </div>

        {isTelegram() && (
          <button className="btn btn-secondary" onClick={handleSupport} disabled={supportBusy}>
            ⭐ Support ACCUSE ({SUPPORTER_STARS_PRICE} Stars)
          </button>
        )}

        {!isTelegram() && (
          <div className="card stack">
            <p className="tagline" style={{ margin: 0 }}>
              Not running inside Telegram. For local two-browser testing, set a dev identity (the API will still
              reject it — connect via the bot's Mini App button for a real end-to-end test).
            </p>
            <div className="row">
              <input
                className="field"
                style={{ textTransform: "none", letterSpacing: "normal", fontSize: 15 }}
                placeholder="telegram id (any number)"
                value={devTelegramId}
                onChange={(e) => setDevTelegramId(e.target.value)}
              />
              <button className="btn btn-secondary" style={{ width: "auto", padding: "12px 16px" }} onClick={saveDevInitData}>
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <Toast message={error} onDismiss={() => setError(null)} />}
    </div>
  );
}
