// 古いアドレス（oshi-techo.pages.dev）と www.nyuka-techo.com を、nyuka-techo.com へ 301 で移す。
// ページの場所と ? のあとはそのまま。プレビュー（pr-番号.oshi-techo.pages.dev など）は移さない。
// すべてのページで Cloudflare の関数が動く（無料は1日10万回）。見る人が増えて近づいたら、Cloudflare の Bulk Redirects に切りかえる。

export const CANONICAL_HOST = 'nyuka-techo.com';
export const MOVED_HOSTS = ['oshi-techo.pages.dev', 'www.nyuka-techo.com'];
// なくしたページ：その下のページもまとめて、近いページへ 301（2026-10-27 ファイナルファンタジーを外し、女性向けのコーナーをなくした）
export const MOVED_PATHS = [
  ['/finalfantasy/', '/game/'],
  ['/josei/', '/anime/'],
];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (MOVED_HOSTS.includes(url.hostname)) {
    url.protocol = 'https:';
    url.hostname = CANONICAL_HOST;
    url.port = '';
    return new Response(null, { status: 301, headers: { Location: url.toString(), 'Cache-Control': 'public, max-age=86400' } });
  }
  const p = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  const moved = MOVED_PATHS.find(([from]) => p.startsWith(from));
  if (moved) {
    return new Response(null, { status: 301, headers: { Location: `https://${CANONICAL_HOST}${moved[1]}`, 'Cache-Control': 'public, max-age=86400' } });
  }
  return context.next();
}
