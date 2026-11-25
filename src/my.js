// わたしの推し・推し×種類のしおり・前に見てから（ブラウザの中だけで動く。build.mjs がページに入れる）
// 保存するのは、見ている端末の localStorage の ot-my（推しキャラのページの場所・名前・えらんだ種類）、ot-cur・ot-prev（時刻）、ot-home（ホーム画面の案内をとじた印）、ot-yoyaku（「予約した」の商品の番号と発売の時期）だけ。
// 楽天のデータは保存しない。サイトや楽天には何も送らない。読みにいくのは、このサイトの推しキャラのページだけ。
(function () {
  var S;
  try {
    S = window.localStorage;
    S.setItem('ot-t', '1');
    S.removeItem('ot-t');
  } catch (e) {
    S = null;
  }
  var now = Date.now();
  var prev = 0;
  var my = [];
  var okPath = function (p) { return /^\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(p); };
  var okCat = function (c) { return /^[a-z]*$/.test(c || ''); };
  if (S) {
    // 前に見た時刻：30分あいたら進める。30日より前なら数えない
    var cur = +S.getItem('ot-cur') || 0;
    prev = +S.getItem('ot-prev') || 0;
    if (!cur || now - cur > 18e5) {
      if (cur) S.setItem('ot-prev', String(cur));
      prev = cur;
    }
    S.setItem('ot-cur', String(now));
    if (prev && now - prev > 2592e6) prev = 0;
    try {
      my = JSON.parse(S.getItem('ot-my') || '[]').filter(function (x) {
        return x && okPath(x.p) && typeof x.n === 'string' && okCat(x.c);
      }).slice(-3);
    } catch (e) {}
  }
  var save = function () { try { S.setItem('ot-my', JSON.stringify(my)); } catch (e) {} };
  var here = function () { return my.filter(function (x) { return x.p === location.pathname; })[0]; };

  // 季節のまとめ（/<季節>/）：わたしの推しの作品の section を、わたしの推しの順にいちばん上へ（ほかの作品の順はそのまま）。
  // 開いたときに一度だけ。もう上から順に並んでいるとき・その作品がないときは動かさない。HTML とどこへの保存も変えない
  var mws = [].slice.call(document.querySelectorAll('section[data-mywork]'));
  if (mws.length && my.length) {
    var want = [];
    my.forEach(function (x) {
      var w = document.getElementById(x.p.split('/')[1]);
      if (w && w.hasAttribute('data-mywork') && want.indexOf(w) < 0) want.push(w);
    });
    if (want.some(function (w, i) { return mws[i] !== w; })) {
      for (var wi = want.length - 1; wi >= 0; wi--) {
        var first = document.querySelector('section[data-mywork]');
        if (first !== want[wi]) first.parentNode.insertBefore(want[wi], first);
      }
    }
  }

  // 推し×種類のしおり（推しキャラのページ）
  var nav = document.querySelector('nav.shiori');
  var pool = document.querySelector('ul[data-pool]');
  var curCat = '';
  var curName = '';
  var orig = null;
  var restItems = function () { return [].slice.call(document.querySelectorAll('section.rest ul.grid > li')); };
  var show = function (c) {
    if (!nav || !pool) return;
    var a = nav.querySelector('a[data-c="' + c + '"]');
    if (!a) { c = ''; a = nav.querySelector('a[data-c=""]'); }
    curCat = c;
    curName = c ? a.textContent : '';
    [].forEach.call(nav.querySelectorAll('a'), function (x) { x.setAttribute('aria-current', String(x === a)); });
    if (!orig) orig = [].slice.call(pool.children);
    while (pool.firstChild) pool.removeChild(pool.firstChild);
    // すべて：はじめの8件。種類：最初の8件と一覧から、その種類を全部（一覧はかくす）
    var list = c ? orig.concat(restItems()).filter(function (li) { return li.getAttribute('data-c') === c; }).map(function (li) { return li.cloneNode(true); }) : orig;
    list.forEach(function (li) { pool.appendChild(li); });
    var rest = document.querySelector('section.rest');
    if (rest) rest.hidden = !!c;
  };
  if (nav && pool) {
    var mine = here();
    var start = location.hash.slice(1);
    // #種類 のときだけその種類（#yoyaku などの棚への飛び先では、覚えた種類のまま）
    show(okCat(start) && start && nav.querySelector('a[data-c="' + start + '"]') ? start : mine && mine.c ? mine.c : '');
    [].forEach.call(nav.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        show(a.getAttribute('data-c'));
        try { history.replaceState(null, '', curCat ? '#' + curCat : location.pathname); } catch (e) {}
        var m = here();
        if (m) { m.c = curCat; m.cn = curName; save(); }
      });
    });
  }

  // わたしの推しのボタン（推しキャラのページ）。保存が使えないときは出さない
  if (S) {
    [].forEach.call(document.querySelectorAll('.myb'), function (b) {
      var p = b.getAttribute('data-p');
      var has = function () { return my.some(function (x) { return x.p === p; }); };
      b.setAttribute('aria-pressed', String(has()));
      b.hidden = false;
      b.addEventListener('click', function () {
        var on = has();
        my = my.filter(function (x) { return x.p !== p; });
        if (!on) {
          my.push({ p: p, n: b.getAttribute('data-n'), c: curCat, cn: curName });
          if (my.length > 3) my.shift();
        }
        save();
        b.setAttribute('aria-pressed', String(!on));
      });
    });
  }

  // 予約帳の「予約した」（推しキャラのページの予約受付中の棚と /yoyaku/）。押すと商品名にペンの線。
  // 残すのは ot-yoyaku に、商品の番号・発売の時期（日か月。わからないものは空）・押した日だけ。
  // 発売の月が過ぎて60日たった記録は消す。発売の時期がわからない記録は、押した日から60日で消す
  var yt = new Date(now + 324e5).toISOString();
  var yDay = yt.slice(0, 10);
  var yMon = yt.slice(0, 7);
  var yk = [];
  var okY = function (x) { return x && typeof x[0] === 'string' && x[0].length <= 300 && /^(\d{4}-\d\d(-\d\d)?)?$/.test(x[1] || '') && /^\d{4}-\d\d-\d\d$/.test(x[2] || ''); };
  var yGone = function (x) {
    var d = x[1];
    // 日本時間の0時（UTC では前の日の15時）。発売の時期があればその月の次の月の1日、なければ押した日
    var base = d ? Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 1) - 324e5 : Date.parse(x[2]) - 324e5;
    return now - base > 5184e6;
  };
  var ySave = function () { try { if (yk.length) S.setItem('ot-yoyaku', JSON.stringify(yk)); else S.removeItem('ot-yoyaku'); } catch (e) {} };
  if (S) {
    try {
      yk = JSON.parse(S.getItem('ot-yoyaku') || '[]').filter(okY);
    } catch (e) {}
    var yLen = yk.length;
    yk = yk.filter(function (x) { return !yGone(x); }).slice(-300);
    if (yk.length !== yLen) ySave();
  }
  var yHas = function (id) { return yk.some(function (x) { return x[0] === id; }); };
  var yMark = function (li, on) {
    li.classList.toggle('ykd', on);
    var b = li.querySelector('.ykb');
    if (b) b.setAttribute('aria-pressed', String(on));
    var d = li.getAttribute('data-yd') || '';
    var n = li.querySelector('.ykn');
    var t = on && (d === yDay ? '今日発売' : d === yMon ? '今月発売' : '');
    if (t && !n) {
      n = document.createElement('span');
      n.className = 'nt ykn';
      b.parentNode.insertBefore(n, b);
    }
    if (n) {
      if (t) n.textContent = t;
      else n.remove();
    }
  };
  if (S) {
    [].forEach.call(document.querySelectorAll('li[data-y]'), function (li) {
      var b = li.querySelector('.ykb');
      if (!b) return;
      var id = li.getAttribute('data-y');
      yMark(li, yHas(id));
      b.hidden = false;
      b.addEventListener('click', function () {
        var on = !yHas(id);
        yk = yk.filter(function (x) { return x[0] !== id; });
        if (on) yk.push([id, li.getAttribute('data-yd') || '', yDay]);
        ySave();
        // 同じ商品のカードがほかにもあれば、そろえる
        [].forEach.call(document.querySelectorAll('li[data-y]'), function (o) { if (o.getAttribute('data-y') === id) yMark(o, on); });
      });
    });
  }

  // /yoyaku/ の「わたしの推しだけ」：わたしの推しを登録している端末だけに出す。カードの data-o（推しキャラのページの場所）でしぼる
  var ykf = document.querySelector('.ykf');
  if (ykf && my.length) {
    var fb = ykf.querySelector('button');
    var mine2 = my.map(function (x) { return x.p; });
    ykf.hidden = false;
    fb.addEventListener('click', function () {
      var on = fb.getAttribute('aria-pressed') !== 'true';
      var any = 0;
      fb.setAttribute('aria-pressed', String(on));
      [].forEach.call(document.querySelectorAll('main section'), function (s) {
        var c = 0;
        [].forEach.call(s.querySelectorAll('li[data-y]'), function (li) {
          var ok = !on || (li.getAttribute('data-o') || '').split(' ').some(function (p) { return mine2.indexOf(p) >= 0; });
          li.hidden = !ok;
          if (ok) c++;
        });
        s.hidden = !c;
        any += c;
      });
      var e = document.querySelector('.yk-none');
      if (e) e.hidden = !!any;
    });
  }

  // 発売日カレンダー（/<作品>/hatsubai/）の「わたしの推しだけ」：わたしの推しに当たるカード（data-o）が1つ以上ある端末だけに出す。
  // 押すと当たらないカードと、カードが全部かくれた節をかくす。もう一度押すと元にもどる。並びの順・発売のメモ・つぎに見るはそのまま。押したかどうかは保存しない
  var hbf = document.querySelector('.hbf');
  if (hbf && my.length) {
    var mine3 = my.map(function (x) { return x.p; });
    var hbHit = function (li) { return (li.getAttribute('data-o') || '').split(' ').some(function (p) { return mine3.indexOf(p) >= 0; }); };
    var hbSecs = [].slice.call(document.querySelectorAll('main section')).filter(function (s) { return s.querySelector('ul.grid > li'); });
    if (hbSecs.some(function (s) { return [].some.call(s.querySelectorAll('ul.grid > li'), hbHit); })) {
      var hb = hbf.querySelector('button');
      hbf.hidden = false;
      hb.addEventListener('click', function () {
        var on = hb.getAttribute('aria-pressed') !== 'true';
        hb.setAttribute('aria-pressed', String(on));
        hbSecs.forEach(function (s) {
          var c = 0;
          [].forEach.call(s.querySelectorAll('ul.grid > li'), function (li) {
            var ok = !on || hbHit(li);
            li.hidden = !ok;
            if (ok) c++;
          });
          s.hidden = !c;
        });
      });
    }
  }

  // トップの「わたしの推し」：推しキャラのページを読んで、最初の8件（種類をえらんでいればその種類）を棚に入れる
  var sec = document.getElementById('my');
  if (!sec || !my.length) return;
  sec.hidden = false;
  var t = new Date(now + 324e5).toISOString().slice(0, 10);
  my.forEach(function (o) {
    var box = document.createElement('div');
    box.className = 'myo';
    sec.appendChild(box);
    fetch(o.p).then(function (r) { return r.ok ? r.text() : ''; }).then(function (h) {
      var d = h && new DOMParser().parseFromString(h, 'text/html');
      var u = d && (d.querySelector('main ul[data-pool]') || d.querySelector('main ul.grid'));
      var all = u ? [].slice.call(u.children).concat([].slice.call(d.querySelectorAll('main section.rest ul.grid > li'))) : [];
      var lis = all.filter(function (li) { return !o.c || li.getAttribute('data-c') === o.c; });
      if (!lis.length) {
        box.remove();
        if (!sec.querySelector('.myo')) sec.hidden = true;
        return;
      }
      var n = 0;
      if (prev) lis.forEach(function (li) {
        var tm = li.querySelector('time');
        if (tm && Date.parse(tm.getAttribute('datetime')) > prev) n++;
      });
      var hd = document.createElement('p');
      var a = document.createElement('a');
      hd.className = 'myh';
      a.setAttribute('href', o.p + (o.c ? '#' + o.c : ''));
      a.textContent = o.n + (o.c && o.cn ? '・' + o.cn : '');
      hd.appendChild(a);
      if (n) {
        var sp = document.createElement('span');
        sp.textContent = '前に見てから' + n + '件';
        hd.appendChild(sp);
      }
      var ul = document.createElement('ul');
      ul.className = 'grid';
      lis.slice(0, 8).forEach(function (li) {
        var c = document.importNode(li, true);
        c.hidden = false;
        ul.appendChild(c);
      });
      [].forEach.call(ul.querySelectorAll('[data-until]'), function (e) {
        if (Date.parse(e.getAttribute('data-until')) < now) e.remove();
      });
      [].forEach.call(ul.querySelectorAll('[data-dl]'), function (e) {
        var g = Math.round((Date.parse(e.getAttribute('data-dl')) - Date.parse(t)) / 864e5);
        if (g < 0) e.remove();
        else if (g <= 7) e.textContent += g === 0 ? '（今日まで）' : '（あと' + g + '日）';
      });
      box.appendChild(hd);
      box.appendChild(ul);
      // その推しの予約受付中の棚があれば、棚の下に1行（予約したものが棚にあれば、そう書く。ot-yoyaku は読むだけ）
      var ys = d.querySelector('main section.shelf.yk');
      var yh = ys && ys.querySelector('h2');
      if (yh) {
        var yp = document.createElement('p');
        var ya = document.createElement('a');
        var did = [].some.call(ys.querySelectorAll('li[data-y]'), function (li) { return yHas(li.getAttribute('data-y')); });
        yp.className = 'myh';
        ya.setAttribute('href', o.p + '#yoyaku');
        ya.textContent = yh.textContent + (did ? '（予約したものあり）' : '（発売の順）');
        yp.appendChild(ya);
        box.appendChild(yp);
      }
    }).catch(function () { box.remove(); });
  });
  // ホーム画面に追加できることを、わたしの推しを選んだ人にだけ棚の下に1行。とじたら ot-home を覚えて、もう出さない
  if (!S.getItem('ot-home')) {
    var hm = document.createElement('p');
    var hb = document.createElement('button');
    hm.className = 'myhome';
    hm.textContent = 'ホーム画面に追加すると、わたしの推しをすぐ開けます（ブラウザの共有やメニューの「ホーム画面に追加」から）';
    hb.type = 'button';
    hb.textContent = 'とじる';
    hb.addEventListener('click', function () {
      try { S.setItem('ot-home', '1'); } catch (e) {}
      hm.remove();
    });
    hm.appendChild(hb);
    sec.appendChild(hm);
  }
})();
