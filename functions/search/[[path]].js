// Cloudflare Pages Functions：/search/?c=キャラ&q=言葉 を受けて、その場で楽天市場に聞いてページを返す。
// 言葉がないときは、静的な /search/ のページをそのまま返す。
// 楽天のキーは Cloudflare の秘密の設定（scripts/pages-secrets.mjs が GitHub の Secrets から入れる）。

import charsRaw from '../../config/characters.json' with { type: 'json' };
import cnChara from '../../config/corners/chara.json' with { type: 'json' };
import cnAnime from '../../config/corners/anime.json' with { type: 'json' };
import cnGame from '../../config/corners/game.json' with { type: 'json' };
import cnIdol from '../../config/corners/idol.json' with { type: 'json' };
import { mergeWorks } from '../../scripts/lib/works.mjs';
// コーナーのファイルを足したら、ここにも足す（scripts/test.mjs が見張る）
const { works: chars, corners } = mergeWorks(charsRaw, [cnChara, cnAnime, cnGame, cnIdol]);
import settings from '../../config/settings.json' with { type: 'json' };
import { readQuery, fetchResults, renderResults, renderPick, fillTemplate, pageTitle } from '../../scripts/lib/search.mjs';
import { searchFormHtml, searchHref } from '../../scripts/lib/view.mjs';
import { cleanKeys } from '../../scripts/lib/rakuten-core.mjs';

const TTL = 3600; // 同じ検索は1時間、Cloudflareにためておく（楽天を何度も呼ばないため）

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!/^\/search\/?$/.test(url.pathname) || !url.searchParams.has('q')) return env.ASSETS.fetch(request);

  const query = readQuery(url, chars);
  if (!query.q) return env.ASSETS.fetch(new URL('/search/', url.origin));
  const key = new Request(new URL(searchHref({ c: query.char?.slug, q: query.q, s: query.s, p: query.p }), url.origin).toString());

  let cache = null;
  try {
    cache = typeof caches !== 'undefined' ? caches.default : null;
  } catch {
    cache = null;
  }
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }

  const tpl = await (await env.ASSETS.fetch(new URL('/search/', url.origin))).text();
  // 言葉に作品名もキャラ名もないときは、楽天に聞かずに、どの作品で探すかを選んでもらう
  if (!query.char) {
    const html = fillTemplate(tpl, { title: pageTitle(query, settings), form: searchFormHtml(chars, { q: query.q }), results: renderPick({ q: query.q, chars, corners }) });
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': `public, max-age=${TTL}`, 'X-Robots-Tag': 'noindex, nofollow' } });
  }
  const result = await fetchResults({ keys: cleanKeys(env), ...query });
  if (!result.ok) console.log(`search error: ${result.error} ${result.detail ?? ''}`);

  const html = fillTemplate(tpl, {
    title: pageTitle(query, settings),
    form: searchFormHtml(chars, { c: query.char.slug, q: query.q }),
    results: renderResults({ ...query, result, settings, nowIso: new Date().toISOString(), chars, corners }),
  });
  const res = new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': result.ok ? `public, max-age=${TTL}` : 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
  if (cache && result.ok) context.waitUntil(cache.put(key, res.clone()));
  return res;
}
