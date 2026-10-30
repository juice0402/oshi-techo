// /bingo/ のページ：わたしの推し（端末の ot-my。3人まで）ごとに、今月のカードと前の月までの記録を作る
// 記録は同じサイトの /bingo/data.json（月・推しキャラ・種類・見つけた日だけ）を読むだけ。どこにも送らない
// カードの形は build.mjs の bingoCardHtml と同じ。袋とはんこは src/bingo.js（window.otBingo）が受けもつ
(function () {
  var box = document.getElementById('bgmy'), cf = document.getElementById('bgcfg');
  if (!box || !cf || !window.fetch) return;
  var my = [];
  try {
    my = JSON.parse(window.localStorage.getItem('ot-my') || '[]');
  } catch (e) { my = []; }
  var cfg = JSON.parse(cf.textContent);
  var keys = [];
  (Array.isArray(my) ? my : []).forEach(function (x) {
    var k = x && typeof x.p === 'string' ? x.p.replace(/^\/|\/$/g, '') : '';
    if (cfg.oshi[k] && keys.indexOf(k) < 0) keys.push(k);
  });
  keys = keys.slice(-3);
  if (!keys.length) return;
  var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var md = function (d) { return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)); };
  var mon = function (ym) { return Number(ym.slice(5, 7)); };
  var y0 = cfg.now.slice(0, 4);
  var label = function (ym) { return (ym.slice(0, 4) === y0 ? '' : Number(ym.slice(0, 4)) + '年') + mon(ym) + '月'; };
  var card = function (k, c) {
    var o = cfg.oshi[k], m = mon(cfg.now);
    var frame = o[1] === m ? cfg.frames.b : cfg.frames[String(m)];
    var cells = cfg.kinds.map(function (x) {
      if (!x) return '<li class="bg-c st-mid"><span class="bg-st">' + cfg.ring + '<b class="bg-han">来た</b></span><small class="bg-dt bg-came"></small></li>';
      var pic = '<span class="bg-pic"><img src="' + x.img + '" alt="" width="240" height="240" loading="lazy" decoding="async"></span>';
      if (!c[x.k]) return '<li class="bg-c st-none" data-k="' + x.k + '"><span class="bg-a">' + pic + '<small class="bg-nm">' + esc(x.n) + '</small></span></li>';
      return '<li class="bg-c st-on" data-k="' + x.k + '"><span class="bg-a">' + pic + '<small class="bg-dt">' + md(c[x.k]) + '</small><small class="bg-nm">' + esc(x.n) + '</small></span></li>';
    }).join('');
    var log = cfg.kinds.filter(function (x) { return x && c[x.k]; }).sort(function (a, b) { return c[a.k] < c[b.k] ? -1 : c[a.k] > c[b.k] ? 1 : 0; }).map(function (x) { return '<span>' + md(c[x.k]) + ' ' + esc(x.n) + '</span>'; }).join('');
    return '<h2>' + esc(o[0]) + 'の' + m + '月の入荷ビンゴ</h2><div class="bg-wrap"><div class="bg-card"><img class="bg-frame" src="' + frame + '" alt="" width="800" height="800" loading="lazy" decoding="async"><div class="bg-in"><ol class="bg-g">' + cells + '</ol><svg class="bg-lines" viewBox="0 0 300 300" aria-hidden="true"></svg></div><b class="bg-bingo" hidden>ビンゴ</b></div><p class="bg-log">' + (log || '今月はまだ印がありません') + '</p></div>';
  };
  // 前の月までの記録：新しい月から。そろった列の数と、印のついたマスの小さな3×3
  var past = function (k, months) {
    var rows = Object.keys(months).filter(function (ym) { return ym < cfg.now && months[ym][k]; }).sort().reverse().map(function (ym) {
      var c = months[ym][k];
      var on = cfg.kinds.map(function (x) { return !x || !!c[x.k]; });
      var n = LINES.filter(function (l) { return on[l[0]] && on[l[1]] && on[l[2]]; }).length;
      var mini = cfg.kinds.map(function (x, i) { return '<i class="' + (!x ? 'mm' : on[i] ? 'mo' : '') + '"></i>'; }).join('');
      return '<li><span class="bg-mini" aria-hidden="true">' + mini + '</span><b>' + label(ym) + '</b><span>' + (n ? 'そろった列 ' + n : 'そろった列なし') + '</span></li>';
    });
    return rows.length ? '<h3 class="bg-ph">前の月まで</h3><ul class="bg-past">' + rows.join('') + '</ul>' : '';
  };
  fetch('/bingo/data.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || !d.months) return;
    keys.forEach(function (k) {
      var sec = document.createElement('section');
      sec.className = 'bingo';
      sec.setAttribute('data-k', k);
      sec.setAttribute('data-m', cfg.now);
      sec.innerHTML = card(k, (d.months[cfg.now] || {})[k] || {}) + past(k, d.months);
      var p = document.createElement('p'), a = document.createElement('a');
      p.className = 'more';
      a.setAttribute('href', '/' + k + '/');
      a.textContent = cfg.oshi[k][0] + 'のグッズの新着へ';
      p.appendChild(a);
      sec.appendChild(p);
      box.appendChild(sec);
    });
    box.hidden = false;
    var pk = document.querySelector('.bg-pick');
    if (pk) pk.hidden = true;
    if (window.otBingo) [].forEach.call(box.querySelectorAll('section.bingo'), window.otBingo);
  }).catch(function () {});
})();
