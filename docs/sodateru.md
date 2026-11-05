# 育てる山（夜の作業が上から1つずつ取る）
しょーくんが OK したものだけ。順番は上から（2026-11-04 しょーくんと決めた。連絡板 C-024、claude/sodatsu-spec.md）。

夜のまとめ作業は、推し手帳に進められる night の issue がなく、開いている夜の PR が2つより少ない夜に、いちばん上の「### [ ] 」を1つ issue（題「【夜・山】題」、ラベル night と sodateru）にして進める。PR の中で見出しを「### [x] 題（#issue番号）」に変える。

推し手帳の夜の注意（どの項目にも）：このリポジトリは公開なので、楽天の商品名・値段・URL を issue・PR・コミット・ログに書かない。PR は見本データのテストだけ（楽天から取らない・プレビューなし）。マージのあと update.yml を手で動かし、本当のデータのテストと中身は oshi-techo-data の notes/update.log で確かめる。update.yml と重ねない。ブランチは git checkout -b <名前> origin/main で作る。

## 山
### [x] 買い方メモ：ホロライブ（#61）
- やること：src/kaikata/hololive.json を作り、/hololive/kaikata/ を出す（ファイルを置くだけでページと作品のトップの「選び方」からのリンクができる）。shops・sections（shinsaku・yoyaku・kuji・saihan・miwake のうち確かめられたもの、3つ以上）・events（発表のある予定だけ）・sources
- できあがりの条件：見本データでテストが通り、/hololive/kaikata/ に楽天の商品と広告が出ていない。説明文が125字をこえない（こえたら short を使う）。check-sources の点検が通る（X は gh: false）
- 決まったこと（11/4 しょーくん「ホロライブ＋鬼滅の刃」）：ホロライブは発売日のページが検索で8位台に出ているので先に。11/4 にチャットで開いて確かめたこと（2026年11月）：公式の通販は hololive production OFFICIAL SHOP（https://shop.hololivepro.com/ 。新着・再入荷・二次受注の区分がある）。イベントの会場で受け取る事前注文は holocart（https://cart.hololivepro.com/ 。受付は期間ごと）。実店舗は原宿の hololive production official shop in Harajuku（https://hololive.hololivepro.com/en/news/20260303-01-376/ 。2026年4月24日開店、渋谷区神宮前の OMOKADO、はじめの2日は事前予約制だった）。受注生産の例（https://shop.hololivepro.com/products/sakuramiko_2ndlive_bloomingparade_madetoorder 。受注の期間のあとに順に発送・支払いが決まったあとはキャンセルできない）。公式X は https://twitter.com/hololivetv（ショップだけの X は公式サイトに出ていない）
- 迷ったら：くじ・コンビニやお店のコラボは、公式のお知らせ（hololive.hololivepro.com のニュース）を WebSearch で探して、出ていたものだけを年月つきの例で書く。見つからない節は作らない。タレントごとの誕生日グッズは「〜と発表されていました」の例を1つか2つだけ（全員分を並べない）。「転売」は使わない（「売ったりゆずったり」）
- 読むファイル：docs/shikumi.md の「買い方メモ」、src/kaikata/mofusand.json（形のひな形）、claude/oshi-kaikata-research-2026-10b.md（調べ方）
- マージ：する

### [ ] 買い方メモ：鬼滅の刃
- やること：src/kaikata/kimetsu.json を作り、/kimetsu/kaikata/ を出す。shops・sections（shinsaku・yoyaku・kuji・saihan・miwake のうち確かめられたもの、3つ以上）・events（発表のある予定だけ）・sources
- できあがりの条件：見本データでテストが通り、/kimetsu/kaikata/ に楽天の商品と広告が出ていない。説明文が125字をこえない（こえたら short を使う）。check-sources の点検が通る（X は gh: false）
- 決まったこと（11/4 しょーくん「ホロライブ＋鬼滅の刃」）：11/4 にチャットで開いて確かめたこと（2026年11月）：公式サイトのグッズの案内 https://kimetsu.com/anime/goods/ とライセンス商品の一覧 https://kimetsu.com/anime/goods/license.html（通販へのリンクはない）。アニプレックスの公式の通販 アニプレックス オンライン（旧 ANIPLEX+）の鬼滅の刃の一覧 https://online.aniplex.co.jp/tXxFSojv（フィギュア・「ゆらふわ」・墨絵コレクション・無限城編の劇場のグッズなど）。ufotable Cafe の案内 https://www.ufotable.com/cafe/guide.html（店で売るグッズの一部は ufotable WEBSHOP でも買える）。公式X https://x.com/kimetsu_off（公式サイトに出ている）
- 迷ったら：ufotable WEBSHOP（ufotablewebshop.shop-pro.jp）は 11/4 に開けなかったので、WebSearch の結果から開けたときだけ shops に入れる。開けなければ ufotable Cafe の案内の中で「ufotable WEBSHOP でも」と書くだけにする。映画のグッズは劇場ごと・期間ごとなので、年月つきの例にして「劇場の案内で確かめる」。くじ（一番くじなど）は公式のお知らせで出ていたものだけを例で。「転売」は使わない
- 読むファイル：docs/shikumi.md の「買い方メモ」、src/kaikata/mofusand.json（形のひな形）、claude/oshi-kaikata-research-2026-10b.md（調べ方）
- 順番：前の項目（買い方メモ：ホロライブ）のあと（同じ形なので、ホロライブの PR の書き方に合わせる）
- マージ：する

