import { useEffect, useState } from "react";
import { socket } from "../socket.js";
import { useCountdown } from "../useCountdown.js";
import ResultBars from "../ResultBars.jsx";

function getOrCreateToken() {
  let token = localStorage.getItem("quiz_player_token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("quiz_player_token", token);
  }
  return token;
}

const CHOICE_LABELS = ["A", "B", "C", "D"];

export default function Play() {
  const [name, setName] = useState(() => localStorage.getItem("quiz_player_name") || "");
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState(null);
  const token = getOrCreateToken();

  useEffect(() => {
    const onState = (s) => setState(s);
    socket.on("state", onState);

    // 前回の名前が保存されていれば自動で再参加を試みる(リロード/再接続対策)
    const savedName = localStorage.getItem("quiz_player_name");
    if (savedName) {
      socket.emit("player:join", { token, name: savedName });
      setJoined(true);
    }

    return () => socket.off("state", onState);
  }, [token]);

  const remainingMs = useCountdown(state?.status === "question" ? state.endsAt : null);
  const remainingRatio = state?.question
    ? Math.min(1, remainingMs / (state.question.timeLimit * 1000))
    : 0;

  function handleJoin(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem("quiz_player_name", trimmed);
    socket.emit("player:join", { token, name: trimmed });
    setJoined(true);
  }

  function handleAnswer(choiceIndex) {
    socket.emit("player:answer", { token, choiceIndex });
  }

  if (!joined) {
    return (
      <div className="page" style={{ justifyContent: "center" }}>
        <form className="card" onSubmit={handleJoin}>
          <div className="title">クイズに参加</div>
          <p className="dim">名前を入力して参加してください</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="なまえ"
            maxLength={20}
            autoFocus
          />
          <div className="btn-row">
            <button className="btn" type="submit" style={{ flex: 1 }}>
              参加する
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="page" style={{ justifyContent: "center" }}>
        <p className="dim">接続中...</p>
      </div>
    );
  }

  if (state.status === "lobby") {
    return (
      <div className="page" style={{ justifyContent: "center" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="title">参加しました！</div>
          <p className="dim">{state.me?.name} さん、出題者が開始するまでお待ちください</p>
        </div>
      </div>
    );
  }

  if (state.status === "question" && state.question) {
    const answered = state.me?.answered;
    return (
      <div className="page" style={{ justifyContent: "center" }}>
        <div className="card">
          <div className="badge">
            問題 {state.questionIndex + 1} / {state.quiz.totalQuestions}
          </div>
          <div className="timer-bar-track">
            <div className="timer-bar-fill" style={{ width: `${remainingRatio * 100}%` }} />
          </div>
          {answered ? (
            <p style={{ textAlign: "center", fontWeight: 700, fontSize: "1.2rem" }}>
              回答しました！結果を待ってください...
            </p>
          ) : (
            <div className="choice-grid">
              {state.question.choices.map((choice, i) => (
                <button
                  key={i}
                  className={`choice-btn choice-${i}`}
                  onClick={() => handleAnswer(i)}
                >
                  {CHOICE_LABELS[i]}: {choice}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state.status === "reveal") {
    const me = state.me;
    return (
      <div className="page" style={{ justifyContent: "center" }}>
        <div className="card" style={{ textAlign: "center" }}>
          {me?.lastChoiceIndex == null ? (
            <div className="title">時間切れ...</div>
          ) : me.lastCorrect ? (
            <>
              <div className="title" style={{ color: "var(--good)" }}>
                正解！ 🎉
              </div>
              <p className="dim">+{me.lastGained} 点</p>
            </>
          ) : (
            <div className="title" style={{ color: "var(--bad)" }}>
              不正解...
            </div>
          )}
          <p className="dim">合計スコア: {me?.score ?? 0}</p>
          {state.choiceCounts && (
            <ResultBars
              choices={state.question.choices}
              correctIndex={state.question.correctIndex}
              choiceCounts={state.choiceCounts}
              myChoiceIndex={me?.lastChoiceIndex}
            />
          )}
          {state.question.explanation && (
            <div className="explanation-box">{state.question.explanation}</div>
          )}
        </div>
      </div>
    );
  }

  if (state.status === "leaderboard") {
    return (
      <div className="page" style={{ justifyContent: "center" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="title">現在の順位</div>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "var(--accent)" }}>
            {state.rank ? `${state.rank}位` : "-"}
          </p>
          <p className="dim">合計スコア: {state.me?.score ?? 0}</p>
          <p className="dim">次の問題をお待ちください...</p>
        </div>
      </div>
    );
  }

  if (state.status === "ended") {
    return (
      <div className="page" style={{ justifyContent: "center" }}>
        <div className="card" style={{ textAlign: "center" }}>
          <div className="title">クイズ終了！</div>
          <p style={{ fontSize: "2rem", fontWeight: 800, color: "var(--accent)" }}>
            {state.rank ? `${state.rank}位` : "-"}
          </p>
          <p className="dim">最終スコア: {state.me?.score ?? 0}</p>
        </div>
      </div>
    );
  }

  return null;
}
