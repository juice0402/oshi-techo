// わたしの推し・推し×種類のしおり・前に見てから（ブラウザの中だけで動く。build.mjs がページに入れる）
// 保存するのは、見ている端末の localStorage の ot-my（推しキャラのページの場所・名前・えらんだ種類）、ot-cur・ot-prev（時刻）だけ。
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
    show(okCat(start) && start ? start : mine && mine.c ? mine.c : '');
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
    }).catch(function () { box.remove(); });
  });
})();
