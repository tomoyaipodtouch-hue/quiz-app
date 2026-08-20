import { io } from "socket.io-client";

// 同一オリジンに接続(開発時は vite.config.js のプロキシ経由でバックエンドへ)
export const socket = io({ autoConnect: true });
