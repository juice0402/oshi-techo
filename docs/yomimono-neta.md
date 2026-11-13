# 読みもののネタの山と書き方

予約タスク「読みもの書き（4サイト）」が、推し手帳の曜日（月・金）に、下の山の上から1本ずつ書く（連絡板 C-024、claude/sodatsu-spec.md）。このファイルと CLAUDE.md、docs/shikumi.md の「読みもの」の節だけで1本書けるようにしてある。

## 書き方

### 置く場所と作り方
- 1本でさわるファイル：config/yomimono.json（最後に1件）・src/yomimono/<slug>.html（本文）・src/yomimono/tools/<slug>-<名前>.html（計算の道具）・src/yomimono/fig/<slug>-<名前>.html（図。要るときだけ）・src/yomimono/sources/<slug>.json（資料）・src/yomimono/img/<slug>.webp と <slug>-og.jpg（絵）
- config/yomimono.json の1件：slug（ローマ字）・title・seoTitle（検索の問いの形。例「〜はどこで売ってる？〜」）・summary（一覧の1行。全角22字まで）・description（その記事だけの具体を入れて全角80〜120字）・published と updated（書いた日）・hero（slug）・heroAlt（絵に描いてあるもの）・shelves（棚3〜5）・sources（slug）。ゲームの記事は corner: "game"。1つの作品だけの記事は linkFrom（work・pages・text。gotouchi-snoopy が例）。本文に作品の名前が出てきて、その作品の人に役立つ記事は works（作品の slug の配列。pc-game が例）を書くと、作品のトップに1行出る（全部の作品に付けない）。ファイルは Python の json.dumps(indent=2, ensure_ascii=False)＋改行で書く
- cats：そのカテゴリのグッズの扱い方が本文に出てくる記事だけ、カテゴリの slug と季節の slug の配列（nuikatsu は ["nuigurumi"]）。そのカテゴリ・季節の一覧の「つぎに見る」に出る
- theme：山の行の［テーマ］を書く（tsukuru 作る・飾る・しまう／atsumeru 買う・集める・送る／dekakeru ライブ・お出かけ／gotouchi ご当地／game ゲーム のどれか1つ）。/yomimono/ の一覧はこのテーマの見出しで分かれ、書かないと最後の「そのほか」に入る
- 本文：h2 に id を書く（3つ以上で目次ができる）。<!--tool:名前-->・<!--fig:名前-->・<!--shelf:棚のid--> を置いた所に、道具・図・楽天の棚が入る。ひな形は近い記事をまねる（数を入れて答えを出す道具は kyuukei・penlight、チェックの地図は gotouchi-snoopy、大きさが入るかは switch2-case・game-katazuke）
- 計算の道具：1本に1つ以上。ブラウザの中だけで計算し、どこにも送らず何も残さない（テストが見張る。残してよいのは gotouchi-snoopy のチェックだけ）。範囲の外・空・整数でない数字では計算せず、直してほしいことを1行で出す。答えはめやすと書き、式の出どころ（メーカーの解説など）を本文に書く
- 図：SVG で描き、字は図の外の HTML に書く（テスト）。色はテーマの色（.fg-p・.fg-l・.fg-s など）。人を描くときは顔のない線の形
- 資料：src/yomimono/sources/<slug>.json に checked（確かめた日）と items（name・url・used＝何を確かめたか）。/yomimono/<slug>/shiryou/ に自動で一覧が出る。GitHub から断られる資料は gh: false
- 棚：keyword・match（商品名にある言葉）・exclude（いつもの中古・ジャンク・訳あり・アダルト・大人向け・大人のおもちゃ・名入れ・オーダーに、記事に合わせて足す）・head・excludeRe（キャラの名前をよける。kyuukei が例）。商品のページはキャラのグッズだけなので、道具や材料はここで出す。火を使うもの・医療や効きめをうたうもの・中古PC・PC本体・ガスの缶は出さない
- テスト：DATA_LATEST=test/fixture-latest.json DATA_META=test/fixture-meta.json DATA_BOOKS=test/fixture-books.json DATA_RANKING=test/fixture-ranking.json を付けて node scripts/build.mjs > /dev/null && node scripts/test.mjs（SITE_MODE=production でも一度）。見本データには楽天の棚がないので、棚の中身は公開のあとに見る
- ブランチは git checkout -b <名前> origin/main で作る。このリポジトリは公開なので、楽天の商品名・値段・URL をコミット・PR・issue・ログに書かない

