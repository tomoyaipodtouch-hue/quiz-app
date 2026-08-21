import ThemeToggle from "./ThemeToggle.jsx";

function QuizIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M8.5 13l2.5 2.5 4.5-5" />
    </svg>
  );
}

// クイズタイトルを常時表示するトップバー。右上にテーマ切り替え。
export default function TopBar({ title }) {
  return (
    <div className="app-topbar">
      <div className="app-topbar-icon">
        <QuizIcon />
      </div>
      <div className="app-topbar-title">{title}</div>
      <ThemeToggle />
    </div>
  );
}
