import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { socket } from "../socket.js";
import { useCountdown } from "../useCountdown.js";
import { useJoinUrl } from "../useJoinUrl.js";
import ResultBars from "../ResultBars.jsx";

const CHOICE_LABELS = ["A", "B", "C", "D"];

export default function Display() {
  const [state, setState] = useState(null);
  const joinUrls = useJoinUrl();
  const rootRef = useRef(null);

  useEffect(() => {
    socket.emit("display:hello");
    const onState = (s) => setState(s);
    socket.on("state", onState);
    return () => socket.off("state", onState);
  }, []);

  const remainingMs = useCountdown(state?.status === "question" ? state.endsAt : null);
  const remainingRatio = state?.question
    ? Math.min(1, remainingMs / (state.question.timeLimit * 1000))
    : 0;

  function enterFullscreen() {
    rootRef.current?.requestFullscreen?.();
  }

  if (!state) {
    return (
      <div className="display-fullscreen" ref={rootRef}>
        <p className="dim">接続中...</p>
      </div>
    );
  }

  return (
    <div className="display-fullscreen" ref={rootRef}>
      <button
        className="btn btn-secondary"
        style={{ position: "fixed", top: 16, right: 16 }}
        onClick={enterFullscreen}
      >
        フルスクリーン
      </button>

      {state.status === "lobby" && (
        <>
          <div className="title" style={{ fontSize: "2.5rem" }}>
            {state.quiz.title}
          </div>
          <p className="dim" style={{ fontSize: "1.3rem" }}>
            スマホでQRコードを読み取って参加してください
          </p>
          {joinUrls[0] && (
            <div className="qr-box" style={{ margin: "24px 0" }}>
              <QRCodeSVG value={joinUrls[0]} size={220} />
            </div>
          )}
          {joinUrls.map((u) => (
            <p key={u} style={{ fontSize: "1.1rem" }}>
              {u}
            </p>
          ))}
          <p style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: 24 }}>
            参加者: {state.playerCount}人
          </p>
        </>
      )}

      {state.status === "question" && state.question && (
        <div style={{ width: "100%", maxWidth: 900 }}>
          <div className="badge">
            問題 {state.questionIndex + 1} / {state.quiz.totalQuestions}
          </div>
          <div className="timer-bar-track">
            <div className="timer-bar-fill" style={{ width: `${remainingRatio * 100}%` }} />
          </div>
          <h1 style={{ fontSize: "2.2rem", margin: "16px 0" }}>{state.question.text}</h1>
          <div className="choice-grid">
            {state.question.choices.map((c, i) => (
              <div key={i} className={`choice-btn choice-${i}`} style={{ fontSize: "1.4rem" }}>
                {CHOICE_LABELS[i]}: {c}
              </div>
            ))}
          </div>
          <p className="dim" style={{ marginTop: 16, fontSize: "1.2rem" }}>
            回答済み: {state.answeredCount} / {state.playerCount}
          </p>
        </div>
      )}

      {state.status === "reveal" && state.question && (
        <div style={{ width: "100%", maxWidth: 700 }}>
          <h1 style={{ fontSize: "2.2rem", margin: "16px 0" }}>{state.question.text}</h1>
          {state.choiceCounts && (
            <ResultBars
              choices={state.question.choices}
              correctIndex={state.question.correctIndex}
              choiceCounts={state.choiceCounts}
            />
          )}
          {state.question.explanation && (
            <div className="explanation-box">{state.question.explanation}</div>
          )}
        </div>
      )}

      {(state.status === "leaderboard" || state.status === "ended") && state.leaderboard && (
        <div style={{ width: "100%", maxWidth: 640 }}>
          <div className="title" style={{ fontSize: "2rem", textAlign: "center" }}>
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
