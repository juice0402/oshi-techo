# 地図（どこに何があるか）

コードを直すときは docs/MAP.md → 検索 → その範囲だけ読む → 変わる所だけ直す（claude/code-rules.md）。行の目安が大きくずれたら、この地図も直す。

## ビルド・テスト・公開
- テスト（pr.yml と同じ）：DATA_LATEST=test/fixture-latest.json などの見本データ（env は pr.yml）で `node scripts/build.mjs > /dev/null && node scripts/test.mjs`
- 本番：update.yml が oshi-techo-data から data/ を持ってきて、集める → 作る → テスト → 公開 → 記録を戻す（docs/shikumi.md の「更新（update.yml）」）

## フォルダとファイル
- config/：characters.json（キャラのコーナーの作品・推しキャラ・公式）、corners/（アニメ・ゲーム・アイドルのコーナーと、その作品。docs/shikumi.md の「コーナー（2026-10-26）」）、settings.json（全体）、seasons.json（季節の特集）、topics.json（作品ならではの話題）、yomimono.json（読みものの記事の設定。17本の配列・約3,000行。slug で検索）
- scripts/fetch.mjs：楽天から集めて data/（非公開の記録。更新のときに oshi-techo-data から持ってきて戻す）を更新。fetch-ranking.mjs（ランキング）・fetch-books.mjs（楽天ブックスの発売日）・fetch-yomimono.mjs（読みものの棚）は失敗しても公開を止めない
- scripts/build.mjs：data/ から dist/（公開するページ）を作る。SITE_MODE=production 以外は noindex
- scripts/test.mjs：除外ルールとページの決まり（広告表示・クレジット・バナー・絵文字なし・使わない言葉・使わない形・リンク切れ・サイトマップ・タイトルと説明文の重なり・本番の検索設定）を確かめる
- scripts/lib/ の text・view・rakuten-core・search・filter・classify は Cloudflare の関数でも使うので、node: の部品や process.env を使わない。ほか bingo・books・gotouchi-seen・ics・load-works・rakuten・region・season・util・works・youtube
- functions/：search/（探す。その場で楽天に聞く）、koushiki/（公式の YouTube の新しい動画）、_middleware.js（oshi-techo.pages.dev と www、なくしたページを 301）
- そのほか scripts/：pages-secrets.mjs（楽天・YouTube のキーを Cloudflare の秘密の設定へ）、check-search.mjs（公開後に探すを試す）、indexnow.mjs、cleanup-deployments.mjs（本番以外で3日より古いデプロイを消す）、bingo.mjs・gotouchi-seen.mjs（入荷ビンゴ・ご当地の記録）、dist-hash.mjs（変わったときだけ公開する指紋）、check-connection.mjs、check-sources.mjs（読みもの・買い方メモの資料の点検）、mihari.mjs・merge-ok.mjs（と -test.mjs）、quiet.sh・save-kiroku.sh（出力と記録を非公開へ）
- src/：見た目（base.css・themes/・deco/）、楽天のクレジットとバナー（credit.html・banners/）、icons/・og/・brand/、my.js（わたしの推し・しおり）、bingo.js・bingo-page.js・gotouchi.js、kaikata/<作品>.json（買い方メモ）、yomimono/<slug>.html（記事。図は fig/、絵は img/）、art/（絵）
- workers/cron/：Worker oshi-cron（お昼の更新）
- .github/workflows/：update・pr・og・check-sources・mihari・merge-ok（docs/shikumi.md の「更新（update.yml）」）
- test/fixture-*.json：見本データ

## 大きいファイルの目安（grep -n '^// ----' で節を出す）
- scripts/build.mjs（約2,900行）：コーナー 56／印 132／部品 238（cell・filterGrid・section）／説明文 346／ビンゴ 517／季節 612／ご当地 653／ページの枠 page() 816／入荷メモ 954／読みもの 1110／トップ 1229／コーナーのトップ 1293／キャラごと 1362／推しキャラごと 1513／/bingo/ 1580／季節のページ 1687／ご当地のページ 1870／ランキング 2037／予約帳 2154／推し活カレンダー 2238／発売日カレンダー 2405／探す 2446／公式 2458／読みもののページ 2487／買い方メモ 2556／このサイトについて 2635／つぎに見る 2755／書き出し 2816
- scripts/test.mjs（約1,400行）：1. 除外ルール 26／2. 作ったページ 150（使わない言葉 474・ビンゴ 521・楽天以外へのリンク 654・YouTube 1052・使わない形 1083・リンク 1092）／3. 探す 1225／4. 公式 1301／5. 301 1341／見張り 1365
- config/corners/anime.json・game.json（約1,000行）・characters.json（約700行）：作品の slug で検索

## 自動で作るもの（読まない・手で直さない）
- dist/（ビルドの出力）、data/（楽天の記録。コミットしない）、絵（png・webp・ico）は開かない。src/og.png は src/og/og.html を og.yml で写したもの（src/og/README.md）
