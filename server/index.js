import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

import {
  setOnChange,
  joinPlayer,
  removePlayerSocket,
  kickPlayer,
  submitAnswer,
  startQuiz,
  nextQuestion,
  revealAnswer,
  showLeaderboard,
  resetGame,
  getHostView,
  getDisplayView,
  getPlayerView,
  getAllPlayerTokens,
  getGameEpoch,
  getQuiz,
  setQuiz,
  getQuizMeta,
  setShowParticipantsOnDisplay,
  setDisplayTheme,
  verifyControlPin,
  regenerateControlPin,
  setControlPinEnabled,
} from "./gameState.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// 開発時は Vite dev サーバーが別ポートで動くので CORS を許可
io.engine.on("connection_error", () => {});

function getLanIPs() {
  const nets = networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

app.get("/api/host-info", (_req, res) => {
  res.json({ ips: getLanIPs(), port: PORT });
});

// --- Socket.IO ---
const socketToToken = new Map(); // socket.id -> player token (players room only)
const socketRole = new Map(); // socket.id -> 'host' | 'display' | 'player'

function broadcastAll() {
  io.to("control").emit("state", getHostView());
  io.to("display").emit("state", getDisplayView());
  for (const token of getAllPlayerTokens()) {
    const view = getPlayerView(token);
    for (const [socketId, t] of socketToToken.entries()) {
      if (t === token) io.to(socketId).emit("state", view);
    }
  }
}

setOnChange(broadcastAll);

function isAuthedHost(socket) {
  return socketRole.get(socket.id) === "host";
}

io.on("connection", (socket) => {
  // /control は6桁PINで保護する。認証できたソケットだけを "control" ルームに入れ、
  // host:* イベントも下のガードで未認証ソケットからは実行できないようにする
  socket.on("control:hello", (pin, cb) => {
    if (!verifyControlPin(pin)) {
      cb?.({ ok: false });
      return;
    }
    socketRole.set(socket.id, "host");
    socket.join("control");
    cb?.({ ok: true });
    socket.emit("state", getHostView());
  });

  socket.on("display:hello", () => {
    socketRole.set(socket.id, "display");
    socket.join("display");
    socket.emit("state", getDisplayView());
  });

  // 参加者ページがマウントされた直後に呼ばれる。今の世代IDを教えるだけで、
  // まだプレイヤーとして登録しない(自動再参加すべきか判断するのはクライアント側)
  socket.on("player:hello", () => {
    socket.emit("epoch", { gameEpoch: getGameEpoch(), quizTitle: getQuizMeta().title });
  });

  socket.on("player:join", ({ token, name }) => {
    socketRole.set(socket.id, "player");
    socketToToken.set(socket.id, token);
    socket.join("players");
    joinPlayer(token, name, socket.id);
    socket.emit("state", getPlayerView(token));
    io.to("control").emit("state", getHostView());
    io.to("display").emit("state", getDisplayView());
  });

  socket.on("player:answer", ({ token, choiceIndex }) => {
    submitAnswer(token, choiceIndex);
  });

  // --- host controls ---
  // 未認証(PIN未通過)のソケットからは一切操作できないようにガードする
  socket.on("host:start", () => isAuthedHost(socket) && startQuiz());
  socket.on("host:next", () => isAuthedHost(socket) && nextQuestion());
  socket.on("host:reveal", () => isAuthedHost(socket) && revealAnswer());
  socket.on("host:leaderboard", () => isAuthedHost(socket) && showLeaderboard());
  socket.on("host:reset", () => isAuthedHost(socket) && resetGame());
  socket.on("host:kick", ({ token }) => isAuthedHost(socket) && kickPlayer(token));
  socket.on(
    "host:showParticipantsOnDisplay",
    ({ show }) => isAuthedHost(socket) && setShowParticipantsOnDisplay(show)
  );
  socket.on("host:setDisplayTheme", ({ theme }) => isAuthedHost(socket) && setDisplayTheme(theme));
  socket.on("host:setControlPinEnabled", ({ enabled }) => isAuthedHost(socket) && setControlPinEnabled(enabled));
  socket.on("host:regenerateControlPin", (cb) => {
    if (!isAuthedHost(socket)) {
      cb?.({ ok: false });
      return;
    }
    cb?.({ ok: true, pin: regenerateControlPin() });
  });

  // --- クイズ設定 ---
  socket.on("host:getQuiz", (cb) => {
    if (!isAuthedHost(socket)) {
      cb?.({ ok: false });
      return;
    }
    cb?.({ ok: true, quiz: getQuiz() });
  });
  socket.on("host:setQuiz", (newQuiz, cb) => {
    if (!isAuthedHost(socket)) {
      cb?.({ ok: false });
      return;
    }
    try {
      setQuiz(newQuiz);
      cb?.({ ok: true });
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("disconnect", () => {
    const role = socketRole.get(socket.id);
    if (role === "player") {
      removePlayerSocket(socket.id);
      io.to("control").emit("state", getHostView());
      io.to("display").emit("state", getDisplayView());
    }
    socketToToken.delete(socket.id);
    socketRole.delete(socket.id);
  });
});

// 本番ビルド済みのクライアントを配信(サーバー単体で完結させる用)
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

httpServer.listen(PORT, () => {
  console.log(`Quiz server listening on http://localhost:${PORT}`);
  const ips = getLanIPs();
  if (ips.length) {
    console.log(`LAN access: ${ips.map((ip) => `http://${ip}:${PORT}`).join(", ")}`);
  }
});
