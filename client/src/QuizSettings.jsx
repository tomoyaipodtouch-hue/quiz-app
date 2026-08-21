import { useRef, useState } from "react";
import { csvToQuestions, downloadCSV, questionsToCSV } from "./csv.js";

const LETTERS = ["A", "B", "C", "D"];

function emptyQuestion() {
  return { text: "", choices: ["", "", "", ""], correctIndex: 0, explanation: "" };
}

export default function QuizSettings({ initialQuiz, onSave, onCancel }) {
  const [title, setTitle] = useState(initialQuiz.title);
  const [questions, setQuestions] = useState(
    initialQuiz.questions.map((q) => ({ ...q, choices: [...q.choices], explanation: q.explanation ?? "" }))
  );
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  function updateQuestion(i, patch) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function updateChoice(i, choiceIndex, value) {
    setQuestions((qs) =>
      qs.map((q, idx) =>
        idx === i ? { ...q, choices: q.choices.map((c, ci) => (ci === choiceIndex ? value : c)) } : q
      )
    );
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, emptyQuestion()]);
  }

  function removeQuestion(i) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }

  function moveQuestion(i, dir) {
    setQuestions((qs) => {
      const next = [...qs];
      const j = i + dir;
      if (j < 0 || j >= next.length) return qs;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function handleExportCSV() {
    downloadCSV("quiz.csv", questionsToCSV(questions));
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { questions: imported, errors: parseErrors } = csvToQuestions(String(reader.result));
      if (parseErrors.length > 0) {
        setErrors(parseErrors);
      }
      if (imported.length > 0) {
        setQuestions(imported.map((q) => ({ ...q, explanation: q.explanation ?? "" })));
        if (parseErrors.length === 0) setErrors([]);
      }
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  function handleSave() {
    const validationErrors = [];
    if (!title.trim()) validationErrors.push("クイズのタイトルを入力してください");
    questions.forEach((q, i) => {
      if (!q.text.trim()) validationErrors.push(`問題${i + 1}: 問題文が空です`);
      if (q.choices.some((c) => !c.trim())) validationErrors.push(`問題${i + 1}: 選択肢が4つ揃っていません`);
    });
    if (questions.length === 0) validationErrors.push("問題を1つ以上追加してください");

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    onSave(
      {
        title: title.trim(),
        questions: questions.map((q) => ({
          text: q.text.trim(),
          choices: q.choices.map((c) => c.trim()),
          correctIndex: q.correctIndex,
          explanation: q.explanation.trim() || null,
        })),
      },
      (result) => {
        setSaving(false);
        if (!result.ok) setErrors([result.error || "保存に失敗しました"]);
      }
    );
  }

  return (
    <div className="card" style={{ maxWidth: "none" }}>
      <div className="title">クイズ設定</div>
      <p className="dim">
        保存すると進行中のクイズはリセットされます。CSVは question, choice_a〜d, correct(A〜D),
        explanation の列で入出力できます。
      </p>

      {errors.length > 0 && (
        <div className="settings-errors">
          {errors.map((e, i) => (
            <p key={i}>⚠ {e}</p>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <label className="dim" style={{ fontSize: "0.85rem" }}>
          クイズのタイトル
        </label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-secondary" onClick={handleImportClick}>
          CSVをインポート
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleExportCSV}>
          CSVをエクスポート
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      <div className="settings-question-list">
        {questions.map((q, i) => (
          <div className="settings-question-card" key={i}>
            <div className="settings-question-head">
              <span className="badge" style={{ margin: 0 }}>
                問題 {i + 1}
              </span>
              <div className="btn-row" style={{ marginTop: 0 }}>
                <button type="button" className="btn-chip" onClick={() => moveQuestion(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-chip"
                  onClick={() => moveQuestion(i, 1)}
                  disabled={i === questions.length - 1}
                >
                  ↓
                </button>
                <button type="button" className="btn-chip" onClick={() => removeQuestion(i)}>
                  削除
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="問題文"
              value={q.text}
              onChange={(e) => updateQuestion(i, { text: e.target.value })}
            />

            <div className="settings-choice-grid">
              {q.choices.map((c, ci) => (
                <div className="settings-choice-row" key={ci}>
                  <label className="settings-correct-radio">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      checked={q.correctIndex === ci}
                      onChange={() => updateQuestion(i, { correctIndex: ci })}
                    />
                    {LETTERS[ci]}
                  </label>
                  <input
                    type="text"
                    placeholder={`選択肢 ${LETTERS[ci]}`}
                    value={c}
                    onChange={(e) => updateChoice(i, ci, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <input
              type="text"
              placeholder="解説(任意)"
              value={q.explanation}
              onChange={(e) => updateQuestion(i, { explanation: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div className="btn-row">
        <button type="button" className="btn btn-secondary" onClick={addQuestion}>
          + 問題を追加
        </button>
      </div>

      <div className="btn-row">
        <button type="button" className="btn" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
          保存する
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          戻る
        </button>
      </div>
    </div>
  );
}
