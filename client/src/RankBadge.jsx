const RANK_COLORS = { 1: "var(--gold)", 2: "var(--silver)", 3: "var(--bronze)" };

export function rankColor(rank) {
  return RANK_COLORS[rank] ?? "var(--accent)";
}

export function CrownIcon({ rank, size = 16 }) {
  const color = RANK_COLORS[rank];
  if (!color) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      style={{ verticalAlign: "-0.15em", flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M4 18 2 7 7.5 11 12 4 16.5 11 22 7 20 18Z" fill={color} />
      <rect x="3" y="18" width="18" height="2.5" rx="1" fill={color} />
    </svg>
  );
}
