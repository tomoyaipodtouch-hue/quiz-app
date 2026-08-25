import { useEffect, useRef, useState } from "react";
import { socket } from "../socket.js";
import { useJoinUrl } from "../useJoinUrl.js";
import HistoryList from "../HistoryList.jsx";
import ThemeToggle, { SunIcon, MoonIcon } from "../ThemeToggle.jsx";
import QuizSettings from "../QuizSettings.jsx";
import { CrownIcon, rankColor } from "../RankBadge.jsx";
import { qaQuestionsToCSV, downloadCSV } from "../csv.js";

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
  const [showQuestions, setShowQuestions] = useState(true);
  const [questionToast, setQuestionToast] = useState(null);
  const [quizDraft, setQuizDraft] = useState(null);
  const joinUrls = useJoinUrl();
  const prevQuestionIds = useRef(null);

  useEffect(() => {
    socket.emit("control:hello");
    const onState = (s) => setState(s);
    socket.on("state", onState);
    return () => socket.off("state", onState);
  }, []);

  // 新しい質問が届いたら一時的にトーストで通知する。
  // state.questions は state 更新のたびに新しい配列になるため、この effect 自体は
  // 無関係な状態変化(回答受信など)でも毎回走る。新着検出のみここで行う
  useEffect(() => {
    if (!state?.questions) return;
    const ids = new Set(state.questions.map((q) => q.id));
    if (prevQuestionIds.current) {
      const newest = state.questions.find((q) => !prevQuestionIds.current.has(q.id));
      if (newest) setQuestionToast(newest);
    }
    prevQuestionIds.current = ids;
  }, [state?.questions]);

  // トーストの自動消去はここで独立して管理する。questionToast が変わったときだけ
  // タイマーを張り直すので、上のeffectが無関係な理由で再実行されても消去タイマーが
  // 巻き戻ってトーストが消えなくなる、という不具合を避けられる
  useEffect(() => {
    if (!questionToast) return;
    const timer = setTimeout(() => setQuestionToast(null), 5000);
    return () => clearTimeout(timer);
  }, [questionToast]);

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

  function confirmClearQuestions() {
    if (confirm("届いた質問を全て削除します。よろしいですか？")) {
      socket.emit("host:clearQuestions");
    }
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
      {questionToast && (
        <div className="question-toast" style={{ left: 16, right: 16, bottom: "auto", top: 16, margin: "0 auto", maxWidth: 480 }}>
          💬 {questionToast.name}さんから質問: {questionToast.text}
        </div>
      )}
      <div className="control-toolbar">
        <button className="btn-chip" onClick={openDisplayWindow}>
          ⧉ 表示画面を開く
        </button>
        <button className="btn-chip" onClick={openSettings}>
          ⚙ クイズ設定
        </button>
        <button
          className={`btn-chip ${showQuestions ? "active" : ""}`}
          onClick={() => setShowQuestions((v) => !v)}
        >
          💬 質問 ({state.questions?.length ?? 0})
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
        <div className="control-toolbar-spacer" />
        <ThemeToggle />
      </div>
      <div className="control-grid">
        <div className="card" style={{ maxWidth: "none", padding: "18px 20px" }}>
          <div className="badge">{STATUS_LABEL[state.status]}</div>
          <div className="title title-sm">{state.quiz.title}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              className={`btn-chip ${state.joinCodeEnabled ? "active" : ""}`}
              style={{ fontSize: "0.8rem", padding: "8px 14px" }}
              onClick={() => socket.emit("host:setJoinCodeEnabled", { enabled: !state.joinCodeEnabled })}
            >
              🔒 参加にセッションIDを必須にする: {state.joinCodeEnabled ? "オン" : "オフ"}
            </button>
            {state.joinCodeEnabled && (
              <>
                <span className="mono" style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "0.15em" }}>
                  {state.joinCode}
                </span>
                <button
                  className="btn-chip"
                  style={{ fontSize: "0.8rem", padding: "8px 14px" }}
                  onClick={() => socket.emit("host:regenerateJoinCode")}
                >
                  再発行
                </button>
              </>
            )}
          </div>

          {state.status === "lobby" && (
            <>
              <p className="dim" style={{ fontSize: "0.85rem" }}>
                参加者がスマホで参加するのを待っています
              </p>
              <div className="btn-row">
                <button
                  className="btn"
                  style={{ padding: "10px 16px", fontSize: "0.95rem" }}
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
              <ol style={{ listStyle: "none", paddingLeft: 0 }}>
                {state.leaderboard.slice(0, 5).map((p) => (
                  <li key={p.token} style={{ color: rankColor(p.rank) }}>
                    <CrownIcon rank={p.rank} size={16} /> {p.rank}位
                    {p.tieCount > 1 ? `(${p.tieCount}人)` : ""}{" "}
                    <span style={{ color: "var(--text)" }}>
                      — {p.name} — {p.score}点
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}

          <div className="btn-row">
            <button className="btn btn-danger" style={{ padding: "10px 16px", fontSize: "0.95rem" }} onClick={confirmReset}>
              リセット
            </button>
          </div>

          {state.status === "lobby" && joinUrls.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <p className="dim" style={{ fontSize: "0.8rem" }}>
                参加用URL(同じWi-Fi内のスマホから):
              </p>
              {joinUrls.map((u) => (
                <p key={u} style={{ fontWeight: 700, fontSize: "0.85rem" }}>
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

      {showQuestions && (
        <div className="card" style={{ width: "100%", maxWidth: 1100, margin: "20px auto 0", padding: "28px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div className="title" style={{ fontSize: "1.4rem", margin: 0 }}>
              質問一覧 ({state.questions?.length ?? 0})
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn-chip"
                onClick={() =>
                  socket.emit("host:setAnonymizeQuestionsOnDisplay", {
                    anonymize: !state.anonymizeQuestionsOnDisplay,
                  })
                }
              >
                投影時: {state.anonymizeQuestionsOnDisplay ? "匿名表示" : "名前表示"}
              </button>
              {state.featuredQuestionId && (
                <button className="btn-chip" onClick={() => socket.emit("host:setFeaturedQuestion", { id: null })}>
                  表示画面から消す
                </button>
              )}
              {state.questions?.length > 0 && (
                <button
                  className="btn-chip"
                  onClick={() =>
                    downloadCSV(`questions_${Date.now()}.csv`, qaQuestionsToCSV(state.questions))
                  }
                >
                  CSVで出力
                </button>
              )}
              {state.questions?.length > 0 && (
                <button className="btn-chip btn-chip-danger" onClick={confirmClearQuestions}>
                  質問をクリア
                </button>
              )}
            </div>
          </div>
          <p className="dim" style={{ fontSize: "0.9rem", marginTop: 8 }}>
            質問を選ぶと表示画面の中央に映せます
          </p>
          <ul style={{ listStyle: "none", padding: 0, marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            {(state.questions ?? []).map((q) => {
              const isFeatured = state.featuredQuestionId === q.id;
              return (
                <li
                  key={q.id}
                  style={{
                    background: "var(--bg-soft)",
                    border: `1px solid ${isFeatured ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: "var(--radius)",
                    padding: "18px 20px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>{q.name}</span>
                      {q.shown && (
                        <span
                          className="mono"
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: "var(--good)",
                            border: "1px solid var(--good)",
                            borderRadius: "999px",
                            padding: "2px 8px",
                          }}
                        >
                          表示済み
                        </span>
                      )}
                    </span>
                    <span className="dim mono" style={{ fontSize: "0.85rem" }}>
                      {new Date(q.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p style={{ margin: "10px 0 14px", fontSize: "1.3rem", fontWeight: 600, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {q.text}
                  </p>
                  <button
                    className={`btn ${isFeatured ? "" : "btn-secondary"}`}
                    style={{ width: "100%" }}
                    onClick={() =>
                      socket.emit("host:setFeaturedQuestion", { id: isFeatured ? null : q.id })
                    }
                  >
                    {isFeatured ? "✓ 表示画面に表示中" : "表示画面に映す"}
                  </button>
                </li>
              );
            })}
            {(state.questions?.length ?? 0) === 0 && <li className="dim">まだ質問はありません</li>}
          </ul>
        </div>
      )}

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
