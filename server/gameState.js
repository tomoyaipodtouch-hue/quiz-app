import { randomUUID } from "node:crypto";
import { quiz as defaultQuiz } from "./quizData.js";

const DEFAULT_POINTS_PER_CORRECT = 1000;

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ゲーム全体の状態をここで一元管理する。
// status: 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended'
const state = {
  status: "lobby",
  quiz: {
    pointsPerCorrect: DEFAULT_POINTS_PER_CORRECT,
    ...structuredClone(defaultQuiz),
  }, // クイズ設定画面から差し替え可能
  currentQuestionIndex: -1,
  players: new Map(), // token -> { token, socketId, name, score, answered, lastCorrect, lastGained }
  history: [], // 出題済みの問題の結果(集計済み)。revealAnswer() のタイミングで積む
  gameEpoch: randomUUID(), // リセットのたびに発行し直す世代ID。古い世代のブラウザは自動再参加させない
  showParticipantsOnDisplay: true, // 表示画面(投影用)に参加者名を出すかどうか。出題者の設定で切り替え
  displayTheme: "dark", // 表示画面(投影用)のテーマ。プロジェクター側を直接操作しないので出題者が遠隔で切り替える
  joinCode: generatePin(), // 参加(/play)時に入力させる6桁のセッションID。サーバー起動時に発行
  joinCodeEnabled: false, // セッションIDでの参加制限を使うかどうか。Control画面からオン/オフ可能
  questions: [], // 説明会などでの質問受付機能。クイズの進行やリセットとは独立して溜まっていく
  showQuestionsOnDisplay: false, // 表示画面(投影用)に質問一覧を出すかどうか
  anonymizeQuestionsOnDisplay: true, // 表示画面に出すとき、質問者名を隠して匿名表示にするかどうか
};

export function getGameEpoch() {
  return state.gameEpoch;
}

export function isKnownPlayer(token) {
  return state.players.has(token);
}

// 制限がオフの間は誰でも参加できる(今まで通り)。オンのときだけコードを照合する。
// 既に参加済みのトークン(名前変更・再接続)はコード不要
export function verifyJoinCode(code) {
  if (!state.joinCodeEnabled) return true;
  return typeof code === "string" && code === state.joinCode;
}

export function regenerateJoinCode() {
  state.joinCode = generatePin();
  notify();
  return state.joinCode;
}

export function setJoinCodeEnabled(enabled) {
  state.joinCodeEnabled = !!enabled;
  notify();
}

export function setShowParticipantsOnDisplay(show) {
  state.showParticipantsOnDisplay = !!show;
  notify();
}

export function setDisplayTheme(theme) {
  state.displayTheme = theme === "light" ? "light" : "dark";
  notify();
}

let onChange = () => {};

export function setOnChange(fn) {
  onChange = fn;
}

function notify() {
  onChange();
}

function currentQuestion() {
  return state.quiz.questions[state.currentQuestionIndex] ?? null;
}

export function getQuiz() {
  return state.quiz;
}

// クイズ設定画面(またはCSVインポート)からの差し替え。進行中のゲームは意味を失うので
// リセットも合わせて行う。
export function setQuiz(newQuiz) {
  if (!newQuiz || typeof newQuiz.title !== "string" || !Array.isArray(newQuiz.questions)) {
    throw new Error("クイズの形式が正しくありません");
  }
  if (newQuiz.questions.length === 0) {
    throw new Error("問題が1つもありません");
  }
  for (const q of newQuiz.questions) {
    if (typeof q.text !== "string" || !q.text.trim()) {
      throw new Error("問題文が空の項目があります");
    }
    if (!Array.isArray(q.choices) || q.choices.length !== 4 || q.choices.some((c) => typeof c !== "string" || !c.trim())) {
      throw new Error("選択肢は4つとも入力してください");
    }
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
      throw new Error("正解の指定が正しくありません");
    }
  }

  const pointsPerCorrect =
    Number.isInteger(newQuiz.pointsPerCorrect) && newQuiz.pointsPerCorrect > 0
      ? newQuiz.pointsPerCorrect
      : DEFAULT_POINTS_PER_CORRECT;

  state.quiz = {
    title: newQuiz.title.trim() || "クイズ",
    pointsPerCorrect,
    questions: newQuiz.questions.map((q) => ({
      text: q.text.trim(),
      choices: q.choices.map((c) => c.trim()),
      correctIndex: q.correctIndex,
      explanation: typeof q.explanation === "string" && q.explanation.trim() ? q.explanation.trim() : null,
    })),
  };
  resetGame();
}

export function joinPlayer(token, name, socketId) {
  let player = state.players.get(token);
  if (player) {
    player.socketId = socketId;
    if (name) player.name = name;
  } else {
    player = {
      token,
      socketId,
      name: name || `プレイヤー${state.players.size + 1}`,
      score: 0,
      answered: false,
      lastCorrect: null,
      lastGained: 0,
      answerHistory: [], // {questionIndex, choiceIndex, correct, gained}
    };
    state.players.set(token, player);
  }
  notify();
  return player;
}

