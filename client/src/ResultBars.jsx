const CHOICE_LABELS = ["A", "B", "C", "D"];
const CHART_COLORS = ["var(--chart-a)", "var(--chart-b)", "var(--chart-c)", "var(--chart-d)"];

// 選択肢ごとの得票率バー。参加者画面・表示画面の両方で使う。
// compact: true にすると、表示画面(投影用)で長文でも1画面に収まりやすいよう文字や余白を詰める
export default function ResultBars({ choices, correctIndex, choiceCounts, myChoiceIndex, compact }) {
  const total = choiceCounts.reduce((sum, c) => sum + c, 0);

  return (
    <div className={`result-list ${compact ? "compact" : ""}`}>
      {choices.map((choice, i) => {
        const count = choiceCounts[i] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isCorrect = i === correctIndex;
        const isMine = myChoiceIndex === i;

        return (
          <div key={i} className={`result-row ${isCorrect ? "is-correct" : ""}`}>
            <div className="result-row-label">
              {CHOICE_LABELS[i]}: {choice}
            </div>
            <div className="result-row-meta">
              <span className="result-row-badges">
                {isCorrect && <span className="result-badge correct">正解</span>}
                {isMine && <span className="result-badge mine">あなたの回答</span>}
              </span>
              <span className="result-row-pct">{pct}%</span>
            </div>
            <div className="result-bar-track">
              <div
                className="result-bar-fill"
                style={{ width: `${pct}%`, background: CHART_COLORS[i] }}
              />
            </div>
            <div className="result-row-votes">{count}票</div>
          </div>
        );
      })}
    </div>
  );
}
