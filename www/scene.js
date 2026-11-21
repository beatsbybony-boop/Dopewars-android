/* Animated night-city header. One procedural scene per borough. */
(function () {
  'use strict';

  var THEMES = {
    lewistown:  { name: 'LEWISTOWN',  sky: ['#14082a', '#4a1c5c', '#ff5e7e'], neon: '#ff2e93', rain: false, hm: 0.42 },
    milroy:     { name: 'MILROY',     sky: ['#06101c', '#12304a', '#2b6f8c'], neon: '#27e1ff', rain: true,  hills: 'ridge' },
    reedsville: { name: 'REEDSVILLE', sky: ['#061822', '#164a63', '#f4a259'], neon: '#4cc9f0', rain: false, hm: 0.16 },
    burnham:    { name: 'BURNHAM',    sky: ['#1a0a06', '#5a2210', '#ff7a3d'], neon: '#ff9f1c', rain: false, hm: 0.34 },
    yeagertown: { name: 'YEAGERTOWN', sky: ['#0a0a1f', '#2b1b6b', '#ff8a3d'], neon: '#ffd23f', rain: false, hm: 0.26 },
    belleville: { name: 'BELLEVILLE', sky: ['#04100f', '#0c3a2f', '#2a8f6a'], neon: '#7dff6a', rain: false, hills: 'rolling' }
  };


  var cv, ctx, W = 0, H = 0, dpr = 1;
  var theme = THEMES.lewistown, id = 'lewistown';
  var t = 0, last = 0, running = false;
  var far, mid, near, wins = [], stars = [], rain = [], parts = [];
  var flash = { kind: '', until: 0 }, shakeUntil = 0, hurtUntil = 0;
  var reduce = false;

  function seeded(n) {
    var a = n >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var x = Math.imul(a ^ (a >>> 15), 1 | a);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashId(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  function layer(r, minH, maxH, minW, maxW, gap) {
    var out = [], x = -10;
    while (x < W + 20) {
      var w = minW + r() * (maxW - minW);
      out.push({ x: x, w: w, h: minH + r() * (maxH - minH) });
      x += w + r() * gap;
    }
    return out;
  }

  function build() {
    var r = seeded(hashId(id));
    var hm = theme.hm || 0.4;
    far = layer(r, H * 0.12, H * hm * 0.85, 22, 46, 4);
    mid = layer(r, H * 0.14, H * hm, 26, 56, 6);
    near = layer(r, H * 0.08, H * 0.22, 40, 90, 24);
    if (theme.hills) { far = []; mid = []; near = []; }
    wins = [];
    mid.forEach(function (b) {
      for (var wx = b.x + 5; wx < b.x + b.w - 6; wx += 9) {
        for (var wy = H * 0.78 - b.h + 8; wy < H * 0.78 - 8; wy += 11) {
          if (r() < 0.38) wins.push({ x: wx, y: wy, ph: r() * 6.28, sp: 0.4 + r() * 1.6, c: r() < 0.7 ? 0 : 1 });
        }
      }
    });
    stars = [];
    for (var i = 0; i < 45; i++) stars.push({ x: r() * W, y: r() * H * 0.45, s: r() * 1.4 + 0.3, ph: r() * 6.28 });
    rain = [];
    if (theme.rain) for (var j = 0; j < 70; j++) rain.push({ x: r() * W, y: r() * H, v: 260 + r() * 220, l: 6 + r() * 8 });
  }

  function resize() {
    if (!cv) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = cv.getBoundingClientRect();
    W = Math.max(280, Math.round(rect.width));
    H = Math.round(rect.height) || 190;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    build();
  }

  function init(canvas) {
    cv = canvas;
    ctx = cv.getContext('2d');
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
    resize();
    window.addEventListener('resize', resize);
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  }

  function setPlace(pid) {
    if (!THEMES[pid]) return;
    id = pid; theme = THEMES[pid];
    build();
  }

  function setFlash(kind, ms) { flash.kind = kind; flash.until = performance.now() + ms; }
  function shake(ms) { shakeUntil = performance.now() + ms; }
  function hurt(ms) { hurtUntil = performance.now() + ms; }
  function cash(n) {
    for (var i = 0; i < Math.min(n || 10, 24); i++) {
      parts.push({ x: W * (0.15 + Math.random() * 0.7), y: H * 0.8, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 70, life: 1.2 + Math.random() * 0.6, age: 0, ch: Math.random() < 0.75 ? '$' : '+' });
    }
  }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.8);
    g.addColorStop(0, theme.sky[0]); g.addColorStop(0.55, theme.sky[1]); g.addColorStop(1, theme.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + s.ph));
      ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
    // moon
    var mx = W * 0.82, my = H * 0.22;
    var mg = ctx.createRadialGradient(mx, my, 2, mx, my, 34);
    mg.addColorStop(0, 'rgba(255,248,220,0.95)'); mg.addColorStop(0.3, 'rgba(255,240,200,0.25)'); mg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - 40, my - 40, 80, 80);
    ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(mx, my, 8, 0, 6.2832); ctx.fill();
  }

  function drawLayer(arr, color, base) {
    ctx.fillStyle = color;
    for (var i = 0; i < arr.length; i++) ctx.fillRect(arr[i].x, base - arr[i].h, arr[i].w, arr[i].h);
  }

  function ridge(base, amp, freq, phase, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, base);
    for (var x = 0; x <= W; x += 6) {
      var y = base - amp * (0.55 + 0.3 * Math.sin(x * freq + phase) + 0.15 * Math.sin(x * freq * 2.3 + phase * 1.7));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, base); ctx.closePath(); ctx.fill();
  }

  function drawHills() {
    var base = H * 0.78;
    if (theme.hills === 'ridge') {
      ridge(base, H * 0.62, 0.011, 1.2, '#0a1626');
      ridge(base, H * 0.4, 0.017, 4.1, '#07101c');
      ridge(base, H * 0.2, 0.024, 2.2, '#040a12');
    } else {
      ridge(base, H * 0.26, 0.008, 0.6, '#0a2a22');
      ridge(base, H * 0.18, 0.013, 3.3, '#06201a');
      ridge(base, H * 0.1, 0.02, 5.1, '#031510');
      // plowed field rows
      ctx.strokeStyle = 'rgba(125,255,106,0.12)'; ctx.lineWidth = 1;
      for (var i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, base - i * 4); ctx.lineTo(W, base - i * 4 - i * 1.5); ctx.stroke(); }
    }
  }

  function glowDot(x, y, r, color) {
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawSpecial() {
    var base = H * 0.78;
    if (id === 'lewistown') {
      // courthouse clock tower
      var sx = W * 0.58, top = base - H * 0.56;
      ctx.fillStyle = '#0a0814';
      ctx.fillRect(sx, top, 20, base - top);
      ctx.beginPath(); ctx.moveTo(sx - 3, top); ctx.lineTo(sx + 10, top - 22); ctx.lineTo(sx + 23, top); ctx.fill();
      ctx.fillRect(sx + 9, top - 34, 2, 12);
      var cx = sx + 10, cy = top + 20;
      glowDot(cx, cy, 22, 'rgba(255,230,160,0.45)');
      ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = '#0a0814'; ctx.lineWidth = 1.4;
      var ma = t * 0.4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ma) * 5.5, cy + Math.sin(ma) * 5.5);
      ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ma / 12 + 1) * 3.5, cy + Math.sin(ma / 12 + 1) * 3.5); ctx.stroke();
    } else if (id === 'milroy') {
      // lit cabin on the ridge
      var kx = W * 0.66, ky = base - H * 0.2;
      ctx.fillStyle = '#02060c';
      ctx.fillRect(kx, ky, 24, 14);
      ctx.beginPath(); ctx.moveTo(kx - 3, ky); ctx.lineTo(kx + 12, ky - 10); ctx.lineTo(kx + 27, ky); ctx.fill();
      glowDot(kx + 8, ky + 7, 18, 'rgba(255,190,90,0.5)');
      ctx.fillStyle = '#ffd37a'; ctx.fillRect(kx + 5, ky + 4, 6, 6);
    } else if (id === 'reedsville') {
      // truss bridge
      var x1 = W * 0.12, x2 = W * 0.88, deck = base - 12, topc = deck - 34;
      ctx.strokeStyle = theme.neon; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.85; ctx.shadowColor = theme.neon; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(x1, deck); ctx.lineTo(x1 + 18, topc); ctx.lineTo(x2 - 18, topc); ctx.lineTo(x2, deck); ctx.stroke();
      var step = (x2 - x1 - 36) / 12;
      ctx.lineWidth = 1;
      for (var k = 0; k <= 12; k++) {
        var px = x1 + 18 + k * step;
        ctx.beginPath(); ctx.moveTo(px, topc); ctx.lineTo(px, deck); ctx.stroke();
        if (k < 12) { ctx.beginPath(); ctx.moveTo(px, deck); ctx.lineTo(px + step, topc); ctx.stroke(); }
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      ctx.fillStyle = '#05080f'; ctx.fillRect(0, deck, W, 5);
      ctx.fillRect(W * 0.3, deck, 6, base - deck + 2); ctx.fillRect(W * 0.7, deck, 6, base - deck + 2);
    } else if (id === 'burnham') {
      // steel works: stacks, glow and smoke
      glowDot(W * 0.7, base - 6, 90, 'rgba(255,120,40,0.35)');
      var stacks = [[0.56, 0.62, 15], [0.66, 0.5, 13], [0.76, 0.58, 15]];
      stacks.forEach(function (st, si) {
        var x = W * st[0], h = H * st[1], w = st[2];
        ctx.fillStyle = '#0a0604';
        ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + 2, base - h); ctx.lineTo(x + w - 2, base - h); ctx.lineTo(x + w, base); ctx.fill();
        ctx.fillStyle = theme.neon; ctx.globalAlpha = 0.85; ctx.fillRect(x + 2, base - h, w - 4, 2); ctx.globalAlpha = 1;
        for (var p = 0; p < 6; p++) {
          var prog = ((t * 0.22 + p / 6 + si * 0.17) % 1);
          var py = base - h - prog * 70, px2 = x + w / 2 + Math.sin(prog * 5 + si) * 10 + prog * 18;
          ctx.globalAlpha = 0.34 * (1 - prog);
          ctx.fillStyle = '#9a8a86';
          ctx.beginPath(); ctx.arc(px2, py, 4 + prog * 12, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
      });
      ctx.fillStyle = '#0a0604'; ctx.fillRect(W * 0.52, base - H * 0.16, W * 0.34, H * 0.16);
      var fl = 0.55 + 0.45 * Math.sin(t * 6);
      ctx.fillStyle = 'rgba(255,150,60,' + fl + ')';
      for (var q = 0; q < 6; q++) ctx.fillRect(W * 0.54 + q * (W * 0.05), base - H * 0.1, 9, 6);
    } else if (id === 'yeagertown') {
      // water tower and power poles
      var wx = W * 0.62, legsTop = base - H * 0.34;
      ctx.fillStyle = '#080614';
      ctx.fillRect(wx, legsTop, 3, H * 0.34); ctx.fillRect(wx + 25, legsTop, 3, H * 0.34);
      ctx.beginPath(); ctx.moveTo(wx, legsTop + 20); ctx.lineTo(wx + 28, base); ctx.moveTo(wx + 28, legsTop + 20); ctx.lineTo(wx, base); ctx.strokeStyle = '#080614'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillRect(wx - 6, legsTop - 30, 40, 30);
      ctx.beginPath(); ctx.moveTo(wx - 6, legsTop - 30); ctx.lineTo(wx + 14, legsTop - 42); ctx.lineTo(wx + 34, legsTop - 30); ctx.fill();
      ctx.fillStyle = theme.neon; ctx.globalAlpha = 0.8; ctx.fillRect(wx - 6, legsTop - 18, 40, 2); ctx.globalAlpha = 1;
      var pox = [W * 0.08, W * 0.4, W * 0.9];
      ctx.strokeStyle = '#05040a'; ctx.lineWidth = 2;
      pox.forEach(function (x, i) {
        ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, base - H * 0.42); ctx.moveTo(x - 9, base - H * 0.38); ctx.lineTo(x + 9, base - H * 0.38); ctx.stroke();
        if (i < pox.length - 1) {
          ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 9, base - H * 0.38); ctx.quadraticCurveTo((x + pox[i + 1]) / 2, base - H * 0.3, pox[i + 1] - 9, base - H * 0.38); ctx.stroke(); ctx.lineWidth = 2;
        }
      });
      var bl = Math.sin(t * 3) > 0;
      ctx.fillStyle = bl ? '#ff3b3b' : '#5a1010'; ctx.beginPath(); ctx.arc(wx + 14, legsTop - 46, 2, 0, 6.2832); ctx.fill();
    } else if (id === 'belleville') {
      // barn and silo
      var bx = W * 0.6, bw = 62, bh = 30;
      ctx.fillStyle = '#021410';
      ctx.fillRect(bx, base - bh, bw, bh);
      ctx.beginPath(); ctx.moveTo(bx - 4, base - bh); ctx.lineTo(bx + 12, base - bh - 16); ctx.lineTo(bx + bw - 12, base - bh - 16); ctx.lineTo(bx + bw + 4, base - bh); ctx.fill();
      ctx.fillRect(bx + bw + 4, base - 54, 15, 54);
      ctx.beginPath(); ctx.arc(bx + bw + 11.5, base - 54, 7.5, Math.PI, 0); ctx.fill();
      glowDot(bx + 18, base - 12, 20, 'rgba(255,190,90,0.4)');
      ctx.fillStyle = '#ffd37a'; ctx.fillRect(bx + 14, base - 16, 8, 10);
      ctx.strokeStyle = '#021410'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + 14, base - 16); ctx.lineTo(bx + 22, base - 6); ctx.moveTo(bx + 22, base - 16); ctx.lineTo(bx + 14, base - 6); ctx.stroke();
    }
  }

  function drawWindows() {
    for (var i = 0; i < wins.length; i++) {
      var w = wins[i];
      var v = reduce ? 0.8 : 0.5 + 0.5 * Math.sin(t * w.sp + w.ph);
      if (v < 0.25) continue;
      ctx.globalAlpha = Math.min(1, v);
      ctx.fillStyle = w.c ? theme.neon : '#ffe9a8';
      ctx.fillRect(w.x, w.y, 4, 5);
    }
    ctx.globalAlpha = 1;
  }

  function drawStreet() {
    var base = H * 0.78;
    var g = ctx.createLinearGradient(0, base, 0, H);
    g.addColorStop(0, '#16121f'); g.addColorStop(1, '#07060b');
    ctx.fillStyle = g; ctx.fillRect(0, base, W, H - base);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, base, W, 2);
    // neon reflections
    for (var i = 0; i < 6; i++) {
      var x = (i + 0.5) * (W / 6) + Math.sin(t * 0.6 + i) * 6;
      var rg = ctx.createLinearGradient(0, base, 0, H);
      rg.addColorStop(0, theme.neon); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.18; ctx.fillStyle = rg; ctx.fillRect(x - 4, base + 2, 8, H - base);
    }
    ctx.globalAlpha = 1;
    // dashed lane
    ctx.fillStyle = 'rgba(255,220,120,0.35)';
    var off = reduce ? 0 : (t * 30) % 36;
    for (var d = -36; d < W + 36; d += 36) ctx.fillRect(d + off, H - 10, 18, 2);
  }

  function drawDealer() {
    var x = W * 0.16, y = H * 0.9;
    var bob = reduce ? 0 : Math.sin(t * 2.2) * 1.2;
    var low = hurtUntil > performance.now();
    ctx.save(); ctx.translate(x, y + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(0, 4, 18, 4, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = low ? '#3b0f12' : '#0c0a14';
    ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(-10, -38); ctx.lineTo(10, -38); ctx.lineTo(14, 2); ctx.closePath(); ctx.fill();   // coat
    ctx.fillRect(-8, -52, 16, 15);                                                                                                    // head
    ctx.fillRect(-14, -54, 28, 4); ctx.fillRect(-8, -62, 16, 9);                                                                      // hat
    ctx.fillStyle = theme.neon; ctx.globalAlpha = 0.9; ctx.fillRect(-8, -54, 16, 1.5); ctx.globalAlpha = 1;                          // hat band
    ctx.strokeStyle = theme.neon; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.65; ctx.shadowColor = theme.neon; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(-14, 2); ctx.lineTo(-10, -38); ctx.lineTo(10, -38); ctx.lineTo(14, 2); ctx.stroke();                 // rim light
    ctx.restore(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  function drawSign() {
    var on = reduce || Math.sin(t * 17) > -0.92 || (t % 7) < 6.4;
    ctx.save();
    ctx.font = '900 20px "Arial Black", Impact, "Helvetica Neue", sans-serif';
    ctx.textBaseline = 'top';
    var txt = theme.name;
    var tw = ctx.measureText(txt).width;
    var x = 12, y = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x - 6, y - 4, tw + 12, 30);
    ctx.strokeStyle = theme.neon; ctx.globalAlpha = on ? 0.9 : 0.3; ctx.lineWidth = 1.5;
    ctx.shadowColor = theme.neon; ctx.shadowBlur = on ? 14 : 2;
    ctx.strokeRect(x - 6, y - 4, tw + 12, 30);
    ctx.fillStyle = on ? '#fff' : theme.neon; ctx.globalAlpha = on ? 1 : 0.5;
    ctx.fillText(txt, x, y);
    ctx.restore();
  }

  function drawRain(dt) {
    if (!rain.length) return;
    ctx.strokeStyle = 'rgba(170,210,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < rain.length; i++) {
      var r = rain[i];
      if (!reduce) { r.y += r.v * dt; r.x -= 40 * dt; }
      if (r.y > H) { r.y = -10; r.x = Math.random() * (W + 40); }
      ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 2, r.y + r.l);
    }
    ctx.stroke();
  }

  function drawParts(dt) {
    ctx.font = '700 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i]; p.age += dt;
      if (p.age > p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt;
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = '#5dff8a'; ctx.shadowColor = '#5dff8a'; ctx.shadowBlur = 8;
      ctx.fillText(p.ch, p.x, p.y);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.textAlign = 'left';
  }

  function drawFlash(now) {
    if (now > flash.until) return;
    var k = flash.kind, ph = Math.floor(now / 180) % 2;
    var a = 0.28 + 0.18 * Math.sin(now / 60);
    var gl = ctx.createLinearGradient(0, 0, W, 0);
    if (k === 'cops') {
      gl.addColorStop(0, ph ? 'rgba(255,40,60,' + a + ')' : 'rgba(40,90,255,' + a + ')');
      gl.addColorStop(0.5, 'rgba(0,0,0,0)');
      gl.addColorStop(1, ph ? 'rgba(40,90,255,' + a + ')' : 'rgba(255,40,60,' + a + ')');
    } else {
      gl.addColorStop(0, 'rgba(255,255,255,' + a * 0.5 + ')'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!ctx || !W) return;
    var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    if (now < shakeUntil && !reduce) ctx.translate((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5);
    drawSky();
    var base = H * 0.78;
    if (theme.hills) drawHills();
    drawLayer(far, 'rgba(10,6,24,0.55)', base);
    drawLayer(mid, '#0b0814', base);
    drawWindows();
    drawSpecial();
    drawLayer(near, '#05040a', base);
    drawStreet();
    drawDealer();
    drawRain(dt);
    drawSign();
    drawParts(dt);
    drawFlash(now);
    if (hurtUntil > now) { ctx.fillStyle = 'rgba(255,0,30,' + 0.35 * ((hurtUntil - now) / 600) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  window.Scene = { init: init, setPlace: setPlace, flash: setFlash, shake: shake, hurt: hurt, cash: cash, resize: resize };
})();