### [ ] 入荷ビンゴの「先月のまとめ」ページを毎月自動で作る
- やること：入荷ビンゴの記録（data/bingo.json）から、終わった月ごとのまとめのページ /bingo/<年>-<月>/（例 /bingo/2026-10/）を build.mjs で作る。毎月1日 0:07 の更新で、前の月のページが自動でできる。/bingo/ の下のほうに「前の月のまとめ」の行（新しい月から）、推しキャラのページのカードの下の /bingo/ への1行はそのまま
- できあがりの条件：見本データ（test/fixture-bingo.json の10月）で /bingo/2026-10/ ができ、検索に出す設定（index,follow・サイトマップに入る）になっている。本当のデータ（oshi-techo-data の data/bingo.json）で 10月のページを作って中身が合っている。test.mjs に「まとめのページに商品の情報がない」「件数（商品の数）が出ていない」を足して通る
- 決まったこと（11/4 しょーくん）：検索に出す（月ごとに中身が変わる、このサイトにしかない記録）。楽天のデータは使わず、ビンゴの記録（推し・種類・日付）だけで作る。中身は、その月に印が多かった推しの上位10人（作品・推しの名前・印のマスの数・そろった列の数。推しキャラのページへのリンク）、作品ごとの印の多い順（上位10）、種類ごとに印がついた推しの人数、その月にいちばん早くビンゴになった推しと日付。数は文字で出す（マスの数とそろった列はカードと同じなのでよい。商品の件数は出さない）。説明文はその月の数字を入れて全角80〜120字
- 迷ったら：見た目は今ある部品だけ（表と入荷メモのペンの丸の箇条・しましまの見出し）で作り、新しい見た目は足さない。13か月より古い月は data/bingo.json から消えるので、まとめに使う数だけを data/bingo-summary.json（月ごと。推しと作品と種類の数・日付だけ）に残し、ページを消さない。印のある推しが10人より少ない月は noindex,follow にしてサイトマップから外す。今の月のページは作らない
- 読むファイル：docs/shikumi.md の「入荷ビンゴ」、scripts/bingo.mjs、scripts/lib/bingo.mjs、build.mjs の /bingo/ の所
- マージ：する

### [ ] 作品のページから、関係する読みものへつなぐ
- やること：config/yomimono.json の記事に works（関係する作品の slug の配列）を書けるようにし、作品のトップの入荷メモの下に、その作品が works にある読みものを新しい順に3本まで、1本1行（今の linkFrom と同じ <p class="more"> の形）で出す。今ある linkFrom（work・pages・text）はそのまま動くようにする。今の13本のうち、本文にその作品の名前が出てくる記事に works を足す（例：pc-game は本文にある作品。gotouchi-snoopy は linkFrom があるので足さない）。docs/yomimono-neta.md の「書き方」と docs/shikumi.md の「読みもの」に works の書き方を1行足す
- できあがりの条件：見本データで、works のある作品のトップに読みものの行が出て、works のない作品には出ない。test.mjs に1つ足して通る。スマホ 390px の作品のトップで、ほかの部分の見た目が変わっていない
- 決まったこと（11/4 しょーくん OK）：読みものが自動で週2本ふえても、作品のページからたどれるようにするため。行の文は「<作品名>の<記事の題>」のように、記事の題をそのまま使う
- 迷ったら：works に入れるのは、本文にその作品の名前があり、その作品の人に役立つ記事だけ（トレカの収納をすべての作品に付けるような付け方はしない）。1つの作品に3本をこえるときは新しい順
- 読むファイル：docs/shikumi.md の「読みもの」、build.mjs の linkFrom の所（「作品のページから読みものへの1行」）
- マージ：する

### [ ] 読みもの一覧（/yomimono/）をテーマで分ける
- やること：config/yomimono.json の記事に theme を書けるようにし、/yomimono/ をテーマごとの h2（id つき。3つ以上なので目次が出る）に分けて、その中は新しい順に今の yomiList の形で並べる。テーマのない記事は最後の「そのほか」。サイトのトップとゲームのコーナーの読みものの棚は変えない。その時にある記事すべてに theme を書き、docs/yomimono-neta.md の「書き方」に theme の書き方を1行足す
- できあがりの条件：見本データで /yomimono/ にテーマの見出しと目次が出て、記事が全部どこかに入っている。記事のないテーマの見出しは出ない。テストが通る。スマホ 390px とパソコン 1280px で、横にはみ出さない
- 決まったこと（11/4 しょーくん OK）：テーマは5つ、この順。tsukuru「作る・飾る・しまう」／atsumeru「買う・集める・送る」／dekakeru「ライブ・お出かけ」／gotouchi「ご当地」／game「ゲーム」。今の13本は、tsukuru：itabag・kazari・uchiwa・nuikatsu・saidan・toreka-cheki、dekakeru：sougankyou・penlight、gotouchi：gotouchi-snoopy、game：switch2-case・game-katazuke・pc-game・kyuukei。このあとの記事は docs/yomimono-neta.md の山の行の［テーマ］のとおり
- 迷ったら：見出しはしましまのテープ（今の h2 と同じ）。見出しの下に説明や件数の行を重ねない
- 読むファイル：docs/shikumi.md の「読みもの」、build.mjs の yomiList と /yomimono/ の所
- 順番：前の項目（作品のページから関係する読みものへ）のあと（同じ config/yomimono.json と build.mjs をさわるので、前の PR がマージ待ちなら、そのブランチの上に積む）
- マージ：する