export function removePlayerSocket(socketId) {
  for (const player of state.players.values()) {
    if (player.socketId === socketId) {
      player.socketId = null;
    }
  }
  notify();
}

export function kickPlayer(token) {
  state.players.delete(token);
  notify();
}

// クイズの進行状況とは無関係に、参加者がいつでも投げられる質問。
// 説明会などでの利用を想定し、ゲームのリセットでは消さない(host:clearQuestions で明示的にクリア)
export function submitQuestion(token, text) {
  const player = state.players.get(token);
  if (!player) throw new Error("参加者情報が見つかりません");
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) throw new Error("質問を入力してください");
  if (trimmed.length > 300) throw new Error("質問は300文字以内で入力してください");
  state.questions.unshift({
    id: randomUUID(),
    token,
    name: player.name,
    text: trimmed,
    createdAt: Date.now(),
  });
  notify();
}

export function clearQuestions() {
  state.questions = [];
  notify();
}

export function setShowQuestionsOnDisplay(show) {
  state.showQuestionsOnDisplay = !!show;
  notify();
}

export function setAnonymizeQuestionsOnDisplay(anonymize) {
  state.anonymizeQuestionsOnDisplay = !!anonymize;
  notify();
}

// 回答は送信されるだけで、この時点では結果を確定・通知しない。
// 出題者が host:reveal を押すまで、正解かどうかは誰にも見せないし、
// 発表前であれば同じ問題内で何度でも回答を変更できる。
export function submitAnswer(token, choiceIndex) {
  if (state.status !== "question") return;
  const player = state.players.get(token);
  if (!player) return;
  const q = currentQuestion();
  if (!q) return;

  const correct = choiceIndex === q.correctIndex;
  const gained = correct ? state.quiz.pointsPerCorrect : 0;

  // 既に回答済みの場合、前回分の得点を差し引いてから今回の分を加える
  player.score += gained - (player.lastGained ?? 0);
  player.answered = true;
  player.lastCorrect = correct;
  player.lastGained = gained;
  player.lastChoiceIndex = choiceIndex;

  notify();
}

export function startQuiz() {
  for (const player of state.players.values()) {
    player.score = 0;
    player.answered = false;
    player.lastCorrect = null;
    player.lastGained = 0;
    player.answerHistory = [];
  }
  state.history = [];
  state.currentQuestionIndex = -1;
  nextQuestion();
}

export function nextQuestion() {
  const nextIndex = state.currentQuestionIndex + 1;
  if (nextIndex >= state.quiz.questions.length) {
    state.status = "ended";
    state.currentQuestionIndex = state.quiz.questions.length - 1;
    notify();
    return;
  }

  state.currentQuestionIndex = nextIndex;
  state.status = "question";

  for (const player of state.players.values()) {
    player.answered = false;
    player.lastCorrect = null;
    player.lastGained = 0;
    player.lastChoiceIndex = null;
  }

  notify();
}

function archiveCurrentQuestion() {
  const q = currentQuestion();
  if (!q) return;
  const choiceCounts = getChoiceCounts(q);
  state.history.push({
    questionIndex: state.currentQuestionIndex,
    text: q.text,
    choices: q.choices,
    correctIndex: q.correctIndex,
    explanation: q.explanation ?? null,
    choiceCounts,
    answeredCount: playersArray().filter((p) => p.answered).length,
    playerCount: playersArray().length,
  });
  for (const player of state.players.values()) {
    player.answerHistory.push({
      questionIndex: state.currentQuestionIndex,
      choiceIndex: player.lastChoiceIndex ?? null,
      correct: player.lastCorrect ?? false,
      gained: player.lastGained ?? 0,
    });
  }
}

// 出題者が「正解を発表する」を押したときだけ呼ばれる。これが結果を全員に見せる唯一の経路。
export function revealAnswer() {
  if (state.status !== "question") return;
  archiveCurrentQuestion();
  state.status = "reveal";
  notify();
}

export function showLeaderboard() {
  if (state.status !== "reveal") return;
  state.status = "leaderboard";
  notify();
}

export function resetGame() {
  state.status = "lobby";
  state.currentQuestionIndex = -1;
  state.players.clear();
  state.history = [];
  state.gameEpoch = randomUUID();
  notify();
}

function playersArray() {
  return [...state.players.values()];
}

// 同点は同じ順位にする(標準的な競技順位: 1,1,3,4...)。tieCountはその順位の人数
function sortedLeaderboard() {
  const sorted = playersArray()
    .slice()
    .sort((a, b) => b.score - a.score)
    .map(({ token, name, score, lastCorrect, lastGained }) => ({
      token,
      name,
      score,
      lastCorrect,
      lastGained,
    }));

  let rank = 0;
  let prevScore = null;
  const withRank = sorted.map((p, i) => {
    if (p.score !== prevScore) {
      rank = i + 1;
      prevScore = p.score;
    }
    return { ...p, rank };
  });

  const countByRank = {};
  for (const p of withRank) countByRank[p.rank] = (countByRank[p.rank] ?? 0) + 1;
  return withRank.map((p) => ({ ...p, tieCount: countByRank[p.rank] }));
}

