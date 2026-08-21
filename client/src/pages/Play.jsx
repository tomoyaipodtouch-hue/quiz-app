import { useEffect, useRef, useState } from "react";
import { socket } from "../socket.js";
import ResultBars from "../ResultBars.jsx";
import HistoryList from "../HistoryList.jsx";
import TopBar from "../TopBar.jsx";

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
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [quizTitle, setQuizTitle] = useState("クイズ");
  const token = getOrCreateToken();
  const joinedRef = useRef(joined);
  joinedRef.current = joined;

  useEffect(() => {
    function onState(s) {
      // 出題者がリセットすると自分の登録がサーバー側から消える。
      // その場合は保存していた名前を破棄して、参加登録からやり直させる
      if (joinedRef.current && s.me == null) {
        localStorage.removeItem("quiz_player_name");
        setJoined(false);
        setName("");
        setRenaming(false);
      }
      setState(s);
    }
    socket.on("state", onState);

    // 今の世代IDを問い合わせて、保存されている名前が今のゲームのものであれば
    // 自動で再参加する(リロード/再接続対策)。世代が古ければ(＝リセット後)
    // 参加登録の画面からやり直させる
    function onEpoch({ gameEpoch, quizTitle: title }) {
      if (title) setQuizTitle(title);
      const savedEpoch = localStorage.getItem("quiz_game_epoch");
      const savedName = localStorage.getItem("quiz_player_name");
      if (savedName && savedEpoch === gameEpoch) {
        socket.emit("player:join", { token, name: savedName });
        setJoined(true);
      } else {
        localStorage.removeItem("quiz_player_name");
        localStorage.setItem("quiz_game_epoch", gameEpoch);
        setName("");
      }
    }
    socket.on("epoch", onEpoch);
    socket.emit("player:hello");

    return () => {
      socket.off("state", onState);
      socket.off("epoch", onEpoch);
    };
  }, [token]);

  // 問題が切り替わったら選択状態をリセットする
  useEffect(() => {
    setSelectedChoice(null);
  }, [state?.questionIndex]);

  // 再接続などで「既に回答済み」の状態から始まる場合、選択状態をそれに合わせる
  useEffect(() => {
    if (state?.status === "question" && state.me?.lastChoiceIndex != null && selectedChoice == null) {
      setSelectedChoice(state.me.lastChoiceIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.me?.lastChoiceIndex, state?.status]);

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
    setJustSubmitted(true);
    setTimeout(() => setJustSubmitted(false), 1600);
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

  const displayTitle = state?.quiz?.title ?? quizTitle;

  if (!joined) {
    return (
      <div className="page" style={{ padding: 0, justifyContent: "flex-start" }}>
        <TopBar title={displayTitle} />
        <div style={{ padding: 24, width: "100%", display: "flex", justifyContent: "center" }}>
          <form className="card" onSubmit={handleJoin}>
            <div className="title title-sm">クイズに参加</div>
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
      </div>
    );
  }

  if (!state) {
    return (
      <div className="page" style={{ padding: 0, justifyContent: "flex-start" }}>
        <TopBar title={displayTitle} />
        <p className="dim" style={{ marginTop: 24 }}>
          接続中...
        </p>
      </div>
    );
  }

  // 今答えている問題(または直前の状態)は一番上、その下に過去の問題を新しい順に並べる。
  // reveal以降は今の問題がhistoryにも積まれるので、重複しないよう除外する
  const pastHistory = state.history.filter((h) => h.questionIndex !== state.questionIndex);

  return (
    <div className="page" style={{ padding: 0, justifyContent: "flex-start" }}>
      <TopBar title={displayTitle} />

      <div style={{ width: "100%", maxWidth: 480, padding: "16px 16px 0" }}>
        <div className="player-topbar" style={{ maxWidth: "none", marginBottom: 0 }}>
          <span className="player-topbar-name">{state.me?.name ?? name}</span>
          <div className="player-topbar-actions">
            <button className="btn-chip" onClick={startRename}>
              名前を変更
            </button>
          </div>
        </div>

        {renaming && (
          <form className="rename-form" onSubmit={handleRenameSubmit} style={{ maxWidth: "none", marginTop: 12 }}>
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
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <MainContent
          state={state}
          selectedChoice={selectedChoice}
          setSelectedChoice={setSelectedChoice}
          handleSubmitAnswer={handleSubmitAnswer}
          justSubmitted={justSubmitted}
        />
        <HistoryList history={pastHistory} totalQuestions={state.quiz.totalQuestions} />
      </div>
    </div>
  );
}

function MainContent({ state, selectedChoice, setSelectedChoice, handleSubmitAnswer, justSubmitted }) {
  if (state.status === "lobby") {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <div className="title title-sm">参加しました！</div>
        <p className="dim">{state.me?.name} さん、出題者が開始するまでお待ちください</p>
      </div>
    );
  }

  if (state.status === "question" && state.question) {
    const answered = state.me?.answered;
    return (
      <div className="card">
        <div className="badge">
          {answered ? "回答を受け付けました" : `問題 ${state.questionIndex + 1} / ${state.quiz.totalQuestions}`}
        </div>
        <p className="question-text">{state.question.text}</p>
        <>
          <div className="choice-grid">
            {state.question.choices.map((choice, i) => (
              <button
                key={i}
                className={`choice-btn ${selectedChoice === i ? "selected" : ""}`}
                onClick={() => setSelectedChoice(i)}
              >
                {CHOICE_LABELS[i]}: {choice}
                {state.me?.lastChoiceIndex === i && (
                  <span className="choice-submitted-tag">選択済み</span>
                )}
              </button>
            ))}
          </div>
          {justSubmitted ? (
            <p className="submit-feedback">✓ 送信しました</p>
          ) : (
            answered && (
              <p className="dim" style={{ textAlign: "center", marginTop: 12, fontSize: "0.85rem" }}>
                発表までは選択を変更できます
              </p>
            )
          )}
          <div className="btn-row">
            <button
              className="btn"
              style={{ flex: 1 }}
              disabled={selectedChoice == null}
              onClick={handleSubmitAnswer}
            >
              {answered ? "回答を変更する" : "送信する"}
            </button>
          </div>
        </>
      </div>
    );
  }

  if (state.status === "reveal") {
    const me = state.me;
    return (
      <div className="card" style={{ textAlign: "center" }}>
        {me?.lastChoiceIndex == null ? (
          <div className="reveal-banner neutral">未回答でした</div>
        ) : me.lastCorrect ? (
          <div className="reveal-banner correct">正解！ 🎉</div>
        ) : (
          <div className="reveal-banner incorrect">不正解...</div>
        )}
        <p className="dim" style={{ marginTop: 12 }}>
          合計スコア: {me?.score ?? 0}
          {me?.lastCorrect ? `（+${me.lastGained}点）` : ""}
        </p>
        {state.choiceCounts && (
          <ResultBars
            choices={state.question.choices}
            correctIndex={state.question.correctIndex}
            choiceCounts={state.choiceCounts}
            myChoiceIndex={me?.lastChoiceIndex}
            compact
          />
        )}
        {state.question.explanation && (
          <div className="explanation-box compact">{state.question.explanation}</div>
        )}
      </div>
    );
  }

  if (state.status === "leaderboard") {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <div className="title title-sm">現在の順位</div>
        <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--accent)" }}>
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
        <div className="title title-sm">クイズ終了！</div>
        <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--accent)" }}>
          {state.rank ? `${state.rank}位` : "-"}
        </p>
        <p className="dim">最終スコア: {state.me?.score ?? 0}</p>
      </div>
    );
  }

  return null;
}
