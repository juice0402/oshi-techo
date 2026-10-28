// 作品の一覧をひとつにまとめる。
// - config/characters.json：キャラのコーナーの作品（corner を書いた作品は、そのコーナー）
// - config/corners/<コーナー>.json：コーナーの設定（名前・順番・見た目・集め方・除外語）と、そのコーナーの作品
// Cloudflare の関数でも使うので、node: の部品や process.env を使わない。

export const DEFAULT_CORNER = 'chara';

export function mergeWorks(chars, cornerFiles) {
  const corners = cornerFiles
    .map((f) => {
      const { works: _w, ...meta } = f;
      return { fetch: {}, exclude: [], excludeRe: [], ...meta };
    })
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const bySlug = new Map(corners.map((c) => [c.slug, c]));
  if (!bySlug.has(DEFAULT_CORNER)) {
    const chara = { slug: DEFAULT_CORNER, name: 'キャラ', title: 'キャラグッズ', order: 0, fetch: {}, exclude: [] };
    corners.unshift(chara);
    bySlug.set(DEFAULT_CORNER, chara);
  }
  const withCorner = (w, slug) => {
    const corner = bySlug.get(slug) ?? bySlug.get(DEFAULT_CORNER);
    // 楽天に外してもらう言葉は「中古」と先頭の5語だけなので、本・DVD・ソフトなど件数の多いコーナーの言葉を先に。
    // 作品の言葉を先にしたいとき（ポケモンのカード）は、作品に ngFirst: "work" と書く
    // cornerExclude: false の作品は、コーナーの除外を使わず作品の除外だけ（コーナーを移った作品は、前のコーナーの除外を作品に写してある）
    const useCorner = w.cornerExclude !== false;
    const own = w.exclude ?? [];
    const shared = useCorner ? corner.exclude ?? [] : [];
    const exclude = [...new Set(w.ngFirst === 'work' ? [...own, ...shared] : [...shared, ...own])];
    // 形で外すもの（正規表現。商品名は NFKC・小文字にしてから当てる）
    const excludeRe = [...new Set([...(useCorner ? corner.excludeRe ?? [] : []), ...(w.excludeRe ?? [])])];
    return { ...w, corner: corner.slug, exclude, excludeRe, oshi: w.oshi ?? [] };
  };
  const works = [
    ...chars.map((w) => withCorner(w, w.corner ?? DEFAULT_CORNER)),
    ...cornerFiles.flatMap((f) => (f.works ?? []).map((w) => withCorner(w, f.slug))),
  ];
  // コーナーの順に並べる（同じコーナーの中は書いた順）
  const order = new Map(corners.map((c, i) => [c.slug, i]));
  works.sort((a, b) => order.get(a.corner) - order.get(b.corner));
  return { works, corners };
}

// コーナーごとの集め方（書いていないものは settings の値）。作品に fetch を書くと、その作品だけ上書きできる
// （ポケモンはゲームのコーナーに移ったが、前からあるご当地・季節のページを残すため、キャラのコーナーと同じ集め方にしている）
export function fetchOpts(corner, settings, work = null) {
  const f = { ...(corner?.fetch ?? {}), ...(work?.fetch ?? {}) };
  return {
    pages: f.pages ?? settings.pagesPerKeyword,
    oshiPages: f.oshiPages ?? settings.oshiPages ?? 2,
    gotouchi: f.gotouchi ?? true,
    seasons: f.seasons ?? true,
    books: f.books ?? true,
    booksPages: f.booksPages ?? null, // 楽天ブックスを何ページまで見るか（null は fetch-books.mjs の決まり）
  };
}
