const HEADERS = ["question", "choice_a", "choice_b", "choice_c", "choice_d", "correct", "explanation"];
const LETTERS = ["A", "B", "C", "D"];

function escapeCell(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function questionsToCSV(questions) {
  const lines = [HEADERS.join(",")];
  for (const q of questions) {
    lines.push(
      [
        q.text,
        q.choices[0],
        q.choices[1],
        q.choices[2],
        q.choices[3],
        LETTERS[q.correctIndex] ?? "A",
        q.explanation ?? "",
      ]
        .map(escapeCell)
        .join(",")
    );
  }
  // BOM付きにしてExcelで開いたときの文字化けを防ぐ
  return "﻿" + lines.join("\r\n");
}

// 簡易CSVパーサ。ダブルクォートで囲まれたフィールド内のカンマ・改行・""(エスケープされた")に対応
function parseCSVRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, "");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// CSVテキスト → { questions, errors }。ヘッダー行はあってもなくても許容(先頭行が
// ヘッダーっぽければスキップ)
export function csvToQuestions(text) {
  const rows = parseCSVRows(text);
  const errors = [];
  if (rows.length === 0) {
    return { questions: [], errors: ["データが空です"] };
  }

  let dataRows = rows;
  const firstCell = (rows[0][0] || "").trim().toLowerCase();
  if (firstCell === "question" || firstCell === "問題") {
    dataRows = rows.slice(1);
  }

  const questions = [];
  dataRows.forEach((row, i) => {
    const lineNo = i + 1;
    const [text, a, b, c, d, correct, explanation] = row;
    if (!text || !text.trim()) {
      errors.push(`${lineNo}行目: 問題文が空です`);
      return;
    }
    const choices = [a, b, c, d];
    if (choices.some((v) => !v || !v.trim())) {
      errors.push(`${lineNo}行目: 選択肢が4つ揃っていません`);
      return;
    }
    const letter = (correct || "").trim().toUpperCase();
    const correctIndex = LETTERS.indexOf(letter);
    if (correctIndex === -1) {
      errors.push(`${lineNo}行目: 正解の指定(${correct}) はA〜Dで入力してください`);
      return;
    }
    questions.push({
      text: text.trim(),
      choices: choices.map((v) => v.trim()),
      correctIndex,
      explanation: explanation && explanation.trim() ? explanation.trim() : null,
    });
  });

  return { questions, errors };
}

// 説明会などの質問受付機能で溜まった質問一覧をCSVに書き出す(クイズ問題とは別形式)
export function qaQuestionsToCSV(questions) {
  const headers = ["datetime", "name", "text", "shown"];
  const lines = [headers.join(",")];
  for (const q of questions) {
    lines.push(
      [new Date(q.createdAt).toLocaleString("ja-JP"), q.name, q.text, q.shown ? "済" : "未"]
        .map(escapeCell)
        .join(",")
    );
  }
  return "﻿" + lines.join("\r\n");
}

export function downloadCSV(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
