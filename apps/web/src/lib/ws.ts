import type { WsClientMessage } from "@accuse/shared";
import { getInitData } from "./telegram";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws";

type Listener = (event: unknown) => void;

export class GameSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectAttempt = 0;
  private closedByUser = false;
  private lobbyId: string;

  constructor(lobbyId: string) {
    this.lobbyId = lobbyId;
    this.connect();
  }

  private connect() {
    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.send({ type: "auth", initData: getInitData(), lobbyId: this.lobbyId });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        for (const listener of this.listeners) listener(data);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (this.closedByUser) return;
      const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 8000);
      this.reconnectAttempt += 1;
      setTimeout(() => this.connect(), delay);
    };
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(message: WsClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close() {
    this.closedByUser = true;
    this.ws?.close();
  }
}
