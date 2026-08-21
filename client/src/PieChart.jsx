const CHOICE_LABELS = ["A", "B", "C", "D"];
const SEGMENT_COLORS = ["var(--chart-a)", "var(--chart-b)", "var(--chart-c)", "var(--chart-d)"];

// 選択肢ごとの割合を示すドーナツ円グラフ。凡例付き。
export default function PieChart({ choiceCounts }) {
  const total = choiceCounts.reduce((sum, c) => sum + c, 0);

  let cursor = 0;
  const stops = choiceCounts.map((count, i) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    const start = cursor;
    cursor += pct;
    return `${SEGMENT_COLORS[i]} ${start}% ${cursor}%`;
  });
  const gradient =
    total > 0 ? `conic-gradient(${stops.join(", ")})` : `conic-gradient(var(--border) 0% 100%)`;

  return (
    <div className="pie-chart-wrap">
      <div className="pie-chart" style={{ background: gradient }} />
      <div className="pie-legend">
        {choiceCounts.map((count, i) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div className="pie-legend-row" key={i}>
              <span className="pie-legend-dot" style={{ background: SEGMENT_COLORS[i] }} />
              <span>{CHOICE_LABELS[i]}</span>
              <span className="dim" style={{ marginLeft: "auto" }}>
                {pct}%（{count}票）
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
