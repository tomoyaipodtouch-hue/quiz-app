import { randomUUID } from "node:crypto";
import { quiz } from "./quizData.js";

// ゲーム全体の状態をここで一元管理する。
// status: 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended'
const state = {
  status: "lobby",
  currentQuestionIndex: -1,
  currentQuestionEndsAt: null,
  players: new Map(), // token -> { token, socketId, name, score, answered, lastCorrect, lastGained }
};

let questionTimer = null;
let onChange = () => {};

export function setOnChange(fn) {
  onChange = fn;
}

function notify() {
  onChange();
}

function currentQuestion() {
  return quiz.questions[state.currentQuestionIndex] ?? null;
}

function clearTimer() {
  if (questionTimer) {
    clearTimeout(questionTimer);
    questionTimer = null;
  }
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

export function submitAnswer(token, choiceIndex) {
  if (state.status !== "question") return;
  const player = state.players.get(token);
  if (!player || player.answered) return;
  const q = currentQuestion();
  if (!q) return;

  player.answered = true;
  const correct = choiceIndex === q.correctIndex;
  const remainingMs = Math.max(0, state.currentQuestionEndsAt - Date.now());
  const remainingRatio = remainingMs / (q.timeLimit * 1000);
  const gained = correct ? Math.round(500 + 500 * remainingRatio) : 0;

  player.lastCorrect = correct;
  player.lastGained = gained;
  player.lastChoiceIndex = choiceIndex;
  player.score += gained;

  notify();

  const allAnswered = [...state.players.values()].every((p) => p.answered);
  if (allAnswered) {
    revealAnswer();
  }
}

export function startQuiz() {
  for (const player of state.players.values()) {
    player.score = 0;
    player.answered = false;
    player.lastCorrect = null;
    player.lastGained = 0;
  }
  state.currentQuestionIndex = -1;
  nextQuestion();
}

export function nextQuestion() {
  clearTimer();
  const nextIndex = state.currentQuestionIndex + 1;
  if (nextIndex >= quiz.questions.length) {
    state.status = "ended";
    state.currentQuestionIndex = quiz.questions.length - 1;
    state.currentQuestionEndsAt = null;
    notify();
    return;
  }

  state.currentQuestionIndex = nextIndex;
  state.status = "question";
  const q = currentQuestion();
  state.currentQuestionEndsAt = Date.now() + q.timeLimit * 1000;

  for (const player of state.players.values()) {
    player.answered = false;
    player.lastCorrect = null;
    player.lastGained = 0;
    player.lastChoiceIndex = null;
  }

  questionTimer = setTimeout(() => {
    revealAnswer();
  }, q.timeLimit * 1000);

  notify();
}

export function revealAnswer() {
  if (state.status !== "question") return;
  clearTimer();
  state.status = "reveal";
  notify();
}

export function showLeaderboard() {
  if (state.status !== "reveal") return;
  state.status = "leaderboard";
  notify();
}

export function resetGame() {
  clearTimer();
  state.status = "lobby";
  state.currentQuestionIndex = -1;
  state.currentQuestionEndsAt = null;
  state.players.clear();
  notify();
}

function playersArray() {
  return [...state.players.values()];
}

function sortedLeaderboard() {
  return playersArray()
    .slice()
    .sort((a, b) => b.score - a.score)
    .map(({ token, name, score, lastCorrect, lastGained }) => ({
      token,
      name,
      score,
      lastCorrect,
      lastGained,
    }));
}

export function getQuizMeta() {
  return { title: quiz.title, totalQuestions: quiz.questions.length };
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
          timeLimit: q.timeLimit,
          explanation: q.explanation ?? null,
        }
      : null,
    endsAt: state.currentQuestionEndsAt,
    players: playersArray().map((p) => ({
      token: p.token,
      name: p.name,
      score: p.score,
      connected: !!p.socketId,
      answered: p.answered,
      lastCorrect: p.lastCorrect,
    })),
    leaderboard: sortedLeaderboard(),
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
          timeLimit: q.timeLimit,
          correctIndex: revealing ? q.correctIndex : null,
          explanation: revealing ? q.explanation ?? null : null,
        }
      : null,
    endsAt: state.currentQuestionEndsAt,
    playerCount: playersArray().length,
    answeredCount,
    choiceCounts,
    leaderboard: state.status === "leaderboard" || state.status === "ended" ? sortedLeaderboard() : null,
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
          timeLimit: q.timeLimit,
          correctIndex: revealing ? q.correctIndex : null,
          explanation: revealing ? q.explanation ?? null : null,
        }
      : null,
    endsAt: state.currentQuestionEndsAt,
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
        ? sortedLeaderboard().findIndex((p) => p.token === token) + 1
        : null,
  };
}

export function getAllPlayerTokens() {
  return [...state.players.keys()];
}

export { randomUUID };
