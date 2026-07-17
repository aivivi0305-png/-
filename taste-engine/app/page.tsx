"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TasteRole = "見るのが好き" | "自分でも使いたい" | "自分らしい" | "制作の参考" | "なぜか気になる";
type LearningMode = "taste" | "knowledge" | "both";

type SavedItem = {
  id: number | string;
  title: string;
  source: string;
  url?: string;
  type: string;
  role: TasteRole;
  art: string;
  tags: string[];
  imageUrl?: string;
  learningMode?: LearningMode;
  knowledgeNote?: string;
};

type TelegramStatus = { configured: boolean; paired: boolean; entries: number };

type Recommendation = {
  id: string;
  backendId?: number;
  kind: "本命" | "半歩外側" | "異物";
  kindClass: "near" | "edge" | "wild";
  kicker: string;
  title: string;
  source: string;
  description?: string;
  reason: string;
  art: string;
  tags: string[];
  url?: string;
};

type WeeklySummary = { weekKey: string; profileSummary: string; observation: string };

const roles: TasteRole[] = [
  "見るのが好き",
  "自分でも使いたい",
  "自分らしい",
  "制作の参考",
  "なぜか気になる",
];

const savedSeed: SavedItem[] = [
  { id: 1, title: "Quiet structure", source: "Studio Freight", type: "Web", role: "自分らしい", art: "art-grid", tags: ["広い余白", "太いサンセリフ"] },
  { id: 2, title: "Late afternoon", source: "Olivia Malone", type: "Photo", role: "見るのが好き", art: "art-window", tags: ["自然光", "低彩度"] },
  { id: 3, title: "Issue No. 14", source: "Rakesprogress", type: "Graphic", role: "制作の参考", art: "art-type", tags: ["非対称", "編集的"] },
  { id: 4, title: "Soft brutalism", source: "Collection 08", type: "Web", role: "なぜか気になる", art: "art-blue", tags: ["硬い構造", "柔らかい色"] },
  { id: 5, title: "Domestic study", source: "North Journal", type: "Photo", role: "自分でも使いたい", art: "art-chair", tags: ["素材感", "生活の痕跡"] },
  { id: 6, title: "Unfinished type", source: "Form Archive", type: "Graphic", role: "制作の参考", art: "art-red", tags: ["崩した文字", "緊張感"] },
];

const recommendationSeed: Recommendation[] = [
  {
    id: "near",
    kind: "本命",
    kindClass: "near",
    kicker: "92% match",
    title: "Linen, shadow, silence",
    source: "Apartamento · Visual story",
    reason: "最近保存した室内写真と同じく、温かい白と深い影を使いながら、黒を潰さず素材感を残しています。",
    art: "art-linen",
    tags: ["温かい白", "自然光", "深い影"],
  },
  {
    id: "edge",
    kind: "半歩外側",
    kindClass: "edge",
    kicker: "Useful tension",
    title: "Order meets acid yellow",
    source: "Actual Source · Campaign",
    reason: "鮮やかな黄色は普段より強い一方、明確なグリッドに一箇所だけ崩しを入れる考え方は、あなたの傾向に近いです。",
    art: "art-acid",
    tags: ["明確なグリッド", "差し色", "一箇所の崩し"],
  },
  {
    id: "wild",
    kind: "異物",
    kindClass: "wild",
    kicker: "14% familiar",
    title: "A polished interruption",
    source: "PIN–UP · Archive",
    reason: "光沢と寒色は普段の好みから遠いですが、硬い構造と人の痕跡が同居する点に、試す価値のある接点があります。",
    art: "art-chrome",
    tags: ["光沢", "寒色", "人の痕跡"],
  },
];

const portraitTraits = [
  { label: "構造", value: "整然", score: 86 },
  { label: "表面", value: "人の痕跡", score: 72 },
  { label: "色温度", value: "やや温かい", score: 68 },
  { label: "コントラスト", value: "静かな強さ", score: 61 },
];

function Art({ className, compact = false }: { className: string; compact?: boolean }) {
  return (
    <div className={`art ${className}${compact ? " art-compact" : ""}`} aria-hidden="true">
      <span className="art-mark art-mark-a" />
      <span className="art-mark art-mark-b" />
      <span className="art-mark art-mark-c" />
    </div>
  );
}

