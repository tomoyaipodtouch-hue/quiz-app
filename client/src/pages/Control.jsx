import { useEffect, useState } from "react";
import { socket } from "../socket.js";
import { useJoinUrl } from "../useJoinUrl.js";
import HistoryList from "../HistoryList.jsx";
import ThemeToggle, { SunIcon, MoonIcon } from "../ThemeToggle.jsx";
import QuizSettings from "../QuizSettings.jsx";

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
  const [quizDraft, setQuizDraft] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const joinUrls = useJoinUrl();

  useEffect(() => {
    const onState = (s) => setState(s);
    socket.on("state", onState);

    function auth(pin) {
      socket.emit("control:hello", pin, (res) => {
        if (res?.ok) {
          setAuthed(true);
          setAuthError(false);
          if (pin) localStorage.setItem("quiz_control_pin", pin);
        } else {
          setAuthed(false);
          setAuthError(true);
          localStorage.removeItem("quiz_control_pin");
        }
      });
    }

    // 再接続のたびに(保存済みPIN、または制限オフなら空文字で)入り直す
    function onConnect() {
      auth(localStorage.getItem("quiz_control_pin") || "");
    }
    socket.on("connect", onConnect);
    if (socket.connected) onConnect();

    return () => {
      socket.off("state", onState);
      socket.off("connect", onConnect);
    };
  }, []);

  function handlePinSubmit(e) {
    e.preventDefault();
    socket.emit("control:hello", pinInput, (res) => {
      if (res?.ok) {
        setAuthed(true);
        setAuthError(false);
        localStorage.setItem("quiz_control_pin", pinInput);
      } else {
        setAuthError(true);
      }
    });
  }

  if (!authed) {
    return (
      <div className="page" style={{ justifyContent: "center" }}>
        <form className="card" onSubmit={handlePinSubmit}>
          <div className="title">操作画面PIN</div>
          <p className="dim">
            アクセス制限が有効です。PC側の操作画面に表示されている6桁のPINを入力してください。
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            autoFocus
          />
          {authError && (
            <p style={{ color: "var(--bad)", fontSize: "0.85rem", marginTop: 8 }}>
              PINが違います
            </p>
          )}
          <div className="btn-row">
            <button className="btn" type="submit" style={{ flex: 1 }} disabled={pinInput.length !== 6}>
              入る
            </button>
          </div>
        </form>
      </div>
    );
  }

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

  function openSettings() {
    socket.emit("host:getQuiz", (res) => {
      if (res.ok) setQuizDraft(res.quiz);
    });
  }

  function openDisplayWindow() {
    window.open("/display", "quiz-display", "width=1280,height=800,noopener");
  }

  function handleSaveQuiz(newQuiz, callback) {
    socket.emit("host:setQuiz", newQuiz, (res) => {
      callback(res);
      if (res.ok) setQuizDraft(null);
    });
  }

  if (quizDraft) {
    return (
      <div className="page" style={{ alignItems: "stretch" }}>
        <ThemeToggle style={{ position: "fixed", top: 16, right: 16 }} />
        <div style={{ width: "100%", maxWidth: 800, margin: "0 auto" }}>
          <QuizSettings initialQuiz={quizDraft} onSave={handleSaveQuiz} onCancel={() => setQuizDraft(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ alignItems: "stretch" }}>
      <div className="control-toolbar">
        <button className="btn-chip" onClick={openDisplayWindow}>
          ⧉ 表示画面を開く
        </button>
        <button className="btn-chip" onClick={openSettings}>
          ⚙ クイズ設定
        </button>
        <button
          className="btn-chip"
          type="button"
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          title="投影している表示画面のテーマを切り替え"
          onClick={() =>
            socket.emit("host:setDisplayTheme", { theme: state.displayTheme === "dark" ? "light" : "dark" })
          }
        >
          {state.displayTheme === "dark" ? <SunIcon /> : <MoonIcon />} 投影画面
        </button>
        <ThemeToggle />
      </div>
      <div className="control-grid">
        <div className="card" style={{ maxWidth: "none" }}>
          <div className="badge">{STATUS_LABEL[state.status]}</div>
          <div className="title">{state.quiz.title}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button
              className={`btn-chip ${state.controlPinEnabled ? "active" : ""}`}
              onClick={() =>
                socket.emit("host:setControlPinEnabled", { enabled: !state.controlPinEnabled })
              }
            >
              🔒 操作画面のアクセス制限: {state.controlPinEnabled ? "オン" : "オフ"}
            </button>
            {state.controlPinEnabled && (
              <>
                <span style={{ fontWeight: 800, fontSize: "1.15rem", letterSpacing: "0.15em" }}>
                  {state.controlPin}
                </span>
                <button
                  className="btn-chip"
                  onClick={() => socket.emit("host:regenerateControlPin")}
                >
                  PINを再発行
                </button>
              </>
            )}
          </div>

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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div className="title" style={{ fontSize: "1.1rem", margin: 0 }}>
              参加者 ({state.players.length})
            </div>
            <button
              className={`btn-chip ${state.showParticipantsOnDisplay ? "active" : ""}`}
              onClick={() =>
                socket.emit("host:showParticipantsOnDisplay", { show: !state.showParticipantsOnDisplay })
              }
            >
              表示画面に{state.showParticipantsOnDisplay ? "表示中" : "非表示"}
            </button>
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
