import { useEffect, useState } from "react";

// endsAt(ms epoch)までの残り時間を100msごとに更新して返す
export function useCountdown(endsAt) {
  const [remainingMs, setRemainingMs] = useState(() =>
    endsAt ? Math.max(0, endsAt - Date.now()) : 0
  );

  useEffect(() => {
    if (!endsAt) {
      setRemainingMs(0);
      return;
    }
    setRemainingMs(Math.max(0, endsAt - Date.now()));
    const id = setInterval(() => {
      setRemainingMs(Math.max(0, endsAt - Date.now()));
    }, 100);
    return () => clearInterval(id);
  }, [endsAt]);

  return remainingMs;
}
