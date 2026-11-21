/* Dope Wars engine: pure game rules, no DOM. Works in the browser and in Node. */
(function (root) {
  'use strict';

  var DRUGS = [
    { id: 'cocaine', name: 'Cocaine', min: 15000, max: 29000, color: '#f2f2ff' },
    { id: 'heroin', name: 'Heroin', min: 5000, max: 14000, color: '#e0b030' },
    { id: 'acid', name: 'Acid', min: 1000, max: 4400, color: '#b565ff' },
    { id: 'hash', name: 'Hashish', min: 480, max: 1280, color: '#b07a3c' },
    { id: 'peyote', name: 'Peyote', min: 220, max: 700, color: '#59c36a' },
    { id: 'weed', name: 'Weed', min: 315, max: 890, color: '#3fdc6b' },
    { id: 'speed', name: 'Speed', min: 70, max: 250, color: '#ff5fa2' },
    { id: 'ludes', name: 'Ludes', min: 11, max: 60, color: '#5ec8ff' }
  ];

  var PLACES = [
    { id: 'bronx', name: 'Bronx', bank: true },
    { id: 'ghetto', name: 'Ghetto' },
    { id: 'park', name: 'Central Park' },
    { id: 'manhattan', name: 'Manhattan' },
    { id: 'coney', name: 'Coney Island' },
    { id: 'brooklyn', name: 'Brooklyn' }
  ];

  var GUN_SPACE = 5;
  var MAX_DEBT = 60000;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drugById(id) {
    for (var i = 0; i < DRUGS.length; i++) if (DRUGS[i].id === id) return DRUGS[i];
    return null;
  }
  function placeById(id) {
    for (var i = 0; i < PLACES.length; i++) if (PLACES[i].id === id) return PLACES[i];
    return null;
  }
  function randInt(s, lo, hi) { return lo + Math.floor(s.rng() * (hi - lo + 1)); }
  function pick(s, arr) { return arr[Math.floor(s.rng() * arr.length)]; }

  function newGame(rng) {
    var s = {
      rng: rng || Math.random,
      day: 1, maxDays: 30,
      cash: 2000, bank: 0, debt: 5500,
      health: 100, guns: 0, coat: 100,
      inv: {}, loc: 'bronx', prices: {},
      kills: 0, over: false, dead: false, score: 0,
      enc: null
    };
    DRUGS.forEach(function (d) { s.inv[d.id] = { qty: 0, cost: 0 }; });
    rollPrices(s);
    return s;
  }

  function carried(s) {
    var n = 0;
    DRUGS.forEach(function (d) { n += s.inv[d.id].qty; });
    return n;
  }
  function used(s) { return carried(s) + s.guns * GUN_SPACE; }
  function freeSpace(s) { return Math.max(0, s.coat - used(s)); }

  function rollPrices(s) {
    s.prices = {};
    var present = 0;
    DRUGS.forEach(function (d) {
      if (s.rng() < 0.86) {
        s.prices[d.id] = Math.round(d.min + s.rng() * (d.max - d.min));
        present++;
      }
    });
    var i = 0;
    while (present < 5 && i < 50) {
      var d = pick(s, DRUGS); i++;
      if (!s.prices[d.id]) {
        s.prices[d.id] = Math.round(d.min + s.rng() * (d.max - d.min));
        present++;
      }
    }
  }

  function maxBuy(s, id) {
    var p = s.prices[id];
    if (!p) return 0;
    return Math.max(0, Math.min(Math.floor(s.cash / p), freeSpace(s)));
  }

  function buy(s, id, qty) {
    var p = s.prices[id];
    qty = Math.floor(qty);
    if (!p) return { ok: false, msg: 'Nobody is selling that here today.' };
    if (!(qty > 0)) return { ok: false, msg: 'Pick an amount first.' };
    if (qty * p > s.cash) return { ok: false, msg: 'Not enough cash.' };
    if (qty > freeSpace(s)) return { ok: false, msg: 'Your coat is full.' };
    s.cash -= qty * p;
    s.inv[id].qty += qty;
    s.inv[id].cost += qty * p;
    return { ok: true, spent: qty * p };
  }

  function sell(s, id, qty) {
    var p = s.prices[id];
    var slot = s.inv[id];
    qty = Math.floor(qty);
    if (!p) return { ok: false, msg: 'Nobody is buying that here today.' };
    if (!(qty > 0)) return { ok: false, msg: 'Pick an amount first.' };
    if (qty > slot.qty) return { ok: false, msg: "You don't have that many." };
    var basis = slot.qty > 0 ? Math.round(slot.cost * (qty / slot.qty)) : 0;
    var revenue = qty * p;
    s.cash += revenue;
    slot.qty -= qty;
    slot.cost = slot.qty === 0 ? 0 : Math.max(0, slot.cost - basis);
    return { ok: true, revenue: revenue, profit: revenue - basis };
  }

  function atBank(s) { return !!placeById(s.loc).bank; }

  function repay(s, amt) {
    if (!atBank(s)) return { ok: false, msg: 'The loan shark only works the Bronx.' };
    amt = Math.floor(Math.min(amt, s.cash, s.debt));
    if (amt <= 0) return { ok: false, msg: 'Nothing to pay.' };
    s.cash -= amt; s.debt -= amt;
    return { ok: true, amt: amt };
  }
  function borrow(s, amt) {
    if (!atBank(s)) return { ok: false, msg: 'The loan shark only works the Bronx.' };
    amt = Math.floor(Math.min(amt, MAX_DEBT - s.debt));
    if (amt <= 0) return { ok: false, msg: 'The shark says you owe enough already.' };
    s.cash += amt; s.debt += amt;
    return { ok: true, amt: amt };
  }
  function deposit(s, amt) {
    if (!atBank(s)) return { ok: false, msg: 'The bank is in the Bronx.' };
    amt = Math.floor(Math.min(amt, s.cash));
    if (amt <= 0) return { ok: false, msg: 'No cash to deposit.' };
    s.cash -= amt; s.bank += amt;
    return { ok: true, amt: amt };
  }
  function withdraw(s, amt) {
    if (!atBank(s)) return { ok: false, msg: 'The bank is in the Bronx.' };
    amt = Math.floor(Math.min(amt, s.bank));
    if (amt <= 0) return { ok: false, msg: 'Nothing in the bank.' };
    s.bank -= amt; s.cash += amt;
    return { ok: true, amt: amt };
  }

  function damage(s, n) {
    s.health = Math.max(0, s.health - n);
    if (s.health <= 0) die(s);
  }
  function die(s) {
    s.dead = true; s.over = true; s.enc = null;
    s.score = s.cash + s.bank - s.debt;
  }

  function sellPriceForFinish(s, d) {
    return s.prices[d.id] || d.min;
  }

  function finish(s) {
    if (s.over) return;
    DRUGS.forEach(function (d) {
      s.cash += s.inv[d.id].qty * sellPriceForFinish(s, d);
      s.inv[d.id].qty = 0; s.inv[d.id].cost = 0;
    });
    s.over = true;
    s.score = s.cash + s.bank - s.debt;
  }

  function priceEvent(s, ev) {
    var present = DRUGS.filter(function (d) { return s.prices[d.id]; });
    var d = pick(s, present);
    var city = placeById(s.loc).name;
    if (s.rng() < 0.5) {
      var mult = 2 + s.rng() * 2.2;
      s.prices[d.id] = Math.round(s.prices[d.id] * mult);
      ev.push({
        type: 'info', tone: 'good', title: 'Prices spike',
        text: pick(s, [
          'A stash house got raided. ' + d.name + ' is almost impossible to find in ' + city + '.',
          'Word is a shipment of ' + d.name + ' never showed. Buyers in ' + city + ' are desperate.'
        ]) + ' If you are carrying some, sell!'
      });
    } else {
      var div = 2 + s.rng() * 3;
      s.prices[d.id] = Math.max(1, Math.round(s.prices[d.id] / div));
      ev.push({
        type: 'info', tone: 'good', title: 'Fire sale',
        text: 'A shipment of ' + d.name + ' just flooded ' + city + '. It is dirt cheap right now.'
      });
    }
  }

  function travel(s, to) {
    var ev = [];
    if (s.over) return ev;
    if (!placeById(to)) return ev;
    if (s.day >= s.maxDays) {
      finish(s);
      ev.push({ type: 'end' });
      return ev;
    }
    s.day++;
    s.loc = to;
    if (s.debt > 0) s.debt = Math.ceil(s.debt * 1.10);
    rollPrices(s);
    var r = s.rng;

    if (r() < 0.2) priceEvent(s, ev);

    if (r() < 0.07 && freeSpace(s) > 0) {
      var cand = pick(s, DRUGS.filter(function (d) { return d.max < 1500; }));
      var n = Math.min(randInt(s, 3, 12), freeSpace(s));
      s.inv[cand.id].qty += n;
      ev.push({ type: 'info', tone: 'good', title: 'Lucky find',
        text: 'You found ' + n + ' ' + cand.name + ' stuffed in a subway seat. Finders keepers.' });
    }

    if (r() < 0.1 && s.cash > 200) {
      if (s.guns > 0 && r() < 0.5) {
        ev.push({ type: 'info', tone: 'good', title: 'Stick-up scared off',
          text: 'Two guys tried to jump you. They saw what you were packing and changed their minds.' });
      } else {
        var lost = Math.floor(s.cash * (0.12 + r() * 0.25));
        s.cash -= lost;
        var hurt = randInt(s, 0, 10);
        var t = 'You got mugged in an alley and lost $' + lost.toLocaleString('en-US') + '.';
        if (hurt) t += ' You took ' + hurt + ' damage.';
        ev.push({ type: 'info', tone: 'bad', title: 'Mugged', text: t, shake: true });
        if (hurt) damage(s, hurt);
        if (s.dead) { ev.push({ type: 'dead' }); return ev; }
      }
    }

    var copChance = carried(s) > 0 ? Math.min(0.34, 0.12 + 0.01 * s.day) : 0.04;
    if (r() < copChance) {
      var cops = 1 + (s.day > 8 && r() < 0.5 ? 1 : 0) + (s.day > 18 && r() < 0.4 ? 1 : 0);
      s.enc = { cops: cops, start: cops, rounds: 0 };
      ev.push({ type: 'cops', cops: cops });
    }

    if (r() < 0.08) {
      var cp = randInt(s, 150, 450);
      ev.push({ type: 'offer', kind: 'coat', price: cp, extra: 40, title: 'Bigger coat',
        text: 'A tailor on the corner offers a custom trench coat with deep pockets. +40 carrying space for $' + cp + '.' });
    }
    if (r() < 0.07 && s.guns < 4) {
      var gp = randInt(s, 280, 650);
      ev.push({ type: 'offer', kind: 'gun', price: gp, title: 'Piece for sale',
        text: 'A guy in a doorway sells you a handgun for $' + gp + '. It takes up ' + GUN_SPACE + ' space.' });
    }
    if (r() < 0.06 && s.health < 100) {
      var hp = 300 + randInt(s, 0, 400);
      ev.push({ type: 'offer', kind: 'clinic', price: hp, title: 'Back-alley doctor',
        text: 'A doctor with no questions will patch you up to full health for $' + hp + '.' });
    }
    return ev;
  }

  function acceptOffer(s, o) {
    if (s.cash < o.price) return { ok: false, msg: 'You cannot afford that.' };
    if (o.kind === 'coat') { s.cash -= o.price; s.coat += o.extra; return { ok: true, msg: 'New coat on. Space is now ' + s.coat + '.' }; }
    if (o.kind === 'gun') {
      if (freeSpace(s) < GUN_SPACE) return { ok: false, msg: 'No room in your coat for it.' };
      s.cash -= o.price; s.guns++; return { ok: true, msg: 'You are packing now.' };
    }
    if (o.kind === 'clinic') { s.cash -= o.price; s.health = 100; return { ok: true, msg: 'Good as new.' }; }
    return { ok: false, msg: '' };
  }

  /* Police encounter. action: 'run' | 'fight' | 'give' */
  function copAction(s, action) {
    var e = s.enc;
    if (!e) return { done: true, lines: [] };
    var lines = [];
    var r = s.rng;
    e.rounds++;

    function copsShoot() {
      var dmg = 0;
      for (var i = 0; i < e.cops; i++) if (r() < 0.55) dmg += randInt(s, 4, 13);
      if (dmg > 0) { lines.push('They open fire. You take ' + dmg + ' damage.'); damage(s, dmg); }
      else lines.push('Shots go wide. Nobody hit.');
    }

    if (action === 'give') {
      var fine = Math.floor(s.cash * 0.2);
      s.cash -= fine;
      DRUGS.forEach(function (d) {
        var slot = s.inv[d.id];
        var taken = Math.floor(slot.qty * 0.5);
        slot.cost = slot.qty > 0 ? Math.round(slot.cost * ((slot.qty - taken) / slot.qty)) : 0;
        slot.qty -= taken;
      });
      s.enc = null;
      lines.push('You put your hands up. They take half your stash and a $' + fine.toLocaleString('en-US') + ' fine, then let you walk.');
      return { done: true, outcome: 'gave', lines: lines, dead: false };
    }

    if (action === 'run') {
      var chance = 0.45 + (s.guns > 0 ? 0.05 : 0) - 0.08 * (e.cops - 1);
      if (r() < chance) {
        s.enc = null;
        lines.push('You cut through a laundromat and lose them in the crowd.');
        return { done: true, outcome: 'escaped', lines: lines, dead: false };
      }
      lines.push('You are not fast enough.');
      copsShoot();
      if (s.dead) return { done: true, outcome: 'dead', lines: lines, dead: true };
      return { done: false, lines: lines, cops: e.cops };
    }

    if (action === 'fight') {
      if (s.guns < 1) {
        lines.push('You have nothing to shoot with.');
        return { done: false, lines: lines, cops: e.cops, noGun: true };
      }
      var p = Math.min(0.85, 0.22 + 0.22 * s.guns);
      var down = 0;
      for (var i = 0; i < e.cops; i++) if (r() < p) down++;
      e.cops -= down; s.kills += down;
      if (down) lines.push('You drop ' + down + (down > 1 ? ' officers.' : ' officer.'));
      else lines.push('You miss every shot.');
      if (e.cops <= 0) {
        var bounty = 0;
        for (var k = 0; k < e.start; k++) bounty += randInt(s, 300, 1100);
        s.cash += bounty;
        s.enc = null;
        lines.push('The coast is clear. You grab $' + bounty.toLocaleString('en-US') + ' from their wallets and go.');
        return { done: true, outcome: 'won', lines: lines, dead: false };
      }
      copsShoot();
      if (s.dead) return { done: true, outcome: 'dead', lines: lines, dead: true };
      return { done: false, lines: lines, cops: e.cops };
    }
    return { done: false, lines: lines, cops: e.cops };
  }

  var RANKS = [
    [-Infinity, 'Busted and Broke'],
    [1, 'Corner Kid'],
    [10000, 'Street Hustler'],
    [50000, 'Block Boss'],
    [150000, 'Kingpin'],
    [500000, 'Legend of the Five Boroughs']
  ];
  function rank(score) {
    var name = RANKS[0][1];
    for (var i = 0; i < RANKS.length; i++) if (score >= RANKS[i][0]) name = RANKS[i][1];
    return name;
  }

  function serialize(s) {
    var c = {};
    for (var k in s) if (k !== 'rng') c[k] = s[k];
    return JSON.stringify(c);
  }
  function restore(json) {
    var s = JSON.parse(json);
    s.rng = Math.random;
    return s;
  }

  var api = {
    DRUGS: DRUGS, PLACES: PLACES, GUN_SPACE: GUN_SPACE, MAX_DEBT: MAX_DEBT,
    mulberry32: mulberry32, drugById: drugById, placeById: placeById,
    newGame: newGame, carried: carried, used: used, freeSpace: freeSpace,
    maxBuy: maxBuy, buy: buy, sell: sell, atBank: atBank,
    repay: repay, borrow: borrow, deposit: deposit, withdraw: withdraw,
    travel: travel, acceptOffer: acceptOffer, copAction: copAction,
    finish: finish, rank: rank, serialize: serialize, restore: restore
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
