import ThemeToggle from "./ThemeToggle.jsx";

function QuizIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 1.9v.3" />
      <circle cx="12" cy="17.5" r="0.6" fill="currentColor" stroke="none" />
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
