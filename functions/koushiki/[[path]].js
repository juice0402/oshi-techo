// Cloudflare Pages Functions：/koushiki/（公式の最新情報）を開いたときに、
// その場で YouTube Data API から公式チャンネルの新しい動画を取ってきて、静的なページに入れて返す。
// 動画の情報はどこにも保存しない（Cloudflare に1時間だけためる。YouTube API サービスの決まり III.E.4）。
// YouTube のキーは Cloudflare の秘密の設定（scripts/pages-secrets.mjs が GitHub の Secrets から入れる）。

import charsRaw from '../../config/characters.json' with { type: 'json' };
import cnChara from '../../config/corners/chara.json' with { type: 'json' };
import cnAnime from '../../config/corners/anime.json' with { type: 'json' };
import cnGame from '../../config/corners/game.json' with { type: 'json' };
import cnIdol from '../../config/corners/idol.json' with { type: 'json' };
import { mergeWorks } from '../../scripts/lib/works.mjs';
// コーナーのファイルを足したら、ここにも足す（scripts/test.mjs が見張る）
const { works: chars, corners } = mergeWorks(charsRaw, [cnChara, cnAnime, cnGame, cnIdol]);
import { fetchAllVideos, fillVideos } from '../../scripts/lib/youtube.mjs';

const TTL = 3600;

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!/^\/koushiki\/?$/.test(url.pathname)) return env.ASSETS.fetch(request);

  const key = new Request(new URL('/koushiki/', url.origin).toString());
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

  const tpl = await (await env.ASSETS.fetch(new URL('/koushiki/', url.origin))).text();
  const apiKey = String(env.YOUTUBE_API_KEY ?? '').trim();
  let bySlug = new Map();
  if (apiKey) {
    const r = await fetchAllVideos(chars, apiKey);
    bySlug = r.bySlug;
    if (r.errors.length) console.log(`youtube error: ${r.errors.join(' / ')}`);
  } else {
    console.log('youtube error: no key');
  }
  const ok = bySlug.size > 0;
  const html = fillVideos(tpl, bySlug);
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': ok ? `public, max-age=${TTL}` : 'no-store' };
  const res = new Response(html, { headers });
  if (cache && ok) context.waitUntil(cache.put(key, res.clone()));
  return res;
}
