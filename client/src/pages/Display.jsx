import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { socket } from "../socket.js";
import { useJoinUrl } from "../useJoinUrl.js";
import ResultBars from "../ResultBars.jsx";
import PieChart from "../PieChart.jsx";

const CHOICE_LABELS = ["A", "B", "C", "D"];

export default function Display() {
  const [state, setState] = useState(null);
  const joinUrls = useJoinUrl();

  useEffect(() => {
    socket.emit("display:hello");
    const onState = (s) => setState(s);
    socket.on("state", onState);
    return () => socket.off("state", onState);
  }, []);

  // 表示画面のテーマは投影しているPCを直接操作しないので、Control側からの遠隔操作に従う
  useEffect(() => {
    if (state?.theme) {
      document.documentElement.dataset.theme = state.theme;
    }
  }, [state?.theme]);

  if (!state) {
    return (
      <div className="display-fullscreen">
        <p className="dim">接続中...</p>
      </div>
    );
  }

  return (
    <div className="display-fullscreen">
      {state.status === "lobby" && (
        <div className="lobby-split">
          <div className="lobby-split-main">
            <div className="title" style={{ fontSize: "2rem" }}>
              {state.quiz.title}
            </div>
            <p className="dim" style={{ fontSize: "1.05rem" }}>
              スマホでQRコードを読み取って参加してください
            </p>
            {joinUrls[0] && (
              <div className="qr-box" style={{ margin: "24px 0" }}>
                <QRCodeSVG value={joinUrls[0]} size={340} />
              </div>
            )}
            {joinUrls.map((u) => (
              <p key={u} style={{ fontSize: "0.95rem" }}>
                {u}
              </p>
            ))}
            {state.joinCode && (
              <p style={{ marginTop: 12 }}>
                <span className="dim" style={{ fontSize: "1.2rem" }}>
                  セッションID:{" "}
                </span>
                <span className="mono" style={{ fontWeight: 800, fontSize: "2.2rem", letterSpacing: "0.15em" }}>
                  {state.joinCode}
                </span>
              </p>
            )}
          </div>
          <div className="lobby-split-side">
            <p style={{ fontSize: "1.4rem", fontWeight: 800 }}>参加者: {state.playerCount}人</p>
            {state.players && (
              <ul className="lobby-participant-list">
                {state.players.map((p) => (
                  <li key={p.token}>{p.name}</li>
                ))}
                {state.players.length === 0 && <li className="dim">まだ誰も参加していません</li>}
              </ul>
            )}
          </div>
        </div>
      )}

      {state.status === "question" && state.question && (
        <div style={{ width: "100%", maxWidth: 900 }}>
          <div className="badge">
            問題 {state.questionIndex + 1} / {state.quiz.totalQuestions} · 回答受付中
          </div>
          <h1 style={{ fontSize: "1.7rem", margin: "16px 0" }}>{state.question.text}</h1>
          <div className="choice-grid">
            {state.question.choices.map((c, i) => (
              <div key={i} className="choice-btn" style={{ fontSize: "1.1rem" }}>
                {CHOICE_LABELS[i]}: {c}
              </div>
            ))}
          </div>
          <p className="dim" style={{ marginTop: 16, fontSize: "1rem" }}>
            回答済み: {state.answeredCount} / {state.playerCount}
          </p>
        </div>
      )}

      {state.status === "reveal" && state.question && (
        <div style={{ width: "100%", maxWidth: 1100 }}>
          <h1 style={{ fontSize: "1.7rem", margin: "16px 0", textAlign: "center" }}>{state.question.text}</h1>
          {state.choiceCounts && (
            <div className="reveal-split">
              <div>
                <ResultBars
                  choices={state.question.choices}
                  correctIndex={state.question.correctIndex}
                  choiceCounts={state.choiceCounts}
                />
                {state.question.explanation && (
                  <div className="explanation-box">{state.question.explanation}</div>
                )}
              </div>
              <PieChart choiceCounts={state.choiceCounts} />
            </div>
          )}
        </div>
      )}

      {(state.status === "leaderboard" || state.status === "ended") && state.leaderboard && (
        <div style={{ width: "100%", maxWidth: 640 }}>
          <div className="title" style={{ fontSize: "1.6rem", textAlign: "center" }}>
            {state.status === "ended" ? "最終結果" : "現在のランキング"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            {state.leaderboard.slice(0, 8).map((p, i) => (
              <div className="leaderboard-row" key={p.token}>
                <span className="leaderboard-rank mono">{i + 1}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{p.name}</span>
                <span className="mono">{p.score}点</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
