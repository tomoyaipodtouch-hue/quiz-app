// サンプルクイズ。あとで差し替え/追加しやすいようシンプルな配列構造にしています。
export const quiz = {
  title: "サンプルクイズ",
  questions: [
    {
      text: "日本の首都はどこ？",
      choices: ["大阪", "東京", "京都", "名古屋"],
      correctIndex: 1,
      timeLimit: 20,
      explanation: "東京都が日本の首都です。1868年に「東京」と改称されました。",
    },
    {
      text: "1 + 1 × 2 の答えは？",
      choices: ["3", "4", "2", "6"],
      correctIndex: 0,
      timeLimit: 20,
      explanation: "掛け算は足し算より先に計算するので、1 + (1×2) = 3 になります。",
    },
    {
      text: "地球から一番近い惑星は？",
      choices: ["火星", "木星", "金星", "土星"],
      correctIndex: 2,
      timeLimit: 20,
      explanation: "地球の軌道に最も近いのは金星です。平均距離では実は火星より金星の方が近いことが知られています。",
    },
    {
      text: "Node.jsは何で書かれている？",
      choices: ["Python", "Java", "C++", "JavaScript"],
      correctIndex: 3,
      timeLimit: 20,
      explanation: "Node.jsのコア自体はC++で書かれた部分もありますが、開発者が書くコードはJavaScriptです。",
    },
  ],
};
