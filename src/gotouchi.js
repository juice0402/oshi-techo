// ご当地の一覧の「持ってる」のチェック（ブラウザの中だけで動く。build.mjs がご当地の一覧のページに入れる）
// 保存するのは、見ている端末の localStorage の ot-gotouchi-<作品>（キティは ot-gotouchi-kitty）に、県の id（ローマ字）をカンマでつないだものだけ。
// ご当地スヌーピーは読みものの道具と同じ ot-gotouchi-snoopy・同じ形なので、どちらで付けても両方に出る。いまの一覧にない県の印も消さない。
// 楽天のデータは保存しない。サイトや楽天には何も送らない。保存できないブラウザではチェックを出さない。
(function () {
  var m = document.querySelector('[data-gk]');
  if (!m) return;
  var KEY = m.getAttribute('data-gk');
  if (!/^ot-gotouchi-[a-z0-9-]+$/.test(KEY)) return;
  var S;
  try {
    S = window.localStorage;
    S.setItem('ot-t', '1');
    S.removeItem('ot-t');
  } catch (e) {
    return;
  }
  var got = {};
  try {
    var v = S.getItem(KEY);
    if (v) v.split(',').forEach(function (p) { if (/^[a-z]+$/.test(p)) got[p] = 1; });
  } catch (e) {}
  var bs = [].slice.call(document.querySelectorAll('.gpk[data-p]'));
  var draw = function () {
    bs.forEach(function (b) { b.setAttribute('aria-pressed', String(!!got[b.getAttribute('data-p')])); });
    [].forEach.call(document.querySelectorAll('.gtoc a[href^="#p-"]'), function (a) {
      if (got[a.getAttribute('href').slice(3)]) a.setAttribute('data-got', '');
      else a.removeAttribute('data-got');
    });
  };
  var save = function () {
    var a = [];
    for (var k in got) a.push(k);
    try {
      if (a.length) S.setItem(KEY, a.join(','));
      else S.removeItem(KEY);
    } catch (e) {}
  };
  bs.forEach(function (b) {
    b.hidden = false;
    b.addEventListener('click', function () {
      // 押す前に読みなおす（ほかのタブや読みものの道具で付けた県を消さない）
      try {
        var v = S.getItem(KEY);
        got = {};
        if (v) v.split(',').forEach(function (p) { if (/^[a-z]+$/.test(p)) got[p] = 1; });
      } catch (e) {}
      var p = b.getAttribute('data-p');
      if (got[p]) delete got[p];
      else got[p] = 1;
      save();
      draw();
    });
  });
  draw();
})();
