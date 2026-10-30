// 入荷ビンゴ（推しキャラのページ）。袋をあける・ペンの線・ビンゴのはんこ・来た日
// 端末に残すのは localStorage の oshi-bingo（推しごとに 月 m・開けた種類 o・その月に初めて来た日 d）だけ。サーバーにも楽天にも送らない
// 保存が使えないときは袋にしない（HTML のまま、印のあるマスは全部シールが貼られた形。そろった列の線とはんこだけ出す）
// /bingo/ のページは、わたしの推しのカードを足してから window.otBingo(section) を呼ぶ。data-plain のカードは袋にせず、端末にも残さない
(function () {
  var S = null, st = {};
  try {
    S = window.localStorage;
    S.setItem('oshi-bingo-t', '1');
    S.removeItem('oshi-bingo-t');
    st = JSON.parse(S.getItem('oshi-bingo') || '{}') || {};
    if (typeof st !== 'object' || Array.isArray(st)) st = {};
  } catch (e) { S = null; st = {}; }
  var save = function () { if (S) try { S.setItem('oshi-bingo', JSON.stringify(st)); } catch (e) {} };
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var today = new Date(Date.now() + 324e5).toISOString().slice(0, 10);
  var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  var BAG = '<svg class="bg-fukuro" viewBox="0 0 80 80" aria-hidden="true"><path d="M14 18l6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 4-4v56c0 3-2 5-5 5H17c-3 0-5-2-5-5V14z" fill="#FBD3E2" stroke="#B23F78" stroke-width="1.6"/><path d="M12 30h56" stroke="#B23F78" stroke-width="1.2" stroke-dasharray="3 3"/><path d="M40 44c-4-5-11-2-9 4 1 4 9 9 9 9s8-5 9-9c2-6-5-9-9-4z" fill="#B23F78"/></svg>';
  var md = function (d) { return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)); };
  function init(sec) {
    var key = sec.getAttribute('data-k'), m = sec.getAttribute('data-m');
    var plain = sec.hasAttribute('data-plain');
    var me = plain ? { m: m, o: [] } : st[key];
    // 月が変わったら、その推しの新しい月にする
    if (!me || me.m !== m || !Array.isArray(me.o)) me = st[key] = { m: m, o: [] };
    if (!plain) {
      if (S && !me.d && today.slice(0, 7) === m) me.d = today;
      save();
    }
    var came = sec.querySelector('.bg-came');
    if (came && me.d) came.textContent = md(me.d);
    var cells = [].slice.call(sec.querySelectorAll('.bg-c'));
    var svg = sec.querySelector('.bg-lines'), stamp = sec.querySelector('.bg-bingo');
    // 前に開けたもの以外の印は袋に（初めての人は全部袋）
    cells.forEach(function (c) {
      var k = c.getAttribute('data-k');
      if (!S || plain || !c.classList.contains('st-on') || me.o.indexOf(k) >= 0) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'bg-cover';
      b.setAttribute('aria-label', c.querySelector('.bg-nm').textContent + 'をあける');
      b.innerHTML = BAG + '<span>あける</span>';
      b.addEventListener('click', function () {
        b.remove();
        if (me.o.indexOf(k) < 0) me.o.push(k);
        save();
        var p = c.querySelector('.bg-pic');
        if (!calm && p) p.classList.add('bg-pop');
        setTimeout(function () { check(!calm); }, calm ? 0 : 250);
      });
      c.appendChild(b);
    });
    var on = function (i) { var c = cells[i]; return c.classList.contains('st-mid') || (c.classList.contains('st-on') && !c.querySelector('.bg-cover')); };
    var done = {};
    function check(move) {
      LINES.forEach(function (l, n) {
        if (done[n] || !l.every(on)) return;
        done[n] = 1;
        var p = function (i) { return [50 + 100 * (i % 3), 50 + 100 * Math.floor(i / 3)]; }, a = p(l[0]), b = p(l[2]);
        var dx = (b[0] - a[0]) * 0.12, dy = (b[1] - a[1]) * 0.12;
        var w = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        w.setAttribute('d', 'M' + (a[0] - dx) + ' ' + (a[1] - dy + 2) + 'C' + (a[0] + (b[0] - a[0]) / 3) + ' ' + (a[1] + (b[1] - a[1]) / 3 - 3) + ' ' + (a[0] + 2 * (b[0] - a[0]) / 3) + ' ' + (a[1] + 2 * (b[1] - a[1]) / 3 + 3) + ' ' + (b[0] + dx) + ' ' + (b[1] + dy - 1));
        if (move) w.setAttribute('class', 'draw');
        svg.appendChild(w);
        if (stamp.hidden) {
          stamp.hidden = false;
          if (move) stamp.classList.add('press');
        }
      });
    }
    check(false);
    // 開いたシールは、そのページの推し×種類のしおりへ
    [].forEach.call(sec.querySelectorAll('a.bg-a[data-c]'), function (a) {
      a.addEventListener('click', function (ev) {
        var t = document.querySelector('nav.shiori a[data-c="' + a.getAttribute('data-c') + '"]');
        if (!t) return;
        ev.preventDefault();
        t.click();
        var nav = t.closest('nav');
        if (nav && nav.scrollIntoView) nav.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' });
      });
    });
  }
  [].forEach.call(document.querySelectorAll('section.bingo'), init);
  window.otBingo = init;
})();
