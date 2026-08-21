import { useTheme } from "./useTheme.js";

export default function ThemeToggle({ style }) {
  const [theme, toggleTheme] = useTheme();
  return (
    <button className="btn-chip" style={style} onClick={toggleTheme} type="button">
      {theme === "dark" ? "☀️ ライト" : "🌙 ダーク"}
    </button>
  );
}