### 中身
- だれの：推し活をしている人の「〜はどうする？」「〜は何がいる？」に答える。答えの数字を道具で出せるようにする
- 長さ：本文は全角2,500字くらいから（今の13本は3,000〜5,000字）。1画面めは問いへの答えを短く、その下に表・図・道具・例
- 調べて確かめたことだけ書く。公式・メーカー・公的な機関・業界の団体のページだけを資料にし、ブログ・まとめ・くらべのサイトは使わない。本文に資料の名前は書かず「メーカーの案内では」「日本郵便の案内では」のように書く
- 体験談は書かない（作り話をしない）。1つの例から言い切らない。例には年月を書く（「2026年11月の案内」）。資料で分かれることは両方書く。公演や会場の決まりは例にして「公演の案内で確かめる」と書く
- 発売前の告知は「〜と発表されていました（◯月◯日の発表）」。値段や料金は確かめた月を書く
- 病気・治療・効きめ・子どもの遊ぶ時間は書かない。お金がもうかる・必ずそろう、のような書き方をしない（確率の道具は「めやす」）
- 使わない言葉：「〜しましょう」「ぜひ」「便利」「簡単」「安心」「おすすめ」「ポイント」「ワンポイント」「コツ」「転売」（「売ったりゆずったり」）、3つ並べの言い回し、「まず・さらに・また」の連続、ダッシュ、絵文字。キャッチコピーにしない。太字と箇条書きを多用しない。かっこは1文に1つまで。サイトの文に「腐女子」は使わない
- 最後に、関係する作品のページやほかの読みものへ1〜2行でつなぐ（サイトの中のリンクだけ。楽天の棚があるページなので、外へのリンクは資料のページだけ）

### 絵
- 1本に1枚。Canva の AI で切り絵ふう（キャラ・字・ロゴ・顔なし）。作り方は docs/shikumi.md の「読みもの」の絵（generate-image の prompt の形・土台 DAHZGSoqXEo をコピー・2000×1000 で書き出し・webp 1200×600 と og 1200×630）
- 生成は1回に1枚。合わないときだけもう1回（3分あける）。Canva が待ち時間になったら、絵のほかを PR にして「とちゅう（絵だけ次の回）」。仮の絵では公開しない

### 公開
- 自分で squash マージしたあと、update.yml を workflow_dispatch で動かす（push では動かない）。動いている「更新」があれば終わってから（gh api "repos/juice0402/oshi-techo/actions/runs?per_page=3" で見る。重ねない）
- 公開の結果は、各ステップの成功と、oshi-techo-data の notes/update.log の「すべてOK」「Deployment complete」「読みものの棚」で見る。新しい棚に関係のうすい物がまざっていたら、報告ファイルに書いて次の回で exclude を足す
- 報告ファイル claude/reports/oshi.md に「- 読みもの『題』：公開（PR #◯）」。下の山の行を「- [x] 題（PR #◯・日付）」にするのは同じ PR で

### ネタの選び方（山が5本を切ったとき、予約タスクが10本足す）
- 選んでよい：推し活の段取り・道具・飾り方・しまい方・出かけ方・ご当地・ゲームまわりで、計算の道具が作れて、公式やメーカー・公的な資料で確かめられるもの。検索のデータ（claude/search-data-oshi.md）で人が来ている言葉に近いもの
- だめ：作品の発売の告知だけの記事・会社や商品の順位くらべ・体験談がいるもの・病気や効きめ・もうけ話・大人向け・今ある記事と中身が重なるもの（/yomimono/ の一覧と src/yomimono/ を見る）・地域ごとのうすいページの量産（ご当地は作品ごとに1本まで）
- 季節のネタ（冬・クリスマス・バレンタインなど）は、その季節の2か月前から1か月前までに書ける位置へ。過ぎたら山の下へ回す
- ネタの行には、使う資料の URL を書く（夜も開けるように）。予約タスクは、ネタの行の URL と WebSearch の結果の URL だけを開き、開けないネタは飛ばして山の下へ回す
- 足したネタが合わないときは、推し手帳のチャットで直す

