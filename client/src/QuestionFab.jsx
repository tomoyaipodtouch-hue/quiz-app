import { forwardRef, useImperativeHandle, useState } from "react";
import { socket } from "./socket.js";

function SpeechBubbleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5h16v11H8l-4 4V5z" />
    </svg>
  );
}

const QuestionFab = forwardRef(function QuestionFab({ token, hideTrigger }, ref) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }));

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    socket.emit("player:askQuestion", { token, text: trimmed }, (res) => {
      setSending(false);
      if (res?.ok) {
        setText("");
        setError("");
        setOpen(false);
        setSent(true);
        setTimeout(() => setSent(false), 2500);
      } else {
        setError(res?.error || "送信できませんでした");
      }
    });
  }

  return (
    <>
      {!hideTrigger && (
        <button type="button" className="question-fab" onClick={() => setOpen((v) => !v)}>
          <SpeechBubbleIcon /> 質問
        </button>
      )}
      {sent && <div className="question-toast">質問を送信しました</div>}
      {open && (
        <div className="question-fab-panel">
          <form onSubmit={handleSubmit}>
            <p className="dim" style={{ fontSize: "0.85rem", marginTop: 0, marginBottom: 8 }}>
              出題者に質問を送る
            </p>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError("");
              }}
              maxLength={300}
              rows={3}
              autoFocus
              placeholder="質問を入力してください"
            />
            {error && (
              <p style={{ color: "var(--bad)", fontSize: "0.8rem", marginTop: 0 }}>{error}</p>
            )}
            <div className="btn-row">
              <button className="btn" type="submit" style={{ flex: 1 }} disabled={!text.trim() || sending}>
                送信する
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                閉じる
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
});

export default QuestionFab;
