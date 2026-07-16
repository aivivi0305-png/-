// SNS運用の設定ファイル。ここを編集するだけで下書きの方向性を変えられます。
export default {
  // 投稿予約のタイムゾーン(日本時間)
  timezone: "+09:00",

  // 1日の投稿枠(この時刻に予約投稿される)
  slots: ["12:00", "19:00", "21:00"],

  // 1日に生成する下書きの数(slots の数以下にすること)
  postsPerDay: 3,

  // 生成された下書きのデフォルト投稿先。
  // Instagram にも出す場合は、PR上で下書きの frontmatter に
  // image を設定し platforms に instagram を追加する。
  defaultPlatforms: ["x"],

  // 投稿者のキャラクター・文体。AIはこのペルソナで下書きを書く。
  persona: `
関西弁まじりのフランクな口調で、AI・自動化ツールを実際に触って発信する個人開発者。
専門用語は使うが、初心者にも伝わるように一言で補足する。
煽らない。実体験ベースで、メリットだけでなく注意点も正直に書く。
`.trim(),

  // 発信テーマ。AIはこの中から当日のトレンドに合うものを調査して書く。
  topics: [
    "AIエージェントの活用事例(Claude, ChatGPT, ローカルLLMなど)",
    "SNS運用・コンテンツ制作の自動化Tips",
    "生成AIの最新ニュースと個人への影響",
  ],

  // 投稿に付けるハッシュタグ候補(0〜2個をAIが選ぶ)
  hashtags: ["#AI活用", "#生成AI", "#自動化"],

  // Instagram 投稿用の画像URLのベース。
  // リポジトリが public なら raw.githubusercontent.com が使える:
  //   https://raw.githubusercontent.com/<owner>/<repo>/main
  // private の場合は公開アクセスできる画像ホスティングのURLを指定する。
  imageBaseUrl: "",
};
