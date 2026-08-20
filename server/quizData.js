// サンプルクイズ。あとで差し替え/追加しやすいようシンプルな配列構造にしています。
export const quiz = {
  title: "サンプルクイズ",
  questions: [
    {
      text: "日本の首都はどこ？",
      choices: ["大阪", "東京", "京都", "名古屋"],
      correctIndex: 1,
      timeLimit: 20,
    },
    {
      text: "1 + 1 × 2 の答えは？",
      choices: ["3", "4", "2", "6"],
      correctIndex: 0,
      timeLimit: 20,
    },
    {
      text: "地球から一番近い惑星は？",
      choices: ["火星", "木星", "金星", "土星"],
      correctIndex: 2,
      timeLimit: 20,
    },
    {
      text: "Node.jsは何で書かれている？",
      choices: ["Python", "Java", "C++", "JavaScript"],
      correctIndex: 3,
      timeLimit: 20,
    },
  ],
};