export function getQuizMeta() {
  return { title: state.quiz.title, totalQuestions: state.quiz.questions.length };
}

// 出題者(操作画面)向け：正解や全員の回答状況を含む完全な状態
export function getHostView() {
  const q = currentQuestion();
  return {
    role: "host",
    status: state.status,
    quiz: getQuizMeta(),
    questionIndex: state.currentQuestionIndex,
    question: q
      ? {
          text: q.text,
          choices: q.choices,
          correctIndex: q.correctIndex,
          explanation: q.explanation ?? null,
        }
      : null,
    players: playersArray().map((p) => ({
      token: p.token,
      name: p.name,
      score: p.score,
      connected: !!p.socketId,
      answered: p.answered,
      lastCorrect: p.lastCorrect,
    })),
    leaderboard: sortedLeaderboard(),
    history: state.history,
    showParticipantsOnDisplay: state.showParticipantsOnDisplay,
    displayTheme: state.displayTheme,
    joinCode: state.joinCode,
    joinCodeEnabled: state.joinCodeEnabled,
    questions: state.questions,
    showQuestionsOnDisplay: state.showQuestionsOnDisplay,
    anonymizeQuestionsOnDisplay: state.anonymizeQuestionsOnDisplay,
  };
}

function isRevealing() {
  return state.status === "reveal" || state.status === "leaderboard" || state.status === "ended";
}

function getChoiceCounts(q) {
  const counts = new Array(q.choices.length).fill(0);
  for (const p of playersArray()) {
    if (p.lastChoiceIndex != null) counts[p.lastChoiceIndex] += 1;
  }
  return counts;
}

// 表示画面(投影用)向け：正解は reveal 以降のみ含める
export function getDisplayView() {
  const q = currentQuestion();
  const revealing = isRevealing();
  const answeredCount = playersArray().filter((p) => p.answered).length;
  const choiceCounts = revealing && q ? getChoiceCounts(q) : null;

  return {
    role: "display",
    status: state.status,
    quiz: getQuizMeta(),
    questionIndex: state.currentQuestionIndex,
    question: q
      ? {
          text: q.text,
          choices: q.choices,
          correctIndex: revealing ? q.correctIndex : null,
          explanation: revealing ? q.explanation ?? null : null,
        }
      : null,
    playerCount: playersArray().length,
    players: state.showParticipantsOnDisplay
      ? playersArray().map((p) => ({ token: p.token, name: p.name }))
      : null,
    answeredCount,
    choiceCounts,
    leaderboard: state.status === "leaderboard" || state.status === "ended" ? sortedLeaderboard() : null,
    history: state.history,
    theme: state.displayTheme,
    joinCode: state.joinCodeEnabled ? state.joinCode : null,
    questions: state.showQuestionsOnDisplay
      ? state.questions.slice(0, 6).map((q) => ({
          id: q.id,
          text: q.text,
          name: state.anonymizeQuestionsOnDisplay ? null : q.name,
        }))
      : null,
  };
}

// 参加者(スマホ)向け：自分の状況と、reveal 以降のみ正解を含める
export function getPlayerView(token) {
  const player = state.players.get(token);
  const q = currentQuestion();
  const revealing = isRevealing();
  const choiceCounts = revealing && q ? getChoiceCounts(q) : null;

  return {
    role: "player",
    status: state.status,
    quiz: getQuizMeta(),
    questionIndex: state.currentQuestionIndex,
    question: q
      ? {
          text: q.text,
          choices: q.choices,
          correctIndex: revealing ? q.correctIndex : null,
          explanation: revealing ? q.explanation ?? null : null,
        }
      : null,
    choiceCounts,
    me: player
      ? {
          name: player.name,
          score: player.score,
          answered: player.answered,
          lastCorrect: player.lastCorrect,
          lastGained: player.lastGained,
          lastChoiceIndex: player.lastChoiceIndex,
        }
      : null,
    rank:
      state.status === "leaderboard" || state.status === "ended"
        ? sortedLeaderboard().find((p) => p.token === token)?.rank ?? null
        : null,
    rankTieCount:
      state.status === "leaderboard" || state.status === "ended"
        ? sortedLeaderboard().find((p) => p.token === token)?.tieCount ?? null
        : null,
    history: getHistoryForPlayer(token),
  };
}

// 履歴に「自分がこの問題で何を選んで正解だったか」をマージして返す
function getHistoryForPlayer(token) {
  const player = state.players.get(token);
  const myAnswers = new Map((player?.answerHistory ?? []).map((a) => [a.questionIndex, a]));
  return state.history.map((h) => {
    const mine = myAnswers.get(h.questionIndex);
    return {
      ...h,
      myChoiceIndex: mine?.choiceIndex ?? null,
      myCorrect: mine?.correct ?? null,
      myGained: mine?.gained ?? 0,
    };
  });
}

export function getAllPlayerTokens() {
  return [...state.players.keys()];
}

export { randomUUID };
