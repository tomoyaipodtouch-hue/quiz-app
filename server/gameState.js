import { randomUUID } from "node:crypto";
import { quiz } from "./quizData.js";

const POINTS_PER_CORRECT = 1000;

// ゲーム全体の状態をここで一元管理する。
// status: 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended'
const state = {
  status: "lobby",
  currentQuestionIndex: -1,
  players: new Map(), // token -> { token, socketId, name, score, answered, lastCorrect, lastGained }
  history: [], // 出題済みの問題の結果(集計済み)。revealAnswer() のタイミングで積む
  gameEpoch: randomUUID(), // リセットのたびに発行し直す世代ID。古い世代のブラウザは自動再参加させない
};

export function getGameEpoch() {
  return state.gameEpoch;
}

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
  const gained = correct ? POINTS_PER_CORRECT : 0;

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
  if (nextIndex >= quiz.questions.length) {
    state.status = "ended";
    state.currentQuestionIndex = quiz.questions.length - 1;
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
    answeredCount,
    choiceCounts,
    leaderboard: state.status === "leaderboard" || state.status === "ended" ? sortedLeaderboard() : null,
    history: state.history,
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
        ? sortedLeaderboard().findIndex((p) => p.token === token) + 1
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
