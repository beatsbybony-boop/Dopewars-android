/* Animated night-city header. One procedural scene per borough. */
(function () {
  'use strict';

  var THEMES = {
    bronx:     { name: 'BRONX',        sky: ['#14082a', '#4a1c5c', '#ff5e7e'], neon: '#ff2e93', rain: false },
    ghetto:    { name: 'GHETTO',       sky: ['#06101c', '#12304a', '#2b6f8c'], neon: '#27e1ff', rain: true },
    park:      { name: 'CENTRAL PARK', sky: ['#04100f', '#0c3a2f', '#2a8f6a'], neon: '#7dff6a', rain: false },
    manhattan: { name: 'MANHATTAN',    sky: ['#0a0a1f', '#2b1b6b', '#ff8a3d'], neon: '#ffd23f', rain: false },
    coney:     { name: 'CONEY ISLAND', sky: ['#16061f', '#5a1a6b', '#ff4fa3'], neon: '#ff9f1c', rain: false },
    brooklyn:  { name: 'BROOKLYN',     sky: ['#061822', '#164a63', '#f4a259'], neon: '#4cc9f0', rain: true }
  };

  var cv, ctx, W = 0, H = 0, dpr = 1;
  var theme = THEMES.bronx, id = 'bronx';
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
    var tall = id === 'manhattan';
    far = layer(r, H * 0.18, H * (tall ? 0.6 : 0.4), 22, 46, 4);
    mid = layer(r, H * 0.2, H * (tall ? 0.72 : 0.5), 26, 56, 6);
    near = layer(r, H * 0.12, H * 0.3, 40, 90, 24);
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

  function drawSpecial() {
    var base = H * 0.78;
    if (id === 'coney') {
      var cx = W * 0.7, cy = base - 62, R = 50;
      ctx.strokeStyle = theme.neon; ctx.lineWidth = 2; ctx.shadowColor = theme.neon; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, 6.2832); ctx.stroke();
      var a0 = t * 0.35;
      for (var i = 0; i < 8; i++) {
        var a = a0 + i * 0.7854, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = i % 2 ? '#ffe14d' : '#ff4fa3';
        ctx.fillRect(x - 3, y - 2, 6, 6);
      }
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 24, base); ctx.moveTo(cx, cy); ctx.lineTo(cx + 24, base); ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (id === 'brooklyn') {
      var tx1 = W * 0.2, tx2 = W * 0.8, top = base - H * 0.55;
      ctx.fillStyle = '#071018';
      [tx1, tx2].forEach(function (x) {
        ctx.fillRect(x - 12, top, 7, base - top); ctx.fillRect(x + 5, top, 7, base - top);
        ctx.beginPath(); ctx.moveTo(x - 12, top + 18); ctx.quadraticCurveTo(x, top - 8, x + 12, top + 18); ctx.lineTo(x + 12, top + 28); ctx.quadraticCurveTo(x, top + 4, x - 12, top + 28); ctx.fill();
      });
      ctx.strokeStyle = theme.neon; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.8; ctx.shadowColor = theme.neon; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(-10, base - 18); ctx.quadraticCurveTo(tx1 * 0.5, base - 12, tx1, top + 6); ctx.quadraticCurveTo((tx1 + tx2) / 2, base - 8, tx2, top + 6); ctx.quadraticCurveTo(tx2 + (W - tx2) * 0.5, base - 12, W + 10, base - 18); ctx.stroke();
      var y0 = top + 6, yc = base - 8;
      for (var k = 1; k < 16; k++) {
        var f = k / 16, px = tx1 + (tx2 - tx1) * f;
        var cableY = y0 * ((1 - f) * (1 - f) + f * f) + yc * 2 * f * (1 - f);
        ctx.beginPath(); ctx.moveTo(px, cableY); ctx.lineTo(px, base - 14); ctx.stroke();
      }
      ctx.fillStyle = '#071018'; ctx.fillRect(0, base - 16, W, 4);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    } else if (id === 'manhattan') {
      ctx.fillStyle = '#0a0814';
      var sx = W * 0.58; ctx.fillRect(sx, base - H * 0.76, 16, H * 0.76);
      ctx.beginPath(); ctx.moveTo(sx, base - H * 0.76); ctx.lineTo(sx + 8, base - H * 0.94); ctx.lineTo(sx + 16, base - H * 0.76); ctx.fill();
      var on = Math.sin(t * 3) > 0;
      ctx.fillStyle = on ? '#ff3b3b' : '#5a1010'; ctx.beginPath(); ctx.arc(sx + 8, base - H * 0.94, 2.2, 0, 6.2832); ctx.fill();
    } else if (id === 'bronx') {
      var wx = W * 0.62, wy = base - mid[Math.min(mid.length - 1, Math.floor(mid.length * 0.6))].h;
      ctx.fillStyle = '#0a0612'; ctx.fillRect(wx, wy - 14, 18, 10);
      ctx.beginPath(); ctx.moveTo(wx, wy - 14); ctx.lineTo(wx + 9, wy - 22); ctx.lineTo(wx + 18, wy - 14); ctx.fill();
      ctx.fillRect(wx + 3, wy - 4, 2, 4); ctx.fillRect(wx + 13, wy - 4, 2, 4);
    } else if (id === 'park') {
      ctx.fillStyle = '#031a14';
      for (var i2 = 0; i2 < 9; i2++) {
        var tx = (i2 + 0.5) * (W / 9), tr = 18 + (i2 * 37 % 15);
        ctx.beginPath(); ctx.arc(tx, base - 20, tr, 0, 6.2832); ctx.arc(tx - tr * 0.6, base - 10, tr * 0.7, 0, 6.2832); ctx.arc(tx + tr * 0.6, base - 8, tr * 0.7, 0, 6.2832); ctx.fill();
      }
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
