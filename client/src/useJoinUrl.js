import { useEffect, useState } from "react";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

// 参加用URL(/play)を組み立てる。
// - localhost で開いている(=PC単体でのローカル開発)場合だけ、LAN IPを自動検出して
//   スマホから届く形のURLを作る。
// - それ以外(クラウドにデプロイした公開URLなど)は、今開いているページと同じオリジンを
//   そのまま使えばよい(スマホもそのURLに直接アクセスできるため)。
export function useJoinUrl() {
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    if (!LOCAL_HOSTNAMES.has(window.location.hostname)) {
      setUrls([`${window.location.origin}/play`]);
      return;
    }

    fetch("/api/host-info")
      .then((res) => res.json())
      .then((data) => {
        const port = window.location.port ? `:${window.location.port}` : "";
        const list = (data.ips || []).map(
          (ip) => `${window.location.protocol}//${ip}${port}/play`
        );
        setUrls(list);
      })
      .catch(() => setUrls([]));
  }, []);

  return urls;
}
