# 推しグッズ入荷手帳（推し手帳）

コードを直すときは docs/MAP.md → 検索 → その範囲だけ読む → 変わる所だけ直す（claude/code-rules.md）

楽天市場の商品検索APIで推しグッズの新着を集め（キャラ・アニメ・ゲーム・アイドルの4つのコーナー。作品は config/）、静的サイトにして Cloudflare Pages（プロジェクト oshi-techo）へ Direct Upload で公開する。このリポジトリ（juice0402/oshi-techo）は公開。楽天の記録は非公開の juice0402/oshi-techo-data（data/ と、更新のくわしい出力 notes/update.log）に置く。ドメインは nyuka-techo.com（名前に楽天・キャラ名を入れない決まり）。持ち主はコードを書かず、スマホで作業する。説明はやさしい日本語で短く。終わった経緯は docs/claude-old.md（ふだんは読まない）。

## 読むもの

- docs/MAP.md：フォルダとファイルの地図・大きいファイルの行の目安・自動で作るファイル
- docs/shikumi.md：機能ごとのくわしい説明。その機能をさわるときに、その節だけ読む
- docs/yomimono-neta.md：読みもののネタの山と書き方（予約タスク「読みもの書き」が上から1本ずつ書く）。docs/sodateru.md：育てる山（夜の作業が上から1つずつ取る）
- claude.ai プロジェクト「ネット副業」の資料：claude/oshi-techo-spec.md（設計・PRごとの記録・決めた経緯）、claude/site-principles.md（見た目と文章の原則。見た目・文章を変えるとき）、claude/oshi-techo-keywords.md（Googleの検索候補。ページの名前や新しいページはこれに合わせる）

## しくみ（npmの部品は使わず、Node 22 だけで動く）

- 作り：config/（作品・設定）→ scripts/fetch.mjs など（楽天から集めて data/）→ scripts/build.mjs（dist/ を作る。SITE_MODE=production 以外は noindex）→ scripts/test.mjs（決まりの点検）。ファイルごとの役目は docs/MAP.md
- fetch-ranking.mjs・fetch-books.mjs・fetch-yomimono.mjs は失敗しても公開を止めない
- scripts/lib/ の text・view・rakuten-core・search・filter・classify は Cloudflare の関数でも使うので、node: の部品や process.env を使わない
- .github/workflows/update.yml：1日2回（12:07・19:07）と毎月1日の0:07の更新。お昼の回は Worker oshi-cron が動かす。oshi-techo-data から記録を持ってきて、集める・作る・テスト・本番に公開・記録を戻す。出力は scripts/quiet.sh で非公開のメモにだけ書き、公開のログは「済」「失敗」だけ。くわしくは docs/shikumi.md の「更新（update.yml）」と「お昼の更新（Worker oshi-cron・2026-11-11）」
- pr.yml は見本データでテストだけ（楽天から取らず、プレビューも出さない）。ほかの workflow（og・check-sources・mihari・merge-ok）は docs/MAP.md と docs/shikumi.md の「見張り（2026-11-02）」「マージの印（merge-ok.yml）」

## ページ（くわしくは docs/shikumi.md）

- 作品ごと・全体のページの一覧は docs/shikumi.md の「ページの一覧」。入荷ビンゴは同じく「入荷ビンゴ（2026-10-30）」
- 買い方メモ（/<作品>/kaikata/）には楽天の商品と広告を出さない
- ブラウザの中だけの機能（わたしの推し・推し×種類のしおり・並べかえ・しぼりこみ・入荷ビンゴ）は URL を増やさず、サイトや楽天に何も送らない
- 商品の一覧で検索に出すのは、コーナーのトップ・ご当地・福袋・発売日カレンダーだけ（build.mjs の SEARCH_LISTS）。ほかの一覧はページはそのままで noindex,follow・サイトマップに入れない。検索に出す一覧も、商品が12件より少ない日が7日続いたら同じく外す（indexable()）。くわしくは docs/shikumi.md の「商品が少ないページ」
- キャラや推しキャラを足すときは characters.json（docs/shikumi.md の「推しキャラ」「キャラを足すとき」）。SNS の画像（src/og.png）は作品名7つ＋「などのグッズ」なので、外した作品が入っていたときだけ作り直す

