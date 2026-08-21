import { useEffect, useState } from "react";
import { socket } from "../socket.js";
import ResultBars from "../ResultBars.jsx";
import HistoryList from "../HistoryList.jsx";

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
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState(null);
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

  // 問題が切り替わったら選択状態をリセットする
  useEffect(() => {
    setSelectedChoice(null);
  }, [state?.questionIndex]);

  function handleJoin(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem("quiz_player_name", trimmed);
    socket.emit("player:join", { token, name: trimmed });
    setJoined(true);
  }

  function handleSubmitAnswer() {
    if (selectedChoice == null) return;
    socket.emit("player:answer", { token, choiceIndex: selectedChoice });
  }

  function startRename() {
    setRenameValue(state?.me?.name ?? name);
    setRenaming(true);
  }

  function handleRenameSubmit(e) {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    localStorage.setItem("quiz_player_name", trimmed);
    socket.emit("player:join", { token, name: trimmed });
    setRenaming(false);
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

  return (
    <div className="page" style={{ justifyContent: "flex-start" }}>
      <div className="player-topbar">
        <span className="player-topbar-name">{state.me?.name ?? name}</span>
        <div className="player-topbar-actions">
          <button className="btn-chip" onClick={startRename}>
            名前を変更
          </button>
          <button
            className={`btn-chip ${showHistory ? "active" : ""}`}
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "クイズに戻る" : "過去の問題"}
          </button>
        </div>
      </div>

      {renaming && (
        <form className="rename-form" onSubmit={handleRenameSubmit}>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={20}
            autoFocus
          />
          <button className="btn" type="submit">
            保存
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setRenaming(false)}>
            キャンセル
          </button>
        </form>
      )}

      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
        {showHistory ? (
          <div style={{ width: "100%", maxWidth: 480 }}>
            <HistoryList history={state.history} totalQuestions={state.quiz.totalQuestions} />
          </div>
        ) : (
          <MainContent
            state={state}
            selectedChoice={selectedChoice}
            setSelectedChoice={setSelectedChoice}
            handleSubmitAnswer={handleSubmitAnswer}
          />
        )}
      </div>
    </div>
  );
}

function MainContent({ state, selectedChoice, setSelectedChoice, handleSubmitAnswer }) {
  if (state.status === "lobby") {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <div className="title">参加しました！</div>
        <p className="dim">{state.me?.name} さん、出題者が開始するまでお待ちください</p>
      </div>
    );
  }

  if (state.status === "question" && state.question) {
    const answered = state.me?.answered;
    return (
      <div className="card">
        <div className="badge">
          問題 {state.questionIndex + 1} / {state.quiz.totalQuestions}
        </div>
        {answered ? (
          <p style={{ textAlign: "center", fontWeight: 700, fontSize: "1.2rem" }}>
            回答しました！出題者の発表をお待ちください...
          </p>
        ) : (
          <>
            <div className="choice-grid">
              {state.question.choices.map((choice, i) => (
                <button
                  key={i}
                  className={`choice-btn ${selectedChoice === i ? "selected" : ""}`}
                  onClick={() => setSelectedChoice(i)}
                >
                  {CHOICE_LABELS[i]}: {choice}
                </button>
              ))}
            </div>
            <div className="btn-row">
              <button
                className="btn"
                style={{ flex: 1 }}
                disabled={selectedChoice == null}
                onClick={handleSubmitAnswer}
              >
                送信する
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (state.status === "reveal") {
    const me = state.me;
    return (
      <div className="card" style={{ textAlign: "center" }}>
        {me?.lastChoiceIndex == null ? (
          <div className="title">未回答でした</div>
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
        {state.question.explanation && <div className="explanation-box">{state.question.explanation}</div>}
      </div>
    );
  }

  if (state.status === "leaderboard") {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <div className="title">現在の順位</div>
        <p style={{ fontSize: "2rem", fontWeight: 800, color: "var(--accent)" }}>
          {state.rank ? `${state.rank}位` : "-"}
        </p>
        <p className="dim">合計スコア: {state.me?.score ?? 0}</p>
        <p className="dim">次の問題をお待ちください...</p>
      </div>
    );
  }

  if (state.status === "ended") {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <div className="title">クイズ終了！</div>
        <p style={{ fontSize: "2rem", fontWeight: 800, color: "var(--accent)" }}>
          {state.rank ? `${state.rank}位` : "-"}
        </p>
        <p className="dim">最終スコア: {state.me?.score ?? 0}</p>
      </div>
    );
  }

  return null;
}