function Wordmark() {
  return (
    <div className="wordmark" aria-label="Taste Engine">
      <span className="wordmark-symbol">T<span>E</span></span>
      <span className="wordmark-name">Taste<br />Engine</span>
    </div>
  );
}

function readKnowledgeNote(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value) as { knowledgeNote?: unknown };
    return typeof parsed.knowledgeNote === "string" ? parsed.knowledgeNote : undefined;
  } catch {
    return undefined;
  }
}

export default function Home() {
  const [savedItems, setSavedItems] = useState<SavedItem[]>(savedSeed);
  const [saveOpen, setSaveOpen] = useState(false);
  const [collectionExpanded, setCollectionExpanded] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null);
  const [selectedRole, setSelectedRole] = useState<TasteRole>("なぜか気になる");
  const [selectedType, setSelectedType] = useState("Web");
  const [toast, setToast] = useState("");
  const [answered, setAnswered] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("home");
  const [telegramItems, setTelegramItems] = useState<SavedItem[]>([]);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus>({ configured: false, paired: false, entries: 0 });
  const [signInRequired, setSignInRequired] = useState(false);
  const [weeklyRecommendations, setWeeklyRecommendations] = useState<Recommendation[]>(recommendationSeed);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem("taste-engine-state-v1");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { items?: SavedItem[]; answered?: string | null };
      if (parsed.items?.length) setSavedItems(parsed.items);
      if (parsed.answered) setAnswered(parsed.answered);
    } catch {
      // A broken local draft should never prevent the collection from opening.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("taste-engine-state-v1", JSON.stringify({ items: savedItems, answered }));
  }, [savedItems, answered]);

  useEffect(() => {
    const roleByIntent: Record<string, TasteRole> = {
      use: "自分でも使いたい",
      view: "見るのが好き",
      reference: "制作の参考",
      unusual: "なぜか気になる",
    };
    const aspectByKey: Record<string, string> = {
      whole: "全体",
      color: "色",
      composition: "構図",
      type: "文字",
      texture: "質感",
      mood: "雰囲気",
      content: "内容",
      visual: "見た目",
      both: "内容と見た目",
      curious: "なぜか気になる",
    };

    Promise.all([
      fetch("/api/taste/entries", { cache: "no-store" }),
      fetch("/api/telegram/status", { cache: "no-store" }),
      fetch("/api/taste/weekly", { cache: "no-store" }),
    ]).then(async ([entriesResponse, statusResponse, weeklyResponse]) => {
      if ([entriesResponse, statusResponse, weeklyResponse].some((response) => response.status === 401)) {
        setSignInRequired(true);
        return;
      }
      if (entriesResponse.ok) {
        const payload = await entriesResponse.json() as { entries?: Array<Record<string, unknown>> };
        const mapped = (payload.entries ?? []).map((entry): SavedItem => {
          const sourceType = String(entry.sourceType ?? "text");
          const intent = String(entry.intent ?? "");
          const aspect = String(entry.aspect ?? "");
          const rawLearningMode = String(entry.learningMode ?? "taste");
          const learningMode: LearningMode = rawLearningMode === "knowledge" || rawLearningMode === "both" ? rawLearningMode : "taste";
          const modeLabel = learningMode === "knowledge" ? "知識" : learningMode === "both" ? "好み＋知識" : "好み";
          return {
            id: `telegram-${entry.id}`,
            title: String(entry.title || "Telegramからの保存"),
            source: sourceType === "url" ? String(entry.sourceUrl || "Telegram") : "Telegram",
            url: typeof entry.sourceUrl === "string" ? entry.sourceUrl : undefined,
            type: sourceType === "photo" ? "Photo" : sourceType === "url" ? "Web" : "Graphic",
            role: roleByIntent[intent] ?? (learningMode === "knowledge" ? "制作の参考" : "なぜか気になる"),
            art: sourceType === "photo" ? "art-new-photo" : sourceType === "url" ? "art-new-web" : "art-new-graphic",
            tags: [modeLabel, aspectByKey[aspect] ?? (learningMode === "knowledge" ? "考え方" : "回答待ち"), "Telegram"],
            imageUrl: typeof entry.mediaUrl === "string" ? entry.mediaUrl : undefined,
            learningMode,
            knowledgeNote: readKnowledgeNote(entry.analysisJson),
          };
        });
        setTelegramItems(mapped);
      }
      if (statusResponse.ok) setTelegramStatus(await statusResponse.json() as TelegramStatus);
      if (weeklyResponse.ok) {
        const payload = await weeklyResponse.json() as {
          report?: WeeklySummary | null;
          recommendations?: Array<Record<string, unknown>>;
        };
        if (payload.report && payload.recommendations?.length) {
          const categoryMap: Record<string, Pick<Recommendation, "kind" | "kindClass" | "art" | "kicker">> = {
            close: { kind: "本命", kindClass: "near", art: "art-linen", kicker: "かなり近い" },
            edge: { kind: "半歩外側", kindClass: "edge", art: "art-acid", kicker: "少し外側" },
            wildcard: { kind: "異物", kindClass: "wild", art: "art-chrome", kicker: "意外枠" },
          };
          const kindMap: Record<string, string> = { site: "サイト", article: "情報・記事", inspiration: "インスピレーション" };
          setWeeklyRecommendations(payload.recommendations.map((item, index) => {
            const category = categoryMap[String(item.category)] ?? categoryMap.edge;
            const url = String(item.url || "");
            let hostname = "Weekly discovery";
            try { hostname = new URL(url).hostname.replace(/^www\./, ""); } catch { /* Keep the fallback label. */ }
            return {
              id: `weekly-${item.id}`,
              backendId: Number(item.id),
              ...category,
              art: String(item.category) === "close" && index % 2 ? "art-grid" : category.art,
              title: String(item.title || "Untitled discovery"),
              source: `${hostname} · ${kindMap[String(item.kind)] ?? "発見"}`,
              description: String(item.description || ""),
              reason: String(item.reason || ""),
              tags: [category.kind, kindMap[String(item.kind)] ?? "発見"],
              url,
            };
          }));
          setWeeklySummary(payload.report);
        }
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!saveOpen && !selectedRecommendation) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSaveOpen(false);
        setSelectedRecommendation(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [saveOpen, selectedRecommendation]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const signalCount = 41 + savedItems.length + telegramItems.length;
  const portraitProgress = Math.min(100, Math.round((signalCount / 50) * 100));
  const remaining = Math.max(0, 50 - signalCount);
  const collectionItems = useMemo(
    () => [...telegramItems, ...savedItems.slice().reverse()],
    [savedItems, telegramItems],
  );
  const latestItems = useMemo(() => collectionItems.slice(0, 6), [collectionItems]);
  const knowledgeItems = useMemo(
    () => collectionItems.filter((item) => item.learningMode !== "taste" && item.knowledgeNote),
    [collectionItems],
  );

  const navigateTo = (id: string) => {
    setActiveNav(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const addReference = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const url = String(form.get("url") || "").trim();
    const note = String(form.get("note") || "").trim();
    let source = "Personal reference";
    if (url) {
      try {
        source = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", "");
      } catch {
        source = url.slice(0, 28);
      }
    }
    const artByType: Record<string, string> = { Web: "art-new-web", Photo: "art-new-photo", Graphic: "art-new-graphic" };
    const newItem: SavedItem = {
      id: Date.now(),
      title: note || "Untitled reference",
      source,
      url: url ? (url.startsWith("http") ? url : `https://${url}`) : undefined,
      type: selectedType,
      role: selectedRole,
      art: artByType[selectedType],
      tags: selectedType === "Photo" ? ["光を分析中", "距離感を分析中"] : ["構造を分析中", "色を分析中"],
    };
    setSavedItems((items) => [...items, newItem]);
    setSaveOpen(false);
    setToast(remaining <= 1 ? "最初の好みプロフィールを作れるようになりました" : "保存しました。AIが好みの特徴を読み取っています");
    event.currentTarget.reset();
  };

  const answerQuestion = (choice: string) => {
    setAnswered(choice);
    setToast("回答を記録しました。好みの境界を更新します");
  };

  const reactToRecommendation = (reaction: string) => {
    const recommendation = selectedRecommendation;
    setSelectedRecommendation(null);
    if (recommendation?.backendId) {
      fetch("/api/taste/weekly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: recommendation.backendId,
          feedback: reaction === "今は違う" ? "dislike" : "like",
        }),
      }).catch(() => undefined);
    }
    setToast(`「${reaction}」として学習しました`);
  };

  const telegramStateLabel = telegramStatus.paired
    ? `接続済み · ${telegramStatus.entries}件`
    : telegramStatus.configured ? "ペアリング待ち" : "未設定";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Wordmark />
          <nav className="top-nav" aria-label="メインナビゲーション">
            <button className={activeNav === "home" ? "active" : ""} onClick={() => navigateTo("home")}>ホーム</button>
            <button className={activeNav === "collection" ? "active" : ""} onClick={() => navigateTo("collection")}>保存したもの</button>
            <button className={activeNav === "portrait" ? "active" : ""} onClick={() => navigateTo("portrait")}>好みプロフィール</button>
            <button className={activeNav === "brief" ? "active" : ""} onClick={() => navigateTo("brief")}>制作に使う</button>
          </nav>
          <button className="save-button" onClick={() => setSaveOpen(true)}><span aria-hidden="true">＋</span>好みを教える</button>
        </div>
      </header>

      <main className="page">
        <section className="hero" id="home">
          <div className="hero-copy">
            <p className="eyebrow">Taste learning hub · あなた専用</p>
            <h1>あなたの「好き」を、<em>AIに教える場所。</em></h1>
            <p className="hero-lead">気になったものを保存し、AIからの質問に答え、解釈が違えば直す。その繰り返しで、自分でも言葉にできない好みを育てていきます。</p>
          </div>
          <aside className="hero-progress" aria-label="学習の進み具合">
            <div className="progress-top">
              <span>学習データ</span>
              <strong>{signalCount}<small> / 50</small></strong>
            </div>
            <div className="progress-bar" role="img" aria-label={`学習の進み具合 ${portraitProgress}%`}><i style={{ width: `${portraitProgress}%` }} /></div>
            <p className="progress-note">{remaining ? `あと${remaining}件で最初の好みプロフィールが完成します` : "好みプロフィールを作成できます"}</p>
            <div className="hero-chips">
              <span className={`chip${telegramStatus.paired ? " chip-on" : ""}`}><i className="chip-dot" aria-hidden="true" />Telegram {telegramStateLabel}</span>
              <span className="chip">{weeklySummary ? `週次レポート ${weeklySummary.weekKey}` : "週次レポートは3件学習後"}</span>
            </div>
          </aside>
        </section>

        <section className="section" aria-labelledby="learning-heading">
          <div className="section-head">
            <div>
              <h2 id="learning-heading">今日やること</h2>
              <p>3分ほどで、AIの理解が少し深まります。</p>
            </div>
          </div>
          <div className="task-grid">
            <button className="task-card task-primary" onClick={() => setSaveOpen(true)}>
              <div className="task-top"><span className="task-number">1</span><span className="task-status">{telegramStatus.paired ? "Telegram接続済み" : "まずはこれ"}</span></div>
              <h3>AIに好みを教える</h3>
              <p>気になった画像やサイトを保存して、どこが好きかを伝えます。</p>
              <span className="task-action">保存する <b aria-hidden="true">＋</b></span>
            </button>
            <button className={`task-card${answered ? " task-done" : ""}`} onClick={() => document.getElementById("question")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              <div className="task-top"><span className="task-number">2</span><span className="task-status">{answered ? "回答済み ✓" : "1問あります"}</span></div>
              <h3>AIの質問に答える</h3>
              <p>迷っている点だけ比較して、好みの境界をはっきりさせます。</p>
              <span className="task-action">{answered ? "回答を見直す" : "質問に答える"} <b aria-hidden="true">→</b></span>
            </button>
            <button className="task-card" onClick={() => navigateTo("portrait")}>
              <div className="task-top"><span className="task-number">3</span><span className="task-status">更新あり</span></div>
              <h3>AIの理解を確認する</h3>
              <p>現在の解釈を読み、違うところがあれば修正します。</p>
              <span className="task-action">理解を見る <b aria-hidden="true">→</b></span>
            </button>
          </div>
          {telegramStatus.configured && (
            <div className="telegram-channel" role="status">
              <span className="telegram-mark" aria-hidden="true">➤</span>
              <div>
                <strong>Telegramから保存できます</strong>
                <p>画像やURLをBotへ送るだけでこのハブに追加。記事は「好み」「知識」「両方」から学び方を選べます。</p>
              </div>
              <span className={telegramStatus.paired ? "channel-state connected" : "channel-state"}>{telegramStateLabel}</span>
            </div>
          )}
        </section>

        <div className="duo">
          <section className="panel question-panel" id="question" aria-labelledby="question-heading">
            <div className="panel-top"><span className="panel-label">AIからの質問</span><span className="panel-meta">この回答も学習データになります</span></div>
            <h2 id="question-heading">惹かれているのは、光ですか、余白ですか？</h2>
            <div className="compare-grid">
              <button className={answered === "光" ? "selected" : ""} onClick={() => answerQuestion("光")} aria-pressed={answered === "光"}>
                <Art className="art-choice-light" compact /><span><b aria-hidden="true">A</b>光</span>
              </button>
              <button className={answered === "余白" ? "selected" : ""} onClick={() => answerQuestion("余白")} aria-pressed={answered === "余白"}>
                <Art className="art-choice-space" compact /><span><b aria-hidden="true">B</b>余白</span>
              </button>
            </div>
            {answered ? <p className="answer-confirm">「{answered}」を学習しました。いつでも変更できます。</p> : <p className="question-foot">正解はありません。いまの直感で選んでください。</p>}
          </section>

          <section className="panel portrait-panel" id="portrait" aria-labelledby="portrait-heading">
            <div className="panel-top"><span className="panel-label">好みプロフィール</span><span className="panel-meta">AIの現在の理解</span></div>
            <div className="portrait-head">
              <h2 id="portrait-heading">秩序の中に、<br />人の痕跡を残す。</h2>
              <div className="portrait-score" aria-label={`${portraitProgress}% 完了`}>
                <strong>{portraitProgress}<small>%</small></strong>
                <span>学習度</span>
              </div>
            </div>
            <div className="trait-list">
              {portraitTraits.map((trait) => (
                <div className="trait" key={trait.label}>
                  <span className="trait-label">{trait.label}</span>
                  <strong>{trait.value}</strong>
                  <div className="trait-line"><i style={{ width: `${trait.score}%` }} /></div>
                </div>
              ))}
            </div>
            <button className="text-link" onClick={() => setToast("50件たまると、詳しい好みプロフィールを作成できます")}>AIの解釈を確認・修正する <span aria-hidden="true">→</span></button>
          </section>
        </div>

        <section className="section" aria-labelledby="recommendation-heading">
          <div className="section-head">
            <div>
              <h2 id="recommendation-heading">{weeklySummary ? "今週の発見" : "好みを確かめる3件"}</h2>
              <p>{weeklySummary ? `${weeklySummary.weekKey}の週次レポート` : "3件以上学習すると、あなた向けの週次レポートに置き換わります。"}</p>
            </div>
            {!weeklySummary && <span className="sample-flag">サンプル</span>}
          </div>
          {weeklySummary && (
            <div className="weekly-summary">
              <div><span>今週見えている好み</span><p>{weeklySummary.profileSummary}</p></div>
              <div><span>変化・仮説</span><p>{weeklySummary.observation}</p></div>
            </div>
          )}
          <div className="recommendation-grid">
            {weeklyRecommendations.map((item) => (
              <button className="recommendation-card" key={item.id} onClick={() => setSelectedRecommendation(item)}>
                <div className="recommendation-art-wrap">
                  <Art className={item.art} />
                  <span className={`kind kind-${item.kindClass}`}>{item.kind}</span>
                  <span className="open-mark" aria-hidden="true">↗</span>
                </div>
                <div className="recommendation-copy">
                  <div className="match-label">{item.kicker}</div>
                  <h3>{item.title}</h3>
                  <p>{item.source}</p>
                  <div className="reason-line"><span>理由</span>{item.reason}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="section" id="collection" aria-labelledby="collection-heading">
          <div className="section-head">
            <div>
              <h2 id="collection-heading">保存したもの</h2>
              <p>学習データ {signalCount}件{knowledgeItems.length ? ` · 知識 ${knowledgeItems.length}件` : ""}</p>
            </div>
            <button className="ghost-button" type="button" aria-expanded={collectionExpanded} onClick={() => setCollectionExpanded((open) => !open)}>{collectionExpanded ? "一覧を閉じる ↑" : "すべて見る →"}</button>
          </div>
          {signInRequired && (
            <div className="sign-in-notice" role="status">
              <div>
                <strong>Telegramから保存したデータを表示する</strong>
                <p>このブラウザではまだ本人確認ができていません。ログインすると、iPhoneで見えている保存内容と同期します。</p>
              </div>
              <a href="/signin-with-chatgpt?return_to=%2F">ChatGPTでログイン <span aria-hidden="true">→</span></a>
            </div>
          )}
          {knowledgeItems.length > 0 && (
            <div className="knowledge-library">
              <div className="knowledge-library-heading"><span>Knowledge</span><p>好みを広げるために取り込んだ考え方</p></div>
              <div className="knowledge-library-grid">
                {knowledgeItems.slice(0, 3).map((item) => (
                  <article key={item.id}><span>{item.learningMode === "both" ? "好み＋知識" : "知識"}</span><h3>{item.title}</h3><p>「{item.knowledgeNote}」</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer">元の記事 <b aria-hidden="true">↗</b></a>}</article>
                ))}
              </div>
            </div>
          )}
          <div className="collection-grid">
            {latestItems.map((item, index) => (
              <article className={`collection-card collection-card-${index + 1}`} key={item.id}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Art className={item.art} />}
                <div className="collection-caption">
                  <div className="collection-caption-meta"><span>{item.type}</span><span>{item.role}</span></div>
                  <h3>{item.title}</h3>
                  <p>{item.source}</p>
                </div>
              </article>
            ))}
            <button className="collection-add" onClick={() => setSaveOpen(true)}>
              <span aria-hidden="true">＋</span>
              <strong>AIに好みを教える</strong>
              <small>気になったURLを保存</small>
            </button>
          </div>
          {collectionExpanded && (
            <div className="collection-all" aria-label="保存済みの学習データ一覧">
              <p className="collection-all-note">保存順に表示しています。URLを保存したものは、ここから元のページも開けます。知識として保存したものには、持ち帰った考えも残ります。</p>
              <div className="collection-all-grid">
                {collectionItems.map((item) => (
                  <article className="collection-all-card" key={item.id}>
                    <div className="collection-all-art">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <Art className={item.art} />}
                    </div>
                    <div className="collection-all-copy">
                      <div className="collection-all-meta"><span>{item.type}</span><span>{item.role}</span></div>
                      <h3>{item.title}</h3>
                      <p>{item.source}</p>
                      <div className="tag-row">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                      {item.knowledgeNote && <p className="knowledge-note">「{item.knowledgeNote}」</p>}
                      {item.url && <a href={item.url} target="_blank" rel="noreferrer">保存元を開く <span aria-hidden="true">↗</span></a>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="brief-panel" id="brief" aria-labelledby="brief-heading">
          <div className="brief-copy">
            <span className="panel-label">学習した好みを活用</span>
            <h2 id="brief-heading">制作に使う</h2>
            <p>AIが理解した好みから、色・余白・写真・タイポグラフィの指示書を作成します。</p>
            <div className="brief-tags"><span>温かい白</span><span>深い自然光</span><span>太いサンセリフ</span><span>一箇所の崩し</span></div>
          </div>
          <button onClick={() => setToast("好みプロフィール完成後に、制作指示書を生成できます")}>制作指示書を作る <span aria-hidden="true">↗</span></button>
        </section>
      </main>

      <footer><span>Taste Engine · Learning hub</span><span>保存する → 答える → 確認する → 修正する</span></footer>

      <nav className="mobile-nav" aria-label="モバイルナビゲーション">
        <button className={activeNav === "home" ? "active" : ""} onClick={() => navigateTo("home")}><span aria-hidden="true">◉</span>ホーム</button>
        <button className={activeNav === "collection" ? "active" : ""} onClick={() => navigateTo("collection")}><span aria-hidden="true">▦</span>保存一覧</button>
        <button className="mobile-save" aria-label="AIに好みを教える" onClick={() => setSaveOpen(true)}>＋</button>
        <button className={activeNav === "portrait" ? "active" : ""} onClick={() => navigateTo("portrait")}><span aria-hidden="true">◎</span>好み</button>
        <button className={activeNav === "brief" ? "active" : ""} onClick={() => navigateTo("brief")}><span aria-hidden="true">↗</span>制作</button>
      </nav>

      {saveOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSaveOpen(false)}>
          <div className="save-modal" role="dialog" aria-modal="true" aria-labelledby="save-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="閉じる" onClick={() => setSaveOpen(false)}>×</button>
            <div className="modal-index">AIに好みを教える · 学習データ {signalCount + 1}</div>
            <h2 id="save-title">気になったものを保存する</h2>
            <p className="modal-lead">保存したものとあなたの反応から、AIが好みを学びます。正確な説明は不要です。</p>
            <form onSubmit={addReference}>
              <label className="field-label" htmlFor="reference-url">URL</label>
              <input id="reference-url" name="url" type="text" inputMode="url" placeholder="https://example.com/reference" autoFocus />
              <fieldset>
                <legend>分野</legend>
                <div className="choice-row compact-choices">
                  {["Web", "Photo", "Graphic"].map((type) => <button type="button" key={type} className={selectedType === type ? "selected" : ""} onClick={() => setSelectedType(type)}>{type}</button>)}
                </div>
              </fieldset>
              <fieldset>
                <legend>これはどんな「好き」？</legend>
                <div className="choice-row">
                  {roles.map((role) => <button type="button" key={role} className={selectedRole === role ? "selected" : ""} onClick={() => setSelectedRole(role)}>{role}</button>)}
                </div>
              </fieldset>
              <label className="field-label" htmlFor="reference-note">ひとこと <span>任意</span></label>
              <input id="reference-note" name="note" type="text" placeholder="例：色よりも、写真と文字の距離感が好き" />
              <button className="modal-submit" type="submit">保存して分析する <span aria-hidden="true">→</span></button>
            </form>
          </div>
        </div>
      )}

      {selectedRecommendation && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedRecommendation(null)}>
          <div className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close modal-close-light" aria-label="閉じる" onClick={() => setSelectedRecommendation(null)}>×</button>
            <div className="detail-art"><Art className={selectedRecommendation.art} /><span className="detail-kind">{selectedRecommendation.kind}</span></div>
            <div className="detail-copy">
              <div className="modal-index">{selectedRecommendation.kicker}</div>
              <h2 id="detail-title">{selectedRecommendation.title}</h2>
              <p className="detail-source">{selectedRecommendation.source}</p>
              {selectedRecommendation.description && <p className="detail-description">{selectedRecommendation.description}</p>}
              <div className="detail-reason"><span>提案理由</span><p>{selectedRecommendation.reason}</p></div>
              <div className="tag-row">{selectedRecommendation.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              {selectedRecommendation.url && <a className="detail-link" href={selectedRecommendation.url} target="_blank" rel="noreferrer">実際に見る <span aria-hidden="true">↗</span></a>}
              <div className="reaction-block"><p>どう感じましたか？</p><div>{["かなり好き", "一部だけ好き", "参考になる", "今は違う"].map((reaction) => <button key={reaction} onClick={() => reactToRecommendation(reaction)}>{reaction}</button>)}</div></div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status"><span aria-hidden="true">✓</span>{toast}</div>}
    </div>
  );
}
