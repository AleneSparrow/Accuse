import { Route, Routes } from "react-router-dom";
import { Home } from "./screens/Home";
import { Lobby } from "./screens/Lobby";
import { Game } from "./screens/Game";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/lobby/:lobbyId" element={<Lobby />} />
      <Route path="/game/:lobbyId" element={<Game />} />
    </Routes>
  );
}
