# 推しグッズ入荷手帳（推し手帳）

楽天市場の商品検索APIで推しグッズの新着を集め（キャラ・アニメ・ゲーム・アイドルの4つのコーナー。作品は config/）、静的サイトにして Cloudflare Pages（プロジェクト oshi-techo）へ Direct Upload で公開する。このリポジトリ（juice0402/oshi-techo）は公開。楽天の記録は非公開の juice0402/oshi-techo-data（data/ と、更新のくわしい出力 notes/update.log）に置く（2026-10-28 に引っ越し。前の非公開リポジトリを改名したもので、10/28 までの issue・PR もそこ）。ドメインは nyuka-techo.com（名前に楽天・キャラ名を入れない決まり）。持ち主はコードを書かず、スマホで作業する。説明はやさしい日本語で短く。

## 読むもの

- docs/shikumi.md：機能ごとのくわしい説明。その機能をさわるときに、その節だけ読む
- claude.ai プロジェクト「ネット副業」の資料：claude/oshi-techo-spec.md（設計・PRごとの記録・決めた経緯）、claude/site-principles.md（見た目と文章の原則。見た目・文章を変えるとき）、claude/oshi-techo-keywords.md（Googleの検索候補。ページの名前や新しいページはこれに合わせる）

## しくみ（npmの部品は使わず、Node 22 だけで動く）

- config/：characters.json（キャラのコーナーの作品・推しキャラ・公式）、corners/（アニメ・ゲーム・アイドルのコーナーと、その作品。docs/shikumi.md の「コーナー」）、settings.json（全体）、seasons.json（季節の特集）、topics.json（作品ならではの話題）
- scripts/fetch.mjs：楽天から集めて data/（非公開の記録。更新のときに oshi-techo-data から持ってきて戻す）を更新。fetch-ranking.mjs（ランキング）・fetch-books.mjs（楽天ブックスの発売日）・fetch-yomimono.mjs（読みものの棚）は失敗しても公開を止めない
- scripts/build.mjs：data/ から dist/（公開するページ）を作る。SITE_MODE=production 以外は noindex
- scripts/test.mjs：除外ルールとページの決まり（広告表示・クレジット・バナー・絵文字なし・使わない言葉・使わない形・リンク切れ・サイトマップ・タイトルと説明文の重なり・本番の検索設定）を確かめる
- scripts/lib/ の text・view・rakuten-core・search・filter・classify は Cloudflare の関数でも使うので、node: の部品や process.env を使わない
- functions/：search/（探す。その場で楽天に聞く）、koushiki/（公式の YouTube の新しい動画）、_middleware.js（oshi-techo.pages.dev と www、なくしたページを 301）
- そのほか scripts/：pages-secrets.mjs（楽天・YouTube のキーを Cloudflare の秘密の設定へ）、check-search.mjs（公開後に探すを試す）、indexnow.mjs、cleanup-deployments.mjs（本番以外で3日より古いデプロイを消す）
- src/：見た目（base.css・themes/・deco/）、楽天のクレジットとバナー、icons/・og/・brand/、my.js（わたしの推し・しおり）
- .github/workflows/：update.yml（1日2回、日本時間12:07・19:07。oshi-techo-data から記録を持ってきて、集める・作る・テスト・本番に公開・記録を戻す。出力は scripts/quiet.sh で非公開のメモにだけ書き、公開のログは「済」「失敗」だけ）、pr.yml（見本データでテストだけ。楽天から取らず、プレビューも出さない）、og.yml（SNSの画像を写す。手で動かす）、check-sources.yml（読みものの資料の点検）

## ページ（くわしくは docs/shikumi.md）

- 作品ごと：新着・値下がり・再入荷・予約受付中・カテゴリ・推しキャラ（6件以上）・季節の特集・ご当地・選び方（人気ランキング・大人向け・子ども向け）・予算で選ぶ・話題・発売日カレンダー。作品のトップの下のほうに入荷メモ（このサイトの記録からの事実。docs/shikumi.md の「入荷メモ」）
- 全体：トップ（横にすべらせる棚）・探す・公式（/koushiki/）・誕生日・推し活カレンダー・季節とご当地のまとめ・推し活の読みもの（/yomimono/。調べて書いた記事に図・計算の道具・楽天の棚。docs/shikumi.md の「読みもの」）・作品ごとの買い方メモ（/<作品>/kaikata/。公式のお店と新作・予約・くじ・再販。楽天の商品と広告を出さない。docs/shikumi.md の「買い方メモ」）
- 推しキャラのページに入荷ビンゴ（今月その推しの種類を初めて見つけた日の3×3。記録は scripts/bingo.mjs が data/bingo.json に。docs/shikumi.md の「入荷ビンゴ」）
- ブラウザの中だけの機能（わたしの推し・推し×種類のしおり・並べかえ・しぼりこみ・入荷ビンゴ）は URL を増やさず、サイトや楽天に何も送らない
- 商品が12件より少ない日が7日続いたページは noindex,follow でサイトマップから外す（build.mjs の indexable()）
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

- ブランチ → プルリクエスト → 見本データのテスト → しょーくんに伝えてから main へ反映 → update.yml を手で動かして本番（本当のデータのテストはここ。失敗したら公開しない）→ oshi-techo-data の notes/update.log で結果を確かめる → claude/oshi-techo-spec.md に追記
- 本当のデータで試すときは、oshi-techo-data の data/ をこのリポジトリの data/ に写して使う（.gitignore で入らない）。コミットや issue に商品名を書かない
