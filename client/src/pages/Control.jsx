import { useEffect, useState } from "react";
import { socket } from "../socket.js";
import { useJoinUrl } from "../useJoinUrl.js";
import HistoryList from "../HistoryList.jsx";

const STATUS_LABEL = {
  lobby: "待機中",
  question: "出題中",
  reveal: "正解発表",
  leaderboard: "ランキング表示中",
  ended: "終了",
};

export default function Control() {
  const [state, setState] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const joinUrls = useJoinUrl();

  useEffect(() => {
    socket.emit("control:hello");
    const onState = (s) => setState(s);
    socket.on("state", onState);
    return () => socket.off("state", onState);
  }, []);

  if (!state) {
    return (
      <div className="page">
        <p className="dim">接続中...</p>
      </div>
    );
  }

  const answeredCount = state.players.filter((p) => p.answered).length;

  function confirmReset() {
    if (confirm("クイズをリセットします。参加者・スコアも全てクリアされます。よろしいですか？")) {
      socket.emit("host:reset");
    }
  }

  return (
    <div className="page" style={{ alignItems: "stretch" }}>
      <div className="control-grid">
        <div className="card" style={{ maxWidth: "none" }}>
          <div className="badge">{STATUS_LABEL[state.status]}</div>
          <div className="title">{state.quiz.title}</div>

          {state.status === "lobby" && (
            <>
              <p className="dim">参加者がスマホで参加するのを待っています</p>
              <div className="btn-row">
                <button
                  className="btn"
                  disabled={state.players.length === 0}
                  onClick={() => socket.emit("host:start")}
                >
                  クイズ開始 ({state.players.length}人参加中)
                </button>
              </div>
            </>
          )}

          {state.status === "question" && state.question && (
            <>
              <p className="dim">
                問題 {state.questionIndex + 1} / {state.quiz.totalQuestions}
              </p>
              <p style={{ fontSize: "1.2rem", fontWeight: 700 }}>{state.question.text}</p>
              <ul style={{ paddingLeft: 20 }}>
                {state.question.choices.map((c, i) => (
                  <li
                    key={i}
                    style={{
                      fontWeight: i === state.question.correctIndex ? 800 : 400,
                      color: i === state.question.correctIndex ? "var(--good)" : "inherit",
                    }}
                  >
                    {c} {i === state.question.correctIndex ? "(正解)" : ""}
                  </li>
                ))}
              </ul>
              <p className="dim">
                回答済み: {answeredCount} / {state.players.length}
              </p>
              <div className="btn-row">
                <button className="btn" onClick={() => socket.emit("host:reveal")}>
                  正解を発表する
                </button>
              </div>
            </>
          )}

          {state.status === "reveal" && state.question && (
            <>
              <p style={{ fontSize: "1.2rem", fontWeight: 700 }}>{state.question.text}</p>
              <p>
                正解: <b style={{ color: "var(--good)" }}>{state.question.choices[state.question.correctIndex]}</b>
              </p>
              <div className="btn-row">
                <button className="btn" onClick={() => socket.emit("host:leaderboard")}>
                  ランキングを見せる
                </button>
                <button className="btn btn-secondary" onClick={() => socket.emit("host:next")}>
                  次の問題へ
                </button>
              </div>
            </>
          )}

          {state.status === "leaderboard" && (
            <>
              <p className="dim">ランキングを表示画面に表示中</p>
              <div className="btn-row">
                <button className="btn" onClick={() => socket.emit("host:next")}>
                  次の問題へ
                </button>
              </div>
            </>
          )}

          {state.status === "ended" && (
            <>
              <p className="dim">クイズが終了しました</p>
              <ol>
                {state.leaderboard.slice(0, 5).map((p) => (
                  <li key={p.token}>
                    {p.name} — {p.score}点
                  </li>
                ))}
              </ol>
            </>
          )}

          <div className="btn-row">
            <button className="btn btn-danger" onClick={confirmReset}>
              リセット
            </button>
          </div>

          {state.status === "lobby" && joinUrls.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p className="dim">参加用URL(同じWi-Fi内のスマホから):</p>
              {joinUrls.map((u) => (
                <p key={u} style={{ fontWeight: 700 }}>
                  {u}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="title" style={{ fontSize: "1.1rem" }}>
            参加者 ({state.players.length})
          </div>
          <ul className="player-list">
            {state.players.map((p) => (
              <li className="player-row" key={p.token}>
                <span>
                  <span className={`dot ${p.connected ? "online" : "offline"}`} />
                  {p.name}
                </span>
                <span className="dim">
                  {state.status === "question" ? (p.answered ? "回答済み" : "未回答") : `${p.score}点`}
                </span>
              </li>
            ))}
            {state.players.length === 0 && <li className="dim">まだ誰も参加していません</li>}
          </ul>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 1100, margin: "20px auto 0" }}>
        <button className="btn-chip" onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? "過去の問題を隠す" : `過去の問題を見る (${state.history.length})`}
        </button>
        {showHistory && (
          <div style={{ marginTop: 16 }}>
            <HistoryList history={state.history} totalQuestions={state.quiz.totalQuestions} />
          </div>
        )}
      </div>
    </div>
  );
}
