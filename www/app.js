/* Dope Wars UI: wires the engine to the screen. */
(function () {
  'use strict';
  var E = window.Engine;
  var $ = function (id) { return document.getElementById(id); };
  var S = null;
  var SAVE_KEY = 'dopewars-save-v2', HIGH_KEY = 'dopewars-high-v1', MUTE_KEY = 'dopewars-mute-v1';

  /* ---------- helpers ---------- */
  function money(n) { n = Math.round(n); return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US'); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* ---------- sound ---------- */
  var Snd = (function () {
    var ac = null, on = load(MUTE_KEY) !== '1';
    function ctx() {
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
      if (ac && ac.state === 'suspended') ac.resume();
      return ac;
    }
    function tone(f, d, type, vol, delay, to) {
      if (!on) return;
      var a = ctx(); if (!a) return;
      var t0 = a.currentTime + (delay || 0);
      var o = a.createOscillator(), g = a.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + d);
      g.gain.setValueAtTime(vol || 0.06, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(a.destination);
      o.start(t0); o.stop(t0 + d + 0.02);
    }
    return {
      get on() { return on; },
      set: function (v) { on = v; store(MUTE_KEY, v ? '0' : '1'); },
      tap: function () { tone(520, 0.05, 'square', 0.04); },
      buy: function () { tone(330, 0.07, 'square', 0.05); tone(440, 0.09, 'square', 0.05, 0.07); },
      cash: function () { tone(660, 0.07, 'triangle', 0.08); tone(880, 0.07, 'triangle', 0.08, 0.07); tone(1320, 0.16, 'triangle', 0.08, 0.14); },
      loss: function () { tone(300, 0.25, 'sawtooth', 0.05, 0, 120); },
      travel: function () { tone(180, 0.3, 'sawtooth', 0.04, 0, 520); },
      siren: function () { for (var i = 0; i < 4; i++) tone(i % 2 ? 620 : 880, 0.16, 'square', 0.05, i * 0.17); },
      hit: function () { tone(140, 0.2, 'sawtooth', 0.09, 0, 40); },
      over: function () { tone(440, 0.18, 'triangle', 0.07); tone(330, 0.18, 'triangle', 0.07, 0.18); tone(220, 0.4, 'triangle', 0.07, 0.36); }
    };
  })();

  /* ---------- toast ---------- */
  var toastT = 0;
  function toast(msg, kind) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'on' + (kind ? ' ' + kind : '');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.className = ''; }, 2000);
  }

  /* ---------- modal ---------- */
  function openModal(o) {
    var m = $('modal'), card = m.querySelector('.card');
    card.className = 'card' + (o.tone ? ' ' + o.tone : '');
    $('m-title').textContent = o.title || '';
    var body = $('m-body'); body.textContent = '';
    (o.body || []).forEach(function (n) { body.appendChild(typeof n === 'string' ? el('p', null, n) : n); });
    var btns = $('m-btns'); btns.textContent = '';
    (o.buttons || []).forEach(function (b) {
      var x = el('button', 'btn' + (b.cls ? ' ' + b.cls : ''), b.label);
      if (b.disabled) x.disabled = true;
      x.addEventListener('click', function () { Snd.tap(); b.fn(); });
      btns.appendChild(x);
    });
    m.hidden = false;
    card.scrollTop = 0;
  }
  function closeModal() { $('modal').hidden = true; }

  /* ---------- rendering ---------- */
  var prev = { cash: null, bank: null, debt: null };
  function pop(id, key, val) {
    var n = $(id);
    n.textContent = money(val);
    if (prev[key] !== null && val !== prev[key]) {
      var good = key === 'debt' ? val < prev[key] : val > prev[key];
      n.classList.remove('pop-up', 'pop-down'); void n.offsetWidth;
      n.classList.add(good ? 'pop-up' : 'pop-down');
    }
    prev[key] = val;
  }
  function renderHud() {
    $('day').textContent = S.day;
    pop('cash', 'cash', S.cash); pop('bank', 'bank', S.bank); pop('debt', 'debt', S.debt);
    $('coat').textContent = E.used(S) + '/' + S.coat;
    var g = $('guns'); g.hidden = S.guns < 1; g.textContent = S.guns + (S.guns > 1 ? ' GUNS' : ' GUN');
    var hp = $('hp');
    hp.style.width = S.health + '%';
    hp.style.background = S.health > 60 ? 'linear-gradient(90deg,#5dff8a,#27e1ff)' : S.health > 30 ? 'linear-gradient(90deg,#ffc83d,#ff8a3d)' : 'linear-gradient(90deg,#ff4466,#ff2e93)';
    $('hpn').textContent = S.health;
    $('shark').hidden = !E.atBank(S);
  }

  function renderMarket() {
    var box = $('market'); box.textContent = '';
    E.DRUGS.forEach(function (d) {
      var p = S.prices[d.id], slot = S.inv[d.id];
      var row = el('div', 'row' + (p ? '' : ' gone'));
      var dot = el('div', 'dot'); dot.style.background = d.color; dot.style.boxShadow = '0 0 10px ' + d.color;
      row.appendChild(dot);

      var info = el('div');
      info.appendChild(el('div', 'name', d.name));
      var own = el('div', 'own');
      if (slot.qty > 0) {
        var avg = slot.cost / slot.qty;
        own.appendChild(document.createTextNode('Have '));
        own.appendChild(el('b', null, String(slot.qty)));
        own.appendChild(document.createTextNode(' @ ' + money(avg) + ' '));
        if (p) own.appendChild(el('span', p >= avg ? 'up' : 'dn', p >= avg ? '▲' : '▼'));
      } else {
        own.textContent = 'None';
      }
      info.appendChild(own);
      row.appendChild(info);

      var pr = el('div', 'price');
      if (p) {
        pr.appendChild(el('div', null, money(p)));
        var pos = Math.max(0.04, Math.min(1, (p - d.min) / (d.max - d.min)));
        var m = el('div', 'meter'), i = document.createElement('i');
        i.style.width = (pos * 100) + '%';
        i.style.background = pos < 0.34 ? '#5dff8a' : pos < 0.67 ? '#ffc83d' : '#ff4466';
        m.appendChild(i); pr.appendChild(m);
      } else {
        pr.textContent = 'no dealer';
      }
      row.appendChild(pr);

      var acts = el('div', 'acts');
      var b = el('button', 'mini buy', 'BUY'), s = el('button', 'mini sell', 'SELL');
      b.disabled = !p || E.maxBuy(S, d.id) < 1;
      s.disabled = !p || slot.qty < 1;
      b.addEventListener('click', function () { Snd.tap(); openTrade(d.id, 'buy'); });
      s.addEventListener('click', function () { Snd.tap(); openTrade(d.id, 'sell'); });
      acts.appendChild(b); acts.appendChild(s);
      row.appendChild(acts);
      box.appendChild(row);
    });
  }

  function renderTravel() {
    var nav = $('travel'); nav.textContent = '';
    if (S.over) return;
    if (S.day >= S.maxDays) {
      var end = el('button', 'go end', 'Final day: end the run');
      end.addEventListener('click', function () { Snd.tap(); doTravel(S.loc); });
      nav.appendChild(end);
      return;
    }
    E.PLACES.forEach(function (pl) {
      var b = el('button', 'go' + (pl.id === S.loc ? ' here' : ''), pl.name);
      b.disabled = pl.id === S.loc;
      b.addEventListener('click', function () { Snd.tap(); doTravel(pl.id); });
      nav.appendChild(b);
    });
  }

  function render() { renderHud(); renderMarket(); renderTravel(); }

  function save() {
    if (!S) return;
    if (S.over) store(SAVE_KEY, null); else store(SAVE_KEY, E.serialize(S));
  }

  /* ---------- trading ---------- */
  function openTrade(id, mode) {
    var d = E.drugById(id), p = S.prices[id];
    var max = mode === 'buy' ? E.maxBuy(S, id) : S.inv[id].qty;
    if (!p || max < 1) return;
    var qty = max;
    var big = el('div', 'big'), sub = el('div', 'sub');
    var range = document.createElement('input');
    range.type = 'range'; range.min = 1; range.max = max; range.step = 1; range.value = qty;
    range.id = 'qty-range'; range.setAttribute('aria-label', 'Amount');
    var chips = el('div', 'chips');
    [['1', 1], ['25%', 0.25], ['50%', 0.5], ['MAX', 1]].forEach(function (c, i) {
      var b = el('button', null, c[0]);
      b.addEventListener('click', function () {
        qty = i === 0 ? 1 : Math.max(1, Math.round(max * c[1]));
        range.value = qty; upd();
      });
      chips.appendChild(b);
    });
    var confirmBtn;
    function upd() {
      qty = Math.max(1, Math.min(max, parseInt(range.value, 10) || 1));
      big.textContent = qty + ' × ' + money(p);
      var total = qty * p;
      if (mode === 'buy') {
        sub.textContent = 'Total ' + money(total) + ' · you can afford up to ' + max;
      } else {
        var slot = S.inv[id], basis = slot.qty > 0 ? slot.cost * (qty / slot.qty) : 0;
        var prof = total - basis;
        sub.textContent = 'You get ' + money(total) + ' · ' + (prof >= 0 ? 'profit ' : 'loss ') + money(Math.abs(prof));
      }
      if (confirmBtn) confirmBtn.textContent = (mode === 'buy' ? 'Buy ' : 'Sell ') + qty;
    }
    range.addEventListener('input', upd);
    var wrap = el('div', 'qty');
    wrap.appendChild(big); wrap.appendChild(sub); wrap.appendChild(range); wrap.appendChild(chips);

    openModal({
      title: (mode === 'buy' ? 'Buy ' : 'Sell ') + d.name,
      body: [wrap],
      buttons: [
        { label: 'Cancel', cls: 'ghost', fn: closeModal },
        { label: 'Confirm', cls: mode === 'buy' ? 'good' : 'primary', fn: function () {
          var r = mode === 'buy' ? E.buy(S, id, qty) : E.sell(S, id, qty);
          if (!r.ok) { toast(r.msg, 'loss'); return; }
          closeModal();
          if (mode === 'buy') { Snd.buy(); toast('Bought ' + qty + ' ' + d.name); }
          else {
            Snd.cash(); Scene.cash(Math.min(24, 6 + Math.floor(qty / 4)));
            toast((r.profit >= 0 ? 'Profit ' : 'Loss ') + money(Math.abs(r.profit)), r.profit >= 0 ? 'profit' : 'loss');
            buzz(15);
          }
          render(); save();
        } }
      ]
    });
    confirmBtn = $('m-btns').lastChild;
    upd();
  }

  /* ---------- loan shark and bank ---------- */
  function openShark() {
    function view() {
      var kv = el('div', 'kv');
      [['Cash on you', money(S.cash)], ['In the bank', money(S.bank)], ['You owe the shark', money(S.debt)]].forEach(function (r) {
        kv.appendChild(el('span', null, r[0])); kv.appendChild(el('span', null, r[1]));
      });
      function act(fn, msg) { return function () { var r = fn(); if (!r.ok) { toast(r.msg, 'loss'); return; } Snd.cash(); toast(msg(r)); render(); save(); view(); }; }
      openModal({
        title: 'Big Al’s Back Room',
        body: ['The shark charges 10% a day on what you owe. The bank is safe from muggers but pays nothing.', kv],
        buttons: [
          { label: 'Pay debt', cls: 'good', disabled: S.debt < 1 || S.cash < 1, fn: act(function () { return E.repay(S, S.cash); }, function (r) { return 'Paid ' + money(r.amt); }) },
          { label: 'Borrow $2,000', cls: 'danger', fn: act(function () { return E.borrow(S, 2000); }, function (r) { return 'Borrowed ' + money(r.amt); }) },
          { label: 'Deposit all', disabled: S.cash < 1, fn: act(function () { return E.deposit(S, S.cash); }, function (r) { return 'Deposited ' + money(r.amt); }) },
          { label: 'Withdraw all', disabled: S.bank < 1, fn: act(function () { return E.withdraw(S, S.bank); }, function (r) { return 'Withdrew ' + money(r.amt); }) },
          { label: 'Leave', cls: 'ghost', fn: closeModal }
        ]
      });
    }
    view();
  }

  /* ---------- events ---------- */
  function hurtFx() { Scene.hurt(600); Scene.shake(450); Snd.hit(); buzz(120); shakeWrap(); }
  function shakeWrap() { var w = $('scene-wrap'); w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake'); }

  function runEvents(list, i, done) {
    if (i >= list.length) { done(); return; }
    var ev = list[i];
    function next() { closeModal(); runEvents(list, i + 1, done); }

    if (ev.type === 'info') {
      if (ev.tone === 'bad') { hurtFx(); render(); } else { Snd.cash(); }
      openModal({ title: ev.title, tone: ev.tone, body: [ev.text], buttons: [{ label: 'OK', cls: 'primary', fn: next }] });
    } else if (ev.type === 'offer') {
      openModal({
        title: ev.title, body: [ev.text, 'You have ' + money(S.cash) + '.'],
        buttons: [
          { label: 'Buy it ' + money(ev.price), cls: 'good', disabled: S.cash < ev.price, fn: function () {
            var r = E.acceptOffer(S, ev);
            toast(r.msg, r.ok ? 'profit' : 'loss'); if (r.ok) Snd.buy(); render(); next();
          } },
          { label: 'No thanks', cls: 'ghost', fn: next }
        ]
      });
    } else if (ev.type === 'cops') {
      copsFlow(function (dead) { render(); if (dead) { closeModal(); gameOver(); } else next(); });
    } else if (ev.type === 'dead') {
      closeModal(); gameOver();
    } else if (ev.type === 'end') {
      closeModal(); gameOver();
    } else { next(); }
  }

  function copsFlow(finished) {
    var log = [];
    function head() {
      var n = S.enc.cops;
      return n === 1 ? 'Officer Hardass spots you and he is not in a good mood.'
        : 'Officer Hardass and ' + (n - 1) + (n > 2 ? ' of his deputies' : ' deputy') + ' are on your tail.';
    }
    function logBox() {
      var b = el('div', 'log');
      log.forEach(function (l) { b.appendChild(el('div', 'l', l)); });
      return b;
    }
    function show() {
      Scene.flash('cops', 4000);
      openModal({
        title: 'Cops!', tone: 'cops',
        body: [head(), 'Health ' + S.health + ' · Guns ' + S.guns, logBox()],
        buttons: [
          { label: 'Run', fn: function () { act('run'); } },
          { label: S.guns > 0 ? 'Fight' : 'Fight (no gun)', cls: 'danger', disabled: S.guns < 1, fn: function () { act('fight'); } },
          { label: 'Give up', cls: 'ghost', fn: function () { act('give'); } }
        ]
      });
      Snd.siren(); buzz(60);
    }
    function act(a) {
      var hp0 = S.health;
      var r = E.copAction(S, a);
      log = r.lines.slice();
      if (S.health < hp0) hurtFx();
      if (r.outcome === 'won') { Snd.cash(); Scene.cash(20); }
      if (r.done) {
        Scene.flash('', 0);
        var title = { escaped: 'Got away', won: 'Shootout won', gave: 'Busted', dead: 'You are down' }[r.outcome] || 'Done';
        var tone = r.outcome === 'dead' || r.outcome === 'gave' ? 'bad' : 'good';
        openModal({ title: title, tone: tone, body: [logBox()], buttons: [{ label: 'Continue', cls: 'primary', fn: function () { finished(!!r.dead); } }] });
      } else {
        show();
      }
    }
    show();
  }

  /* ---------- travel and game flow ---------- */
  function doTravel(to) {
    var wasEnd = S.day >= S.maxDays;
    if (!wasEnd) {
      Snd.travel();
      var w = $('scene-wrap'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
    }
    var evs = E.travel(S, to);
    Scene.setPlace(S.loc);
    render();
    runEvents(evs, 0, function () { closeModal(); render(); save(); });
  }

  function gameOver() {
    Snd.over();
    store(SAVE_KEY, null);
    renderHud(); renderMarket(); $('travel').textContent = '';
    var hi = parseInt(load(HIGH_KEY) || '0', 10) || 0;
    var newBest = !S.dead && S.score > hi;
    if (newBest) store(HIGH_KEY, String(S.score));
    var big = el('div', 'score-big', money(0));
    big.style.color = S.score >= 0 ? 'var(--green)' : 'var(--red)';
    var t0 = performance.now(), target = S.score;
    (function tick(now) {
      var k = Math.min(1, (now - t0) / 900);
      big.textContent = money(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
    var kv = el('div', 'kv');
    [['Cash', money(S.cash)], ['Bank', money(S.bank)], ['Debt', money(-S.debt)], ['Cops dropped', String(S.kills)], ['Best score', money(Math.max(hi, S.dead ? 0 : S.score))]].forEach(function (r) {
      kv.appendChild(el('span', null, r[0])); kv.appendChild(el('span', null, r[1]));
    });
    openModal({
      title: S.dead ? 'Dead in the street' : (newBest ? 'New best run' : 'Thirty days are up'),
      tone: S.dead ? 'bad' : 'good',
      body: [S.dead ? 'You did not make it out. Your cash does not count for much now.' : 'Rank: ' + E.rank(S.score), big, kv],
      buttons: [{ label: 'Play again', cls: 'primary', fn: function () { startGame(); } }]
    });
  }

  function startGame() {
    closeModal();
    prev = { cash: null, bank: null, debt: null };
    S = E.newGame();
    Scene.setPlace(S.loc);
    $('intro').hidden = true;
    render(); save();
    openModal({
      title: 'Welcome to Lewistown',
      body: ['You owe Big Al $5,500 and the interest runs 10% a day. You have $2,000, a trench coat and 30 days.', 'Buy where it is cheap, sell where it is dear, and pay the shark before he comes looking.'],
      buttons: [{ label: 'Hit the street', cls: 'primary', fn: closeModal }]
    });
  }

  function continueGame() {
    var raw = load(SAVE_KEY);
    if (!raw) { startGame(); return; }
    try { S = E.restore(raw); } catch (e) { startGame(); return; }
    if (S.over) { startGame(); return; }
    prev = { cash: null, bank: null, debt: null };
    Scene.setPlace(S.loc);
    $('intro').hidden = true;
    render();
  }

  function howTo() {
    openModal({
      title: 'How to play',
      body: [
        'Each day you pick a town. Prices change every trip, and some dealers are not around.',
        'Tap BUY when a price is low (green bar) and SELL when it is high (red bar). Your coat only holds so much.',
        'The loan shark in Lewistown charges 10% interest a day. The Lewistown bank keeps cash safe from muggers.',
        'Cops can show up. Run, fight if you carry a gun, or give up and lose half your stash.',
        'After day 30 everything you carry is sold at local prices. Score is cash plus bank minus debt.'
      ],
      buttons: [{ label: 'Got it', cls: 'primary', fn: closeModal }]
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    Scene.init($('scene'));
    var mute = $('mute');
    mute.setAttribute('aria-pressed', Snd.on ? 'true' : 'false');
    mute.addEventListener('click', function () { Snd.set(!Snd.on); mute.setAttribute('aria-pressed', Snd.on ? 'true' : 'false'); Snd.tap(); });
    $('shark').addEventListener('click', function () { Snd.tap(); openShark(); });
    $('b-new').addEventListener('click', function () { Snd.tap(); startGame(); });
    $('b-cont').addEventListener('click', function () { Snd.tap(); continueGame(); });
    $('b-how').addEventListener('click', function () { Snd.tap(); howTo(); });
    var hi = parseInt(load(HIGH_KEY) || '0', 10) || 0;
    if (hi > 0) $('high').textContent = 'Best score: ' + money(hi);
    if (load(SAVE_KEY)) $('b-cont').hidden = false;
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.__dw = { get state() { return S; }, Engine: E };
  }
  boot();
})();
