// 公式のYouTubeチャンネルの新しい動画（YouTube Data API）。
// 公式の最新情報のページ（/koushiki/）を開いたときに Cloudflare の関数がその場で取ってきて、ページに入れる。
// 取った情報はリポジトリにもページのファイルにも保存しない（YouTube API サービスの決まり III.E.4）。
// Cloudflare の関数でも使うので、node: の部品や process.env は使わない。

import { esc, jstMonthDay } from './text.mjs';

export const VIDEOS_PER_CHAR = 6;
const API = 'https://www.googleapis.com/youtube/v3';

// ロゴを押したときに行く、公式チャンネルのページ
export function channelUrl(ch) {
  if (ch.channelId) return `https://www.youtube.com/channel/${ch.channelId}`;
  if (ch.forHandle) return `https://www.youtube.com/@${String(ch.forHandle).replace(/^@/, '')}`;
  if (ch.forUsername) return `https://www.youtube.com/user/${ch.forUsername}`;
  return 'https://www.youtube.com/';
}

// 1つのチャンネルの新しい動画。channelId があれば playlistItems.list を1回、
// 古いユーザー名（forUsername）やハンドル（forHandle）なら channels.list でアップロードの再生リストを調べてから（2回）
export async function fetchChannelVideos(ch, key, fetchImpl = globalThis.fetch) {
  let playlistId = ch.channelId ? `UU${ch.channelId.slice(2)}` : '';
  if (!playlistId) {
    const q = new URLSearchParams({ part: 'contentDetails', key });
    if (ch.forUsername) q.set('forUsername', ch.forUsername);
    if (ch.forHandle) q.set('forHandle', ch.forHandle);
    const r = await fetchImpl(`${API}/channels?${q}`);
    const j = await r.json().catch(() => null);
    playlistId = j?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? '';
    if (!playlistId) throw new Error(`${ch.name}: channel not found (HTTP ${r.status})`);
  }
  const params = new URLSearchParams({ part: 'snippet,contentDetails,status', maxResults: '8', playlistId, key });
  const res = await fetchImpl(`${API}/playlistItems?${params}`);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${ch.name}: HTTP ${res.status} ${json?.error?.message ?? ''}`.slice(0, 200));
  const out = [];
  for (const it of json?.items ?? []) {
    if (it.status?.privacyStatus && it.status.privacyStatus !== 'public') continue;
    const sn = it.snippet ?? {};
    const id = it.contentDetails?.videoId;
    const thumb = sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url;
    if (!id || !thumb || !sn.title) continue;
    out.push({ id, title: String(sn.title), published: it.contentDetails?.videoPublishedAt ?? sn.publishedAt ?? '', thumb });
    if (out.length >= VIDEOS_PER_CHAR) break;
  }
  return out;
}

// 作品ごとに、チャンネルと動画。うまくいかなかったチャンネルは入れない（ページはそのまま出す）
export async function fetchAllVideos(chars, key, fetchImpl = globalThis.fetch) {
  const bySlug = new Map();
  const errors = [];
  for (const c of chars) {
    for (const ch of c.youtube ?? []) {
      try {
        const videos = await fetchChannelVideos(ch, key, fetchImpl);
        if (videos.length) bySlug.set(c.slug, [...(bySlug.get(c.slug) ?? []), { ch, videos }]);
      } catch (e) {
        errors.push(String(e.message ?? e));
      }
    }
  }
  return { bySlug, errors };
}

// 動画のまとまり。上に、押すと公式チャンネルへ行く YouTube のロゴ
export function videosHtml(list) {
  return list
    .map(
      ({ ch, videos }) =>
        `<div class="yt"><p class="oc ytl"><a href="${esc(channelUrl(ch))}" target="_blank" rel="noopener"><img src="/youtube-logo.svg" width="90" height="20" alt="YouTube"></a><span>${esc(ch.name)}の新しい動画</span></p><ul class="vids">${videos
          .map(
            (v) =>
              `<li><a href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener">` +
              `<img src="${esc(v.thumb)}" width="320" height="180" loading="lazy" decoding="async" alt="">` +
              `<span class="vt">${esc(v.title)}</span>` +
              `<span class="vd">${v.published ? `${jstMonthDay(v.published)}・` : ''}${esc(ch.name)}</span></a></li>`,
          )
          .join('')}</ul></div>`,
    )
    .join('');
}

// 静的なページの目印（<!--yt:作品-->）に、動画のまとまりを入れる。取れなかった作品は目印を消すだけ
export function fillVideos(tpl, bySlug) {
  return tpl.replace(/<!--yt:([a-z0-9-]+)-->/g, (_, slug) => (bySlug.has(slug) ? videosHtml(bySlug.get(slug)) : ''));
}