## ネタの山
書いたら「- [x] 題（PR #◯・日付）」。行の形：題［テーマ］— だれの何に答えるか・道具／資料
- [x] 推し活手帳の作り方（2027年の手帳）（PR #66・2026-11-06）
- [x] 冬のライブ・イベントの寒さ対策（PR #73・2026-11-09）
- [x] ライブ遠征の予算と荷物の大きさ（PR #PRNUM・2026-11-13）
- [ ] モバイルバッテリーの選び方［dekakeru］— ライブやイベントの日にスマホの電池が足りるか。道具：バッテリーの容量（mAh）とスマホの電池の容量から、充電できる回数のめやすと Wh／資料：https://www.mlit.go.jp/report/press/kouku10_hh_000310.html（2026年4月24日からの機内の決まり。持ちこみ2個まで・160Wh以下・機内で充電しない）・https://www.mlit.go.jp/report/press/content/001984061.pdf（Wh の式 mAh×V÷1,000）・https://www.nite.go.jp/jiko/chuikanki/press/2026fy/prs260715.html（事故の注意）・https://www.elecom.co.jp/pickup/mobile_battery/（充電回数は容量の約6割の考え方）・https://www.ankerjapan.com/blogs/magazine/how-to-choose-battery（電圧の変換で減る）
- [ ] ランダムグッズ・くじ・受注生産の言葉［atsumeru］— 「ランダム」「ブラインド」「くじ」「受注生産」「二次受注」の買い方のちがい。道具：全何種のランダムを何個買うと、推しが1つは出る見こみ（1−(1−1/種類)^個数。どれも同じ数だけ入っているとしたときのめやす）／資料：https://1kuji.com/guide（一番くじの公式の説明。ラストワン賞・ダブルチャンス）・https://www.caa.go.jp/policies/policy/representation/fair_labeling/premium_regulation/（景品の決まり）・https://shop.hololivepro.com/products/sakuramiko_2ndlive_bloomingparade_madetoorder（受注生産の公式の案内の例。期間のあとに順に発送・確定後はキャンセルできない）。「必ず出る」と書かない
- [ ] ガチャ（カプセルトイ）のそろえ方［atsumeru］— 推しのガチャを全種そろえたい人に。道具：全何種かから、全種そろうまでに回す回数のめやす（種類×(1+1/2+…+1/種類)。どれも同じ数だけ入っているとしたとき）と、そのときの金額／資料：https://gashapon.jp/（バンダイのガシャポン公式。値段の幅・売り場の探し方）・https://www.bandai.co.jp/press/2026/261008.php（市場の大きさと毎月の数。ページの中で海外の年が食いちがうので、その所は使わない）。棚：カプセルトイを飾るケース・ミニフィギュアのケース
- [ ] アクキー・缶バッジの金具の付けかえ（丸カン・チェーン）［tsukuru］— アクキーの金具をボールチェーンやナスカンに替えたい人に。道具：丸カンの線の太さと外径から内径を出し、アクキーの穴に通るか／資料：https://www.yuzawaya.shop/shopdetail/000000014379/（丸カンのサイズの書き方。線径0.8mm・外径4mm の例）。開け閉めのしかた（前後にずらして開ける）は手芸店やパーツのメーカーの解説を WebSearch で探し、公式のものだけ。棚：丸カン・ボールチェーン・ナスカン・平ヤットコ（このサイトで初めて売れた物が丸カンとチェーン）
- [ ] ご当地キティの買える場所と集め方［gotouchi］— ご当地キティはどこで売ってる？に答える。都道府県ごとに、公式のお知らせで確かめた売り場だけ。道具：47都道府県のチェック（gotouchi-snoopy の道具と同じ形。localStorage の名前は別にして、プライバシーポリシーに1行）／資料：https://www.sanrio.co.jp/news/goods/kt-gotouchi-fukuoka-20260227/（サンリオ公式。福岡の限定の根付と売り場の例）・サンリオのニュースの「ご当地」を WebSearch で探す。作っている会社は公式の一次の資料がないので書かない。linkFrom は sanrio の gotouchi・kaikata・top
- [ ] ご当地ちいかわの買える場所［gotouchi］— ご当地ちいかわはどこで売ってる？に答える。公式の売り場の案内が少ないので、ちいかわマーケットのご当地のシリーズ（東京のおみやげ・池袋・原宿・静岡など）を中心に、確かめられた所だけ。道具：チェック／資料：https://chiikawamarket.jp/（公式の通販。ご当地のシリーズ）・https://chiikawa-info.jp/p21/tenpo/（取扱い店舗。GitHub やこの作業場所から開けないことがある）。確かめられた売り場が5つより少なければ書かずに山の下へ。linkFrom は chiikawa の gotouchi・kaikata・top
- [ ] ポスター・タペストリーを壁に穴をあけずに飾る［tsukuru］— 賃貸の部屋で推しのポスターを飾りたい人に。道具：壁の幅と高さ・ポスターの判（A・B判）・あいだから、何枚並ぶか／資料：https://www.mlit.go.jp/common/001016469.pdf（国土交通省の原状回復のガイドライン。画びょうの穴とポスターの跡・くぎ穴の扱い）・https://www.3mcompany.jp/3M/ja_JP/p/d/v100730077/（はがせるフックの耐荷重と付けられない壁）・https://www.ricoh.co.jp/-/Media/Ricoh/Sites/co_jp/pps/download/pdf/1664usersguide_03.pdf（A3〜B5 の寸法。A2・B2 などは JIS の表を WebSearch で探す）。棚：ポスターフレーム・タペストリー棒・はがせるフック。契約ごとに決まりがちがうので「契約書で確かめる」と書く
- [ ] グッズの送り方（交換・お譲り）［atsumeru］— 推し仲間とグッズを交換したり、ゆずったりするときの送り方。道具：大きさ（長辺・3辺の合計・厚さ）と重さから、送れる方法と料金の候補／資料：https://www.post.japanpost.jp/service/send/domestic/list/（日本郵便のくらべの表。ゆうパケット・クリックポストの大きさと重さ）・https://clickpost.jp/（クリックポストの料金。2026年10月1日から240円）・https://www.post.japanpost.jp/service/send/domestic/delivery/e-shipping/yu-packetpost.html（ゆうパケットポスト）・https://www.post.japanpost.jp/service/send/domestic/mail/letter/（定形外の料金）。料金は確かめた月を書く。「転売」は使わない。棚：OPP袋・プチプチの封筒・梱包の箱
- [ ] ファンレターの書き方と送り方［atsumeru］— 推しにファンレターを送りたい人に。道具：封筒の大きさと重さから、定形か定形外かと切手の料金／資料：https://www.post.japanpost.jp/service/send/domestic/mail/letter/（定形の大きさ・50gまで110円）・https://www.horipro.co.jp/wp-content/uploads/2026/04/letter.pdf（事務所の受け取れない物の例）・https://faq.shueisha.co.jp/faq/show/20?category_id=2&site_domain=default（出版社の案内の例）。宛先は書かず「事務所や出版社の案内で確かめる」と書く。返事が来るとは書かない。棚：レターセット・封筒・シール
- [ ] フラスタ（フラワースタンド）を連名で贈る［atsumeru］— 公演にお花を出したい人の段取り。道具：お花の代金・送料・人数から1人分と、集めるときの端数／資料：https://idolmaster-official.jp/news/01_16962（受け付ける公演の大きさの決まりの例。高さ180cm・底40×40cm）・https://www.ktv.jp/resource/event/yureyoka/pdf/info.pdf（回収つきの花屋だけの例）・https://setagaya-pt.jp/news/31338/（受け付けない会場の例）。公演ごとにちがうので3つの例（年つき）にして「公演の案内で確かめる」。お花の値段の例は作らない（入れる形にする）
- [ ] ぬい撮り・アクスタ撮りの撮り方［tsukuru］— 小さなぬいやアクスタをスマホできれいに撮りたい人に。道具：撮る物の大きさとスマホからの距離から、背景の布や紙がどれくらいいるか（画角はメーカーの数字だけ。なければ入れる形）／資料：https://personal.canon.jp/articles/tips/flashguide/objects（カメラのメーカーの物撮りの解説。光のやわらげ方・白い紙）・https://support.apple.com/en-us/125089（スマホのカメラの焦点距離の例）・https://www.tnm.jp/modules/r_free_page/index.php?id=127（撮影の決まりがある施設の例）。棚：撮影用の背景布・スマホの三脚・小さなライト
- [ ] 推しの写真のプリント（L判・2L・ましかく）［tsukuru］— 推しの写真やぬい撮りを印刷してアルバムに貼りたい人に。道具：プリントの判とアルバムの台紙の大きさから、1ページに何枚入るかと料金のめやす／資料：https://pg-sj-ja.fujifilm.com/price.html（写真の判の寸法と料金）・https://www.sej.co.jp/services/multicopy/print.html（コンビニのプリントの料金とましかく）・https://www.fujifilm.com/fb/ja/solutions/wide-variety/multicopy/howto-multicopy。ましかくの寸法は公式の数字が見つかったときだけ書く。棚：フォトアルバム・ポケットアルバム・写真の保護スリーブ
- [ ] ぬいの服を作る（型紙のとり方と大きさ合わせ）［tsukuru］— ぬいの服を自分で作りたい人に。道具：ぬいを測った数字と型紙の数字から、型紙を何%に拡大・縮小するか（コピー機の倍率の形）／資料：https://www.brother.co.jp/product/hsm/magazine/kiji226/（ミシンのメーカーの、ぬいの服の型のとり方）・https://www.yuzawaya.shop/html/page188.html（手芸店のぬい服の作り方の一覧）。倍率の式は「測った数字÷型紙の数字」で、縫いしろは倍率をかけないことをメーカーの解説で確かめてから書く（確かめられなければ書かない）。nuikatsu の記事と重ねず、作り方だけ。棚：ぬい服の型紙・布・手芸用のはさみ
- [ ] グッズを日焼け・湿気・ほこりから守る［tsukuru］— 集めたグッズを長く飾ったりしまったりしたい人に。道具：ケースの大きさ（縦・横・奥行）から容積と、乾燥剤がいくつ要るか（メーカーの「1Lまでに1個」の形）／資料：https://www.bunka.go.jp/seisaku/bijutsukan_hakubutsukan/shoninshisetsu/pdf/94247401_01.pdf（文化庁。展示のケースの温度・湿度・明るさのめやす）・https://www.tobunken.go.jp/ccr/pdf/50/5001.pdf（東京文化財研究所）・https://products.st-c.co.jp/detail/409/（乾燥剤のメーカーの量と交換）。博物館のめやすは「家での決まりではない」と書く。kazari の記事と重ねない。棚：UVカットのコレクションケース・乾燥剤・アクリルのほこりよけ
- [ ] 推し活の予算の立て方と記録［atsumeru］— 推し活のお金を月ごとに決めて記録したい人に。道具：月の推し活の予算と、買った物・行く予定の合計から、残りと来月にまわる分／資料：https://www.shiruporuto.jp/public/document/container/kakeibo_kotsu/（家計簿を続ける考え方）・https://www.shiruporuto.jp/public/document/container/hitori_kurashi/hitori_kurashi_003.html（固定費と変動費）。お金をふやす話・借りる話は書かない。棚：家計簿のノート・推し活用のノート
- [ ] 【ゲーム】Switch 2 の microSD Express の選び方［game］— Switch 2 の保存の容量が足りるか、どのカードが使えるか。道具：本体の256GBと、遊ぶソフトの容量（入れる形。例の数字は公式の表から）から、カードが何GBいるか／資料：https://www.nintendo.com/jp/games/microsd-express/index.html（使えるのは microSD Express だけ・2TB まで）・https://www.nintendo.com/jp/hardware/switch2/index.html（本体256GB）・https://www.nintendo.com/jp/games/howtodl/index.html（ソフトの容量の例。2026年5月時点）・https://support.nintendo.com/jp/switch2/mastery/data/free/index.html（空き容量の確かめ方・移し方）。corner: "game"。棚：microSD Express カード（ふつうの microSD は「Switch 2 では使えない」の商品だけ外す excludeRe）
- [ ] 【ゲーム】ゲーム用のモニター・テレビの大きさと見る距離［game］— 推しのゲームを遊ぶ画面の大きさと置き場所。道具：画面の大きさ（型）と解像度から、画面の高さと見る距離のめやす（メーカーの「高さの約1.5倍・約3倍」）／資料：https://cs.sharp.co.jp/faq/qa?qid=113171（型ごとの画面の高さと見る距離）・https://support.sony.jp/electronics/support/articles/S1110278023320（見る距離のめやす）・https://www.mhlw.go.jp/content/000580827.pdf（机で見るときの40cm以上）。kyuukei の記事と重ねず、画面の大きさと距離だけ。corner: "game"。棚：モニターアーム・テレビ台・モニター
