import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { socket } from "../socket.js";
import { useJoinUrl } from "../useJoinUrl.js";
import ResultBars from "../ResultBars.jsx";
import PieChart from "../PieChart.jsx";
import ThemeToggle from "../ThemeToggle.jsx";

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

  if (!state) {
    return (
      <div className="display-fullscreen">
        <p className="dim">接続中...</p>
      </div>
    );
  }

  return (
    <div className="display-fullscreen">
      <ThemeToggle style={{ position: "fixed", top: 16, right: 16 }} />

      {state.status === "lobby" && (
        <>
          <div className="title" style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            {state.quiz.title}
          </div>
          <p className="dim" style={{ fontSize: "0.9rem" }}>
            スマホでQRコードを読み取って参加してください
          </p>
          {joinUrls[0] && (
            <div className="qr-box" style={{ margin: "24px 0" }}>
              <QRCodeSVG value={joinUrls[0]} size={220} />
            </div>
          )}
          {joinUrls.map((u) => (
            <p key={u} style={{ fontSize: "0.85rem" }}>
              {u}
            </p>
          ))}
          <p style={{ fontSize: "1.1rem", fontWeight: 600, marginTop: 24 }}>
            参加者: {state.playerCount}人
          </p>
        </>
      )}

      {state.status === "question" && state.question && (
        <div style={{ width: "100%", maxWidth: 900 }}>
          <div className="badge">
            問題 {state.questionIndex + 1} / {state.quiz.totalQuestions} · 回答受付中
          </div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 600, margin: "16px 0" }}>{state.question.text}</h1>
          <div className="choice-grid">
            {state.question.choices.map((c, i) => (
              <div key={i} className="choice-btn" style={{ fontSize: "0.95rem", fontWeight: 500 }}>
                {CHOICE_LABELS[i]}: {c}
              </div>
            ))}
          </div>
          <p className="dim" style={{ marginTop: 16, fontSize: "0.9rem" }}>
            回答済み: {state.answeredCount} / {state.playerCount}
          </p>
        </div>
      )}

      {state.status === "reveal" && state.question && (
        <div style={{ width: "100%", maxWidth: 1100 }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 600, margin: "16px 0", textAlign: "center" }}>
            {state.question.text}
          </h1>
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
          <div className="title" style={{ fontSize: "1.25rem", fontWeight: 600, textAlign: "center" }}>
            {state.status === "ended" ? "最終結果" : "現在のランキング"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            {state.leaderboard.slice(0, 8).map((p, i) => (
              <div className="leaderboard-row" key={p.token}>
                <span className="leaderboard-rank">{i + 1}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{p.name}</span>
                <span>{p.score}点</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
