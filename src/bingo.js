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
  // 画像で保存（③）：カードを canvas に描いて PNG に。額は手帳のしましまと白い紙、はんこは SVG と同じ線（絵は入れない）
  // 日付のはんこと列の線は、袋をあけていなくても印のあるマスで描く。送れる端末は共有（ファイル）、だめならダウンロード。どこにも送らない
  var RING = 'M32 5c15 0 27 11.5 27 26.5S47.5 59 32.5 59 5 47 5.5 32 17 5 32 5z', RING2 = 'M32 10.5c12 0 21.5 9 21.5 21s-9.5 21.5-21.5 21.5S10.5 43.5 10.5 31.5 20 10.5 32 10.5z';
  var C = { ink: '#4E3657', sub: '#7E6A86', line: '#EFE3F1', berry: '#B23F78', pink: '#FBD3E2', lav: '#E3D9FB', lav2: '#FAF5FB', dot: '#E6D6EA', dash: '#D9C6DE', off: '#B7A9BC' };
  function draw(sec) {
    var W = 1080, H = 1350, cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    var x = cv.getContext('2d');
    if (!x) return null;
    var ff = (window.getComputedStyle && getComputedStyle(document.body).fontFamily) || 'sans-serif';
    var font = function (px, b) { x.font = (b ? '700 ' : '400 ') + px + 'px ' + ff; };
    var fit = function (t, px, b, max) { font(px, b); while (px > 20 && x.measureText(t).width > max) font(px -= 2, b); };
    var rr = function (l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); };
    // 額：ヘッダーと同じピンクとラベンダーの縦じま、中に白い紙
    for (var i = 0; i * 36 < W; i++) { x.fillStyle = i % 2 ? C.lav : C.pink; x.fillRect(i * 36, 0, 36, H); }
    x.fillStyle = '#fff';
    rr(44, 44, W - 88, H - 88, 18);
    x.fill();
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    var title = (sec.querySelector('h2') || {}).textContent || '';
    x.fillStyle = C.ink;
    fit(title, 54, 1, W - 200);
    x.fillText(title, W / 2, 150);
    x.fillStyle = C.berry;
    x.fillRect(W / 2 - 40, 200, 80, 6);
    // 3×3：ドットの地にマス
    var G = 840, L = (W - G) / 2, T = 250, P = 14, S = (G - 2 * P - 2 * 12) / 3;
    x.fillStyle = C.lav2;
    x.fillRect(L, T, G, G);
    x.fillStyle = C.dot;
    for (var dy = 12; dy < G; dy += 24) for (var dx = 12; dx < G; dx += 24) { x.beginPath(); x.arc(L + dx, T + dy, 2.4, 0, 7); x.fill(); }
    x.strokeStyle = C.line;
    x.lineWidth = 2;
    x.strokeRect(L, T, G, G);
    var ring = function (cx, cy, s) {
      if (!window.Path2D) return;
      x.save();
      x.translate(cx - 32 * s, cy - 32 * s);
      x.scale(s, s);
      x.strokeStyle = C.berry;
      x.lineWidth = 2.6;
      x.stroke(new Path2D(RING));
      x.lineWidth = 1;
      x.stroke(new Path2D(RING2));
      x.restore();
    };
    var on = [], fg = [];
    [].slice.call(sec.querySelectorAll('.bg-c')).forEach(function (c, n) {
      var l = L + P + (n % 3) * (S + 12), t = T + P + Math.floor(n / 3) * (S + 12), cx = l + S / 2;
      var mid = c.classList.contains('st-mid'), has = mid || c.classList.contains('st-on');
      var nm = (c.querySelector('.bg-nm') || {}).textContent || '', dt = ((c.querySelector('.bg-dt') || {}).textContent || '').trim();
      on[n] = has;
      x.fillStyle = '#fff';
      rr(l, t, S, S, 20);
      x.fill();
      x.setLineDash([9, 7]);
      x.strokeStyle = C.dash;
      x.lineWidth = 3;
      x.stroke();
      x.setLineDash([]);
      // 字とはんこは線のあとに描く（線の上にのせて読めるように）
      fg.push(function () {
        if (has) {
          x.fillStyle = '#fff';
          x.beginPath();
          x.arc(cx, t + S * 0.42, S * 0.21, 0, 7);
          x.fill();
          ring(cx, t + S * 0.42, S * 0.56 / 64);
        }
        x.fillStyle = C.berry;
        if (mid) {
          font(46, 1);
          x.fillText('来た', cx, t + S * 0.42);
          if (dt) { font(30, 1); x.fillText(dt, cx, t + S * 0.86); }
          return;
        }
        if (has) { fit(dt, 44, 1, S * 0.34); x.fillText(dt, cx, t + S * 0.42); }
        x.fillStyle = has ? C.sub : C.off;
        fit(nm, 30, 0, S - 24);
        x.fillText(nm, cx, has ? t + S * 0.86 : t + S / 2);
      });
    });
    // そろった列にペンの線（ページの SVG と同じ曲がり方）と「ビンゴ」のはんこ
    var k = G / 300, any = false;
    x.strokeStyle = C.berry;
    x.globalAlpha = 0.6;
    x.lineWidth = 14;
    x.lineCap = 'round';
    LINES.forEach(function (ln) {
      if (!on[ln[0]] || !on[ln[1]] || !on[ln[2]]) return;
      any = true;
      var p = function (i) { return [50 + 100 * (i % 3), 50 + 100 * Math.floor(i / 3)]; }, a = p(ln[0]), b = p(ln[2]);
      var ex = (b[0] - a[0]) * 0.12, ey = (b[1] - a[1]) * 0.12, X = function (v) { return L + v * k; }, Y = function (v) { return T + v * k; };
      x.beginPath();
      x.moveTo(X(a[0] - ex), Y(a[1] - ey + 2));
      x.bezierCurveTo(X(a[0] + (b[0] - a[0]) / 3), Y(a[1] + (b[1] - a[1]) / 3 - 3), X(a[0] + 2 * (b[0] - a[0]) / 3), Y(a[1] + 2 * (b[1] - a[1]) / 3 + 3), X(b[0] + ex), Y(b[1] + ey - 1));
      x.stroke();
    });
    x.globalAlpha = 1;
    fg.forEach(function (f) { f(); });
    if (any) {
      font(48, 1);
      var bw = x.measureText('ビンゴ').width + 64;
      x.fillStyle = '#fff';
      x.fillRect(L + G - bw + 16, T - 40, bw, 84);
      x.strokeStyle = C.berry;
      x.lineWidth = 6;
      x.strokeRect(L + G - bw + 16, T - 40, bw, 84);
      x.fillStyle = C.berry;
      x.fillText('ビンゴ', L + G - bw / 2 + 16, T + 2);
    }
    // いちばん下にサイト名とアドレス
    x.fillStyle = C.ink;
    font(38, 1);
    x.fillText('推しグッズ入荷手帳', W / 2, 1172);
    x.fillStyle = C.sub;
    font(28, 0);
    x.fillText('nyuka-techo.com', W / 2, 1226);
    return cv;
  }
  function saveImg(sec) {
    var cv = draw(sec);
    if (!cv) return;
    var name = 'oshi-bingo-' + (sec.getAttribute('data-k') || '').replace(/[^a-z0-9-]+/gi, '-') + '-' + sec.getAttribute('data-m') + '.png';
    // 共有は押した流れのまま呼ぶ（iPhone は待つと断られる）ので、toBlob を待たずに作る
    var u = cv.toDataURL('image/png'), bin = atob(u.split(',')[1]), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    var blob = new Blob([a], { type: 'image/png' });
    var down = function () {
      var l = document.createElement('a'), h = URL.createObjectURL(blob);
      l.href = h;
      l.download = name;
      document.body.appendChild(l);
      l.click();
      l.remove();
      setTimeout(function () { URL.revokeObjectURL(h); }, 4e4);
    };
    var f = null;
    try { f = new File([blob], name, { type: 'image/png' }); } catch (e) {}
    if (f && navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) {
      navigator.share({ files: [f] }).catch(function (e) { if (!e || e.name !== 'AbortError') down(); });
    } else down();
  }
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
    // カードの下に「画像で保存」（canvas が使える端末だけ）
    var wrap = sec.querySelector('.bg-wrap'), cvt = document.createElement('canvas');
    if (wrap && cvt.getContext && cvt.toDataURL && window.Blob && window.atob && !sec.querySelector('.bg-sv')) {
      var sp = document.createElement('p'), sb = document.createElement('button');
      sp.className = 'bg-sv';
      sb.type = 'button';
      sb.textContent = '画像で保存';
      sb.addEventListener('click', function () { saveImg(sec); });
      sp.appendChild(sb);
      wrap.parentNode.insertBefore(sp, wrap.nextSibling);
    }
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
