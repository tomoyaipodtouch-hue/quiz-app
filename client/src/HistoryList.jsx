import ResultBars from "./ResultBars.jsx";

// 出題済みの問題を一覧表示する。参加者向け(自分の回答バッジ付き)・
// 操作/表示画面向け(バッジなし)の両方で共通利用する。
export default function HistoryList({ history, totalQuestions }) {
  if (!history || history.length === 0) {
    return <p className="dim">まだ出題された問題はありません。</p>;
  }

  return (
    <div className="history-list">
      {history
        .slice()
        .reverse()
        .map((h) => (
          <div className="history-card" key={h.questionIndex}>
            <div className="badge">
              問題 {h.questionIndex + 1} / {totalQuestions}
            </div>
            <p className="history-question-text">{h.text}</p>
            <ResultBars
              choices={h.choices}
              correctIndex={h.correctIndex}
              choiceCounts={h.choiceCounts}
              myChoiceIndex={h.myChoiceIndex ?? undefined}
            />
            {h.explanation && <div className="explanation-box">{h.explanation}</div>}
          </div>
        ))}
    </div>
  );
}
