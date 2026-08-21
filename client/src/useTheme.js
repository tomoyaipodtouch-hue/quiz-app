import { useEffect, useState } from "react";

// ダーク/ライトの切り替え。localStorageに保存し、既定はダーク(このアプリの基本デザイン)
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("quiz_theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("quiz_theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return [theme, toggleTheme];
}