## 守ること

楽天
- このリポジトリは公開。楽天APIで取ったデータ（data/・商品名・値段・URL など）は、このリポジトリのファイル・コミット・issue・PR・Actions のログに書かない。記録とくわしい出力は非公開の oshi-techo-data だけ。サイトの外にファイルとして置かない
- 楽天APIは新方式（applicationId＋accessKey、Referer: https://nyuka-techo.com/）。1.1秒以上あけて呼ぶ。楽天のアプリの「許可されたWebサイト」と楽天アフィリエイトのサイト登録は nyuka-techo.com と oshi-techo.pages.dev の両方
- 楽天のクレジットとバナーのHTMLは1文字も変えない
- 楽天の商品を出すページには、楽天以外へのリンクを置かない（第8条4項）。公式サイト・公式X・YouTube へのリンクは商品を出さない /koushiki/ だけ
- 「定価」「◯%オフ」「最安値」は使わない。値下がりは自分で確認した事実だけ。カードの印は本当のことだけ（在庫は取れないので「残りわずか」は出さない。根拠のない「今だけ」「大人気」も出さない）
- 商品画像はAPIのURLのまま表示し、保存・加工しない
- 「広告　楽天アフィリエイトを利用しています」はページの一番下。楽天の商品提供などの企画に参加したら、最初の画面に戻す

YouTube（/koushiki/）
- 動画の情報はリポジトリ・data/・ページのファイル・ログに残さない。search.list は使わない
- /koushiki/ には楽天の広告（バナー・広告の表示・クレジット）を出さない。公式の YouTube ロゴ（src/brand/youtube-logo.svg）は1バイトも変えない

301
- functions/_middleware.js の転送はずっと残す。関数が無料の1日10万回に近づいたら Cloudflare の Bulk Redirects に切りかえる

見た目と文章
- 案A「しましま表紙の手帳」（src/themes/a-techo.css）。しましまはヘッダーと見出しのテープだけ、中は白い紙。絵文字なし・Web フォントなし。ロゴはラベルに入れたサイト名の画像（アイコンなし）。ファビコンはベリー色の四角に白い「推」
- ボタンは「ペンで書いたリスト」（ベリー色の点線の下線の文字。えらんだものはペンの丸。しぼりこみは手帳のチェック欄）。左はしの色の帯・丸いバッジ・えらんだものだけ色をぬる切りかえ・ずらした付箋は使わない（テストで見張る）
- 見出しはしましまのテープ。見出しの下に説明や件数の行を重ねない。件数はページの中に出さない（説明文だけ「7日で見つけた」のように、全部の数と思われない書き方で）
- 「◯時◯分時点の価格」はページのいちばん下に1行だけ
- 見た目を変えるときは2案を本物の画面で並べて1枚にくらべて、しょーくんが選ぶ

## 進め方

- ブランチ → プルリクエスト → 見本データのテスト → しょーくんに伝えてから main へ反映 → update.yml を手で動かして本番（merge-ok でマージしたときは GitHub が動かす）（本当のデータのテストはここ。失敗したら公開しない）→ oshi-techo-data の notes/update.log で結果を確かめる → claude/oshi-techo-spec.md に追記
- 本当のデータで試すときは、oshi-techo-data の data/ をこのリポジトリの data/ に写して使う（.gitignore で入らない）。コミットや issue に商品名を書かない
- テストは pr.yml と同じ（見本データの env をつけて node scripts/build.mjs > /dev/null && node scripts/test.mjs。docs/MAP.md の「ビルド・テスト・公開」）

## マージの印（merge-ok.yml）

- しょーくんの「マージして」のあと、司令塔が PR にラベル merge-ok を付ける → merge-ok.yml（scripts/merge-ok.mjs）が点検の合格を待って squash でマージし、更新（update.yml）を main で1回動かす。merge-ok の無い PR はさわらない
- 本文の「#数字 のあとにマージ」の PR が開いているあいだは待つ。点検の失敗・main とのぶつかりは、PR にコメントして merge-blocked（司令塔が見る）
- 点検の workflow の name を変えたら merge-ok.yml の workflows: も（scripts/merge-ok-test.mjs が見る）。くわしくは docs/shikumi.md の「マージの印（merge-ok.yml）」
