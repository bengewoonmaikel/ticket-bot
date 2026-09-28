/*
 * world.js
 * The canvas world of the film: light points (IBs), their merging stream,
 * the hub, the ring of ten neutral broker cards, and the camera.
 * render(t) is a pure function of the timeline time t: nothing is
 * accumulated between frames, so any frame can be rendered on its own.
 */
(function () {
  "use strict";

  const S = window.SCORE;
  const T = S.T;
  const W = S.W;
  const H = S.H;
  const TAU = Math.PI * 2;
  const flow = S.flow;

  // ---------------------------------------------------------------- helpers
  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, x) => c01((x - a) / (b - a));
  const sstep = (a, b, x) => {
    const q = inv(a, b, x);
    return q * q * (3 - 2 * q);
  };
  const easeCache = {};
  const ez = (name, p) => {
    let f = easeCache[name];
    if (!f) f = easeCache[name] = gsap.parseEase(name);
    return f(c01(p));
  };
  // keyframe track: [[time, value, ease], ...]; the ease shapes the segment that ends at that key
  function track(keys) {
    return function (t) {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) {
        const k = keys[i];
        if (t <= k[0]) {
          const k0 = keys[i - 1];
          const span = k[0] - k0[0];
          if (span <= 0) return k[1];
          return lerp(k0[1], k[1], ez(k[2] || "power2.inOut", (t - k0[0]) / span));
        }
      }
      return keys[keys.length - 1][1];
    };
  }
  const R = S.rng(7331);

  // ---------------------------------------------------------------- sprites
  function radial(size, stops) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, col] of stops) gr.addColorStop(o, col);
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
    return c;
  }
  const SPR = {
    glow: radial(256, [
      [0, "rgba(160,198,255,1)"],
      [0.1, "rgba(120,168,255,0.62)"],
      [0.28, "rgba(59,130,246,0.22)"],
      [0.6, "rgba(29,84,201,0.06)"],
      [1, "rgba(29,84,201,0)"],
    ]),
    core: radial(128, [
      [0, "rgba(255,255,255,1)"],
      [0.28, "rgba(236,244,255,0.96)"],
      [0.55, "rgba(150,190,255,0.42)"],
      [1, "rgba(59,130,246,0)"],
    ]),
    bokeh: radial(256, [
      [0, "rgba(120,168,255,0.30)"],
      [0.72, "rgba(125,172,255,0.34)"],
      [0.86, "rgba(160,198,255,0.42)"],
      [0.93, "rgba(141,184,255,0.18)"],
      [1, "rgba(141,184,255,0)"],
    ]),
    haze: radial(256, [
      [0, "rgba(40,96,210,0.55)"],
      [0.4, "rgba(29,84,201,0.22)"],
      [1, "rgba(10,27,51,0)"],
    ]),
    white: radial(256, [
      [0, "rgba(255,255,255,1)"],
      [0.18, "rgba(226,238,255,0.75)"],
      [0.45, "rgba(141,184,255,0.22)"],
      [1, "rgba(59,130,246,0)"],
    ]),
  };

  // ---------------------------------------------------------------- camera
  const F = 1500;
  const cam = {};
  let tracks = null;
  let P0 = null;

  function buildCamera(anchor) {
    const h = S.particles[0];
    P0 = { x: h.r0 * Math.cos(h.a0), y: 0, z: h.r0 * Math.sin(h.a0) };
    const ox0 = anchor.x - W / 2;
    const oy0 = anchor.y - H / 2;
    const L = Math.log;
    tracks = {
      tx: track([
        [0, P0.x],
        [T.launch, P0.x],
        [4.4, 0, "power3.inOut"],
      ]),
      tz: track([
        [0, P0.z],
        [T.launch, P0.z],
        [4.4, 0, "power3.inOut"],
      ]),
      ox: track([
        [0, ox0],
        [T.launch, ox0],
        [T.launch + 1.1, 0, "power2.inOut"],
        [T.whipPre, 0],
        [T.whipPre + 0.2, -30, "power2.out"],
        [T.whip + 0.36, 820, "expo.inOut"],
        [T.dive, 790, "sine.inOut"],
        [T.brand, 0, "power3.in"],
        [T.brand + 0.01, 0],
      ]),
      oy: track([
        [0, oy0],
        [T.launch, oy0],
        [T.launch + 1.1, 40, "power2.inOut"],
        [4.4, 130, "sine.inOut"],
        [7.5, 150, "sine.inOut"],
        [8.0, 215, "power2.inOut"],
        [T.whip + 0.36, 70, "expo.inOut"],
        [T.dive, 60, "sine.inOut"],
        [T.brand, 0, "power3.in"],
        [T.brand + 0.01, -20],
        [T.end, -20],
        [T.end + 0.54, -150, "power3.inOut"],
        [19.5, -180, "sine.inOut"],
      ]),
      logD: track([
        [0, L(622)],
        [T.windup, L(572), "sine.out"],
        [T.launch, L(545), "power2.in"],
        [4.7, L(3150), "power3.out"],
        [7.5, L(2650), "sine.inOut"],
        [7.9, L(2230), "power2.in"],
        [8.4, L(2560), "expo.out"],
        [T.whipPre, L(2420), "sine.inOut"],
        [T.whipPre + 0.2, L(2360), "power2.out"],
        [T.whip + 0.36, L(3750), "expo.inOut"],
        [T.dive, L(3500), "sine.inOut"],
        [T.brand, L(160), "power3.in"],
        [T.brand + 0.01, L(5200)],
        [T.logo, L(3950), "sine.inOut"],
        [T.end, L(3800), "sine.inOut"],
        [19.5, L(5000), "sine.inOut"],
      ]),
      zoom: track([
        [0, 1],
        [T.brand, 1],
        [T.brand + 0.01, 1.85],
        [18, 1.85],
      ]),
      yaw: track([
        [0, -0.2],
        [T.launch, -0.17],
        [7.5, 0.12, "sine.inOut"],
        [T.whipPre, 0.3, "sine.inOut"],
        [T.whipPre + 0.2, 0.25, "power2.out"],
        [T.whip + 0.36, 1.32, "expo.inOut"],
        [T.dive, 1.44, "sine.inOut"],
        [T.brand, 1.5, "power2.in"],
        [T.brand + 0.01, -0.35],
        [19.5, 0.2, "sine.inOut"],
      ]),
      pitch: track([
        [0, 0.52],
        [7.9, 0.5, "sine.inOut"],
        [8.5, 0.58, "expo.out"],
        [T.whip + 0.36, 0.46, "expo.inOut"],
        [T.brand, 0.5],
        [T.brand + 0.01, 0.4],
        [19.5, 0.47, "sine.inOut"],
      ]),
      roll: track([
        [0, 0],
        [T.launch, 0.004],
        [3.4, -0.034, "power2.out"],
        [7.5, 0.012, "sine.inOut"],
        [8.0, 0, "power2.inOut"],
        [T.whipPre, 0.004, "sine.inOut"],
        [T.whip + 0.18, 0.03, "power2.in"],
        [T.whip + 0.5, -0.008, "power3.out"],
        [T.dive, 0, "sine.inOut"],
        [19.5, 0.006, "sine.inOut"],
      ]),
    };
  }

  function setCam(t) {
    cam.tx = tracks.tx(t);
    cam.ty = 0;
    cam.tz = tracks.tz(t);
    cam.ox = tracks.ox(t) + 5 * Math.sin(t * 0.61 + 0.4);
    cam.oy = tracks.oy(t) + 4 * Math.sin(t * 0.47 + 1.3);
    cam.D = Math.exp(tracks.logD(t));
    cam.zoom = tracks.zoom(t);
    cam.yaw = tracks.yaw(t);
    cam.pitch = tracks.pitch(t);
    cam.roll = tracks.roll(t);
    if (t >= T.drop) {
      const d = t - T.drop;
      const a = Math.exp(-d / 0.13);
      cam.ox += 18 * a * Math.sin(d * 71);
      cam.oy += 12 * a * Math.sin(d * 57 + 1);
      cam.roll += 0.006 * a * Math.sin(d * 63);
    }
    cam.cy = Math.cos(cam.yaw);
    cam.sy = Math.sin(cam.yaw);
    cam.cp = Math.cos(cam.pitch);
    cam.sp = Math.sin(cam.pitch);
    cam.cr = Math.cos(cam.roll);
    cam.sr = Math.sin(cam.roll);
  }

  // world -> screen. Returns false when behind the camera.
  function proj(x, y, z, o) {
    const qx = x - cam.tx;
    const qy = y - cam.ty;
    const qz = z - cam.tz;
    const x1 = qx * cam.cy - qz * cam.sy;
    const z1 = qx * cam.sy + qz * cam.cy;
    const y2 = qy * cam.cp - z1 * cam.sp;
    const z2 = qy * cam.sp + z1 * cam.cp;
    const depth = z2 + cam.D;
    if (depth < 40) {
      o.s = 0;
      return false;
    }
    const s = (F * cam.zoom) / depth;
    const X = x1 * s + cam.ox;
    const Y = y2 * s + cam.oy;
    o.X = W / 2 + X * cam.cr - Y * cam.sr;
    o.Y = H / 2 + X * cam.sr + Y * cam.cr;
    o.s = s;
    o.z = depth;
    return true;
  }

  // ---------------------------------------------------------------- particles
  const PT = S.particles;
  const suckP = (t) => ez("power3.in", inv(T.suck, T.gap - 0.03, t));

  function flightP(pt, t) {
    if (t <= pt.depart) return 0;
    let p = c01((t - pt.depart) / pt.L);
    if (t > T.suck) {
      const q = suckP(t);
      p = p + (1 - p) * q;
    }
    return p;
  }

  // position of particle pt at flight progress p and time t (world), written into o
  function pWorldP(pt, p, t, o) {
    let u;
    let wind = 0;
    let wob = 1;
    if (pt.hero) {
      u = 0.1 * p + 0.9 * ez("power2.in", p);
      wob = 0; // the first point sits exactly where the period of SAME TRAFFIC. would be
    } else {
      u = 0.14 * p + 0.86 * p * p;
    }
    const r = (pt.r0 + wind) * (1 - u);
    const armA = flow.armAngle(pt.k, r);
    const settle = sstep(0, 0.55, u);
    const toArm = S.wrap(armA - pt.a0);
    const th =
      pt.a0 + toArm * settle + pt.jit * 0.09 * (1 - settle) + wob * 0.018 * Math.sin(t * 1.9 + pt.ph) * (1 - u);
    const lat = pt.jit * 70 * (1 - u) * settle;
    const ct = Math.cos(th);
    const st = Math.sin(th);
    o.x = r * ct - lat * st;
    o.z = r * st + lat * ct;
    o.y = pt.y0 * (1 - ez("power2.inOut", u / 0.7)) + wob * 7 * Math.sin(t * 2.1 + pt.ph) * (1 - u);
    o.p = p;
    o.u = u;
    return o;
  }
  function pWorld(pt, t, o) {
    return pWorldP(pt, flightP(pt, t), t, o);
  }

  // ---------------------------------------------------------------- dust
  const DUST = [];
  for (let i = 0; i < 300; i++) {
    DUST.push({
      x: (R() * 2 - 1) * 4600,
      y: -2600 + R() * 4200,
      z: -2200 + R() * 7800,
      a: 0.12 + 0.4 * R(),
      sz: 3 + 9 * R(),
      ph: R() * TAU,
      f: 0.15 + 0.3 * R(),
    });
  }
  // a quiet pocket of dust around the first dot, for depth in the cold open
  for (let i = 0; i < 70; i++) {
    const h = S.particles[0];
    DUST.push({
      x: h.r0 * Math.cos(h.a0) + (R() * 2 - 1) * 1300,
      y: (R() * 2 - 1) * 800,
      z: h.r0 * Math.sin(h.a0) + (R() * 2 - 1) * 1300,
      a: 0.08 + 0.26 * R(),
      sz: 1.5 + 4 * R(),
      ph: R() * TAU,
      f: 0.2 + 0.4 * R(),
    });
  }
  const HAZE = [
    { x: -3200, y: -900, z: 7000, r: 5200, a: 0.5 },
    { x: 3600, y: 400, z: 8200, r: 6000, a: 0.42 },
    { x: 400, y: -2200, z: 9000, r: 5000, a: 0.34 },
    { x: -800, y: 1600, z: 4200, r: 3600, a: 0.26 },
  ];

  // foreground bokeh (screen space, parallax driven by the camera)
  const FORE = [];
  for (let i = 0; i < 14; i++) {
    FORE.push({ x: R() * W, y: R() * H, r: 60 + 170 * R(), a: 0.03 + 0.06 * R(), ph: R() * TAU, par: 1.2 + 1.6 * R() });
  }

  // ---------------------------------------------------------------- DOM cards
  let cardEls = [];
  const CARD_W = 340;
  const CARD_H = 212;

  function buildCards(host) {
    const html = (j) => `
      <div class="bc-in">
        <div class="bc-row">
          <div class="bc-logo"></div>
          <div class="bc-lines"><i style="width:${118 + ((j * 37) % 50)}px"></i><i style="width:${70 + ((j * 23) % 40)}px"></i></div>
          <svg class="bc-shield" viewBox="0 0 24 24"><path d="M12 2.4l7.6 2.9v5.9c0 4.9-3.2 9.1-7.6 10.6-4.4-1.5-7.6-5.7-7.6-10.6V5.3z"/><path class="chk" d="M8.6 12.1l2.4 2.4 4.6-4.9"/></svg>
        </div>
        <div class="bc-foot">
          <b style="width:${64 + ((j * 13) % 30)}px"></b><b style="width:${52 + ((j * 29) % 36)}px"></b><b style="width:${58 + ((j * 17) % 28)}px"></b>
          <span class="bc-dot"></span>
        </div>
      </div>`;
    for (let j = 0; j < S.ring.count; j++) {
      const el = document.createElement("div");
      el.className = "bcard";
      el.id = "bcard-" + j;
      el.innerHTML = html(j);
      host.appendChild(el);
      cardEls.push(el);
    }
  }

  // ---------------------------------------------------------------- canvases
  let wc, wx, fc, fx, buf, bx;
  let grainEl = null;

  function init(opts) {
    wc = opts.world;
    wx = wc.getContext("2d");
    fc = opts.fx;
    fx = fc.getContext("2d");
    buf = document.createElement("canvas");
    buf.width = W;
    buf.height = H;
    bx = buf.getContext("2d");
    grainEl = opts.grain || null;
    buildCamera(opts.anchor);
    buildCards(opts.cardHost);
  }

  // ---------------------------------------------------------------- scene helpers
  const tmp = { X: 0, Y: 0, s: 0, z: 0 };
  const tmp2 = { X: 0, Y: 0, s: 0, z: 0 };
  const wpos = { x: 0, y: 0, z: 0, p: 0, u: 0 };

  function arrivedFrac(t) {
    const A = S.arrivals;
    let lo = 0;
    let hi = A.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (A[m] <= t) lo = m + 1;
      else hi = m;
    }
    return lo / A.length;
  }

  // global "defocus" of the world (depth of field pulled to the foreground)
  const defocus = track([
    [0, 0],
    [T.whip, 0],
    [T.whip + 0.4, 0.75, "power2.out"],
    [T.dive, 0.8],
    [T.dive + 0.2, 0.2, "power2.in"],
    [T.brand, 0.2],
    [T.brand + 0.01, 0.4],
    [T.logo, 0.12, "power2.out"],
    [T.end, 0.15],
    [T.end + 0.8, 0.95, "power2.inOut"],
    [18, 0.95],
  ]);

  function drawSprite(ctx, img, X, Y, rad, alpha) {
    if (alpha <= 0.002 || rad <= 0.1) return;
    ctx.globalAlpha = alpha > 1 ? 1 : alpha;
    ctx.drawImage(img, X - rad, Y - rad, rad * 2, rad * 2);
  }

  function ringPath(ctx, radius, yy, n) {
    let first = true;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      if (!proj(radius * Math.cos(a), yy, radius * Math.sin(a), tmp)) {
        first = true;
        continue;
      }
      if (first) {
        ctx.moveTo(tmp.X, tmp.Y);
        first = false;
      } else ctx.lineTo(tmp.X, tmp.Y);
    }
  }

  // ---------------------------------------------------------------- world render
  function drawBackdrop(ctx, t, df) {
    // far haze gives the navy depth and parallax
    for (const h of HAZE) {
      if (!proj(h.x + 300 * Math.sin(t * 0.13 + h.x), h.y, h.z, tmp)) continue;
      drawSprite(ctx, SPR.haze, tmp.X, tmp.Y, h.r * tmp.s, h.a);
    }
    // dust: out of focus motes drifting on slow sines
    const focus = cam.D;
    for (const d of DUST) {
      const x = d.x + 60 * Math.sin(t * d.f + d.ph);
      const y = d.y + 40 * Math.sin(t * d.f * 0.8 + d.ph * 1.7);
      if (!proj(x, y, d.z, tmp)) continue;
      if (tmp.X < -300 || tmp.X > W + 300 || tmp.Y < -300 || tmp.Y > H + 300) continue;
      const blur = Math.min(1, Math.abs(tmp.z - focus) / (0.8 * focus) + df * 0.5);
      const rad = d.sz * tmp.s * (1 + 5 * blur);
      const tw = 0.75 + 0.25 * Math.sin(t * 1.3 + d.ph * 3);
      drawSprite(ctx, blur > 0.4 ? SPR.bokeh : SPR.glow, tmp.X, tmp.Y, Math.max(1.2, rad), (d.a * tw) / (1 + 2.5 * blur));
    }
  }

  function drawParticles(ctx, t, df) {
    const focus = cam.D;
    const K = 12;
    const dt = 0.021;
    ctx.lineCap = "round";
    for (let i = PT.length - 1; i >= 0; i--) {
      const pt = PT[i];
      if (t < pt.spawn) continue;
      pWorld(pt, t, wpos);
      if (wpos.p >= 1) continue;
      const p = wpos.p;
      const u = wpos.u;
      if (!proj(wpos.x, wpos.y, wpos.z, tmp)) continue;
      const X = tmp.X;
      const Y = tmp.Y;
      const s = tmp.s;
      if (X < -400 || X > W + 400 || Y < -400 || Y > H + 400) continue;
      const ign = inv(pt.spawn, pt.spawn + 0.34, t);
      const pop = ez("back.out(3.2)", ign);
      let alpha = ez("power2.out", inv(pt.spawn, pt.spawn + 0.16, t));
      alpha *= 1 - inv(0.9, 1, p);
      const bright = 0.72 + 0.55 * u + (pt.hero ? 0.25 : 0);
      const baseR = (pt.hero ? 5.2 : 4.6) * pt.vol;
      let wind = 1;
      if (pt.hero) {
        // contract before the launch, spring back after
        wind = 1 - 0.3 * ez("power2.in", inv(T.windup, T.launch, t)) + 0.3 * ez("back.out(4)", inv(T.launch, T.launch + 0.35, t));
        wind *= 1 + 0.06 * Math.sin(t * 5.2) * (1 - inv(T.launch - 0.3, T.launch, t));
      }
      const rad = baseR * s * pop * wind;
      const blur = Math.min(1, Math.abs(tmp.z - focus) / (0.9 * focus) + df);

      // trail: sampled back along the path itself, so fast moves never cut chords
      if (t > pt.depart + 0.01 && p > 0.001) {
        const pBack = flightP(pt, Math.max(pt.depart, t - 0.26));
        const dp = Math.min(0.011, (p - pBack) / K);
        let px = X;
        let py = Y;
        for (let k = 1; k <= K; k++) {
          const pk = p - k * dp;
          if (pk <= 0) break;
          pWorldP(pt, pk, t, wpos);
          if (!proj(wpos.x, wpos.y, wpos.z, tmp2)) break;
          const f = 1 - k / (K + 1);
          const segA = alpha * bright * 0.36 * f * f * (1 - 0.6 * blur);
          if (segA > 0.004) {
            ctx.globalAlpha = segA;
            ctx.strokeStyle = pt.hero ? "#dbe8ff" : "#8db8ff";
            ctx.lineWidth = Math.max(0.7, rad * 1.25 * f + blur * 3);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(tmp2.X, tmp2.Y);
            ctx.stroke();
          }
          px = tmp2.X;
          py = tmp2.Y;
        }
      }

      // head
      if (blur > 0.45) {
        drawSprite(ctx, SPR.bokeh, X, Y, rad * (2.2 + 7 * blur), (alpha * bright * 0.7) / (1 + 3 * blur * blur));
      } else {
        drawSprite(ctx, SPR.glow, X, Y, rad * (6.5 + 4 * blur), alpha * bright * 0.5);
        drawSprite(ctx, SPR.core, X, Y, rad * (1.9 + 2 * blur), alpha * bright * (1 - blur));
      }
      // the first point announces itself with a soft ring, on the ping
      if (pt.hero && t > pt.spawn && t < pt.spawn + 0.9) {
        const q = (t - pt.spawn) / 0.9;
        ctx.globalAlpha = 0.5 * (1 - q) * (1 - q);
        ctx.strokeStyle = "#a9c9ff";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(X, Y, 14 + 150 * ez("expo.out", q), 0, TAU);
        ctx.stroke();
      }
      // ignition ripple for the accent points (they carry a pluck in the score)
      if (pt.accent && !pt.hero && ign < 1 && ign > 0) {
        const rr = Math.min(rad * (2 + 9 * ez("expo.out", ign)), 90 * s + 12);
        ctx.globalAlpha = (1 - ign) * (1 - ign) * 0.4 * alpha;
        ctx.strokeStyle = "#8db8ff";
        ctx.lineWidth = Math.max(0.8, 1.6 * s);
        ctx.beginPath();
        ctx.arc(X, Y, rr, 0, TAU);
        ctx.stroke();
      }
    }
  }

  // the merged stream: one strong luminous current into the hub
  function drawStream(ctx, t) {
    let I = 0.55 * ez("power2.inOut", inv(4.4, 6.2, t)) + 0.45 * ez("power2.in", inv(6.2, T.suck, t));
    I *= 1 + 0.6 * ez("power2.in", inv(T.suck, T.gap - 0.05, t));
    I *= 1 - inv(T.gap - 0.04, T.gap + 0.02, t);
    if (I <= 0.003) return;
    const reach = 1500 * (1 - ez("power3.in", inv(T.suck, T.gap, t)));
    if (reach < 20) return;
    const n = 80;
    const xs = [];
    const ys = [];
    const ss = [];
    for (let i = 0; i <= n; i++) {
      const r = 8 + reach * (1 - i / n);
      const a = flow.mainArm(r);
      if (!proj(r * Math.cos(a), 0, r * Math.sin(a), tmp)) return;
      xs.push(tmp.X);
      ys.push(tmp.Y);
      ss.push(tmp.s);
    }
    ctx.lineCap = "round";
    const passes = [
      [46, 0.045, "#3b82f6"],
      [20, 0.1, "#5b9bff"],
      [7, 0.28, "#8db8ff"],
      [2.4, 0.75, "#eaf2ff"],
    ];
    for (const [wid, al, col] of passes) {
      ctx.strokeStyle = col;
      for (let i = 0; i < n; i++) {
        const f = i / n; // 0 at the outer end, 1 at the hub
        const fade = sstep(0, 0.35, f);
        const a = al * I * fade;
        if (a < 0.003) continue;
        // flowing brightness: waves that travel toward the hub, speeding up
        const ph = f * 18 - 7 * Math.pow(Math.max(0, t - 4.4), 1.35);
        const wave = 0.7 + 0.3 * Math.sin(ph);
        ctx.globalAlpha = Math.min(1, a * wave);
        ctx.lineWidth = Math.max(0.8, wid * (0.45 + 0.9 * f) * ss[i]);
        ctx.beginPath();
        ctx.moveTo(xs[i], ys[i]);
        ctx.lineTo(xs[i + 1], ys[i + 1]);
        ctx.stroke();
      }
    }
  }

  function hubState(t) {
    const E = arrivedFrac(t);
    let on = sstep(T.heroArrive - 0.06, T.heroArrive + 0.08, t);
    let radius = 26 + 95 * Math.pow(E, 0.6);
    let bright = 0.55 + 0.45 * E;
    const bloom = t >= T.heroArrive ? Math.exp(-(t - T.heroArrive) / 0.3) : 0;
    radius *= 1 + 0.9 * bloom;
    bright += 0.6 * bloom;
    const sp = ez("power2.in", inv(T.suck, T.gap, t));
    radius *= 1 - 0.55 * sp;
    bright *= 1 + 1.3 * sp;
    if (t >= T.gap) {
      // compressed, then released at the drop
      const d = t - T.drop;
      if (d < 0) {
        radius *= 0.9;
      } else {
        const settle = ez("expo.out", d / 0.6);
        radius = lerp(radius * 3.5, 78, settle) * (1 + 0.05 * Math.sin(t * 3.1));
        bright = lerp(2.2, 1.0, settle);
      }
    }
    return { on, radius, bright, E };
  }

  function drawHub(ctx, t, net) {
    const hs = hubState(t);
    if (hs.on <= 0.001) return hs;
    if (!proj(0, 0, 0, tmp)) return hs;
    const X = tmp.X;
    const Y = tmp.Y;
    const s = tmp.s;
    const r = hs.radius * s;
    const a = hs.on * net;
    drawSprite(ctx, SPR.haze, X, Y, r * 22, 0.35 * a * Math.min(1.4, hs.bright));
    drawSprite(ctx, SPR.glow, X, Y, r * 9, 0.55 * a * hs.bright);
    drawSprite(ctx, SPR.core, X, Y, r * 2.4, 0.95 * a * Math.min(1.5, hs.bright));
    drawSprite(ctx, SPR.white, X, Y, r * 1.2, 0.8 * a * Math.min(1.5, hs.bright));

    // node rings once the network is live
    const live = ez("power3.out", inv(T.drop + 0.05, T.drop + 0.6, t)) * net;
    if (live > 0.01) {
      ctx.save();
      ctx.lineWidth = Math.max(1, 2.2 * s);
      ctx.strokeStyle = "#8db8ff";
      ctx.globalAlpha = 0.55 * live;
      ctx.beginPath();
      ringPath(ctx, 150 + 20 * (1 - live), 0, 72);
      ctx.stroke();
      ctx.setLineDash([10 * s, 16 * s]);
      ctx.lineDashOffset = -40 * Math.log(1 + Math.max(0, t - T.drop)) * s;
      ctx.globalAlpha = 0.35 * live;
      ctx.beginPath();
      ringPath(ctx, 235, 0, 90);
      ctx.stroke();
      ctx.restore();
    }
    return hs;
  }

  function drawRings(ctx, t) {
    // converging ring: the anticipation right before the drop
    const cv = sstep(T.suck, T.suck + 0.18, t) * (1 - inv(T.gap - 0.04, T.gap + 0.01, t));
    if (cv > 0.002) {
      const rad = 1700 * (1 - ez("power3.in", inv(T.suck, T.gap, t))) + 20;
      ctx.save();
      ctx.strokeStyle = "#8db8ff";
      for (const [lw, al] of [
        [14, 0.08],
        [4, 0.3],
        [1.6, 0.8],
      ]) {
        ctx.lineWidth = lw;
        ctx.globalAlpha = al * cv;
        ctx.beginPath();
        ringPath(ctx, rad, 0, 120);
        ctx.stroke();
      }
      ctx.restore();
    }
    // shockwaves out of the drop
    for (const [delay, max, dur, amp] of [
      [0, 3600, 1.15, 1],
      [0.07, 2600, 1.4, 0.55],
    ]) {
      const d = t - T.drop - delay;
      if (d <= 0 || d > dur) continue;
      const q = d / dur;
      const rad = max * ez("expo.out", q);
      const a = amp * Math.pow(1 - q, 1.8);
      ctx.save();
      ctx.strokeStyle = "#a9c9ff";
      for (const [lw, al] of [
        [60, 0.05],
        [18, 0.14],
        [4, 0.55],
      ]) {
        ctx.lineWidth = lw * (1 - 0.5 * q);
        ctx.globalAlpha = al * a;
        ctx.beginPath();
        ringPath(ctx, rad, 0, 160);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------ network (lines, pulses, cards)
  const ring = S.ring;
  const cardState = [];
  for (let j = 0; j < ring.count; j++) cardState.push({ X: 0, Y: 0, s: 0, z: 0, lit: 0, vis: 0 });

  function cardWorld(j, t, o) {
    const rot = S.ringRotation(t);
    const a = rot + (j / ring.count) * TAU;
    // pulled in before the drop, pushed out by it
    const pull = 0.035 * ez("power2.in", inv(T.suck, T.gap, t)) * (1 - inv(T.drop, T.drop + 0.1, t));
    const push = t > T.drop ? 0.05 * Math.exp(-(t - T.drop) / 0.25) * Math.sin(Math.min(Math.PI, (t - T.drop) * 9)) : 0;
    const Rr = ring.R * (1 - pull + push);
    o.x = Rr * Math.cos(a);
    o.z = Rr * Math.sin(a);
    o.y = -ring.lift;
    o.a = a;
    return o;
  }

  function lineProgress(j, t) {
    return ez("expo.out", (t - ring.lineStart(j)) / ring.lineDur);
  }

  // quadratic arc from the hub to card j, sampled
  const arcX = new Float32Array(33);
  const arcY = new Float32Array(33);
  const arcS = new Float32Array(33);
  function arcSample(cw, n) {
    for (let i = 0; i <= n; i++) {
      const q = i / n;
      const mx = cw.x * 0.5;
      const mz = cw.z * 0.5;
      const my = -ring.lift - 190;
      const a = (1 - q) * (1 - q);
      const b = 2 * (1 - q) * q;
      const c = q * q;
      const x = b * mx + c * cw.x;
      const y = b * my + c * cw.y;
      const z = b * mz + c * cw.z;
      proj(x, y, z, tmp);
      arcX[i] = tmp.X;
      arcY[i] = tmp.Y;
      arcS[i] = tmp.s;
      void a;
    }
  }

  // the logo becomes the hub: the network returns around it, then steps back for the end card
  function networkAlpha(t) {
    if (t < T.brand) return 1;
    if (t < T.logo - 0.05) return 0;
    const inA = 0.8 * sstep(T.logo - 0.05, T.logo + 0.35, t);
    return lerp(inA, 0.13, ez("power2.inOut", inv(T.end, T.end + 0.9, t)));
  }
  const logoLineStart = (j) => T.logo + 0.1 + 0.03 * j;
  const logoLitAt = (j) => logoLineStart(j) + 0.26;

  function drawNetwork(ctx, t, df) {
    const netA = networkAlpha(t);
    const showCards = t >= T.cards && netA > 0.001;
    const cw = { x: 0, y: 0, z: 0, a: 0 };
    const n = 32;
    for (let j = 0; j < ring.count; j++) {
      const st = cardState[j];
      cardWorld(j, t, cw);
      proj(cw.x, cw.y, cw.z, tmp);
      st.X = tmp.X;
      st.Y = tmp.Y;
      st.s = tmp.s;
      st.z = tmp.z;
      st.vis = showCards ? netA * ez("power2.out", inv(T.cards + j * 0.05, T.cards + 0.8 + j * 0.05, t)) : 0;
      const logoPhase = t >= T.logo - 0.05;
      const litAt = logoPhase ? logoLitAt(j) : ring.litAt(j);
      st.lit = t >= litAt ? inv(litAt, litAt + 0.5, t) : 0;
      if (t >= T.brand && !logoPhase) st.lit = 0;

      // silhouette lines before the drop: faint, dashed
      const pre = st.vis * (1 - inv(T.drop, T.drop + 0.2, t));
      if (pre > 0.01 && t < T.drop + 0.2) {
        arcSample(cw, n);
        ctx.save();
        ctx.setLineDash([6, 14]);
        ctx.strokeStyle = "#5b8fe0";
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.16 * pre * (1 - 0.5 * ez("power2.in", inv(T.suck, T.gap, t)));
        ctx.beginPath();
        ctx.moveTo(arcX[0], arcY[0]);
        for (let i = 1; i <= n; i++) ctx.lineTo(arcX[i], arcY[i]);
        ctx.stroke();
        ctx.restore();
      }

      // live connection
      const prog = logoPhase
        ? ez("expo.out", (t - logoLineStart(j)) / 0.32)
        : t >= T.drop
          ? lineProgress(j, t)
          : 0;
      if (prog > 0.001 && netA > 0.001) {
        arcSample(cw, n);
        const m = Math.max(1, Math.round(prog * n));
        const soft = 1 + 2.5 * df;
        for (const [lw, al, col] of [
          [16, 0.06, "#3b82f6"],
          [6, 0.18, "#5b9bff"],
          [1.8, 0.85, "#cfe0ff"],
        ]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = lw * soft * Math.max(0.5, arcS[m] * 1.2);
          ctx.globalAlpha = (al * netA) / soft;
          ctx.beginPath();
          ctx.moveTo(arcX[0], arcY[0]);
          for (let i = 1; i <= m; i++) ctx.lineTo(arcX[i], arcY[i]);
          ctx.stroke();
        }
        // the spark at the head of the connection while it travels
        if (prog < 0.999) {
          drawSprite(ctx, SPR.white, arcX[m], arcY[m], 60 * arcS[m], 0.9 * netA);
        }
        // pulses: volume routed from the hub to each broker, on the beat
        if (prog >= 0.999) {
          const t0 = litAt;
          for (let k = 0; k < 40; k++) {
            const ts = t0 + 0.25 + k * 0.5 + (j % 2) * 0.25;
            const q = (t - ts) / 0.62;
            if (q < 0) break;
            if (q > 1) continue;
            const e = ez("power2.inOut", q);
            const fi = e * n;
            const i0 = Math.floor(fi);
            const i1 = Math.min(n, i0 + 1);
            const fr = fi - i0;
            const X = lerp(arcX[i0], arcX[i1], fr);
            const Y = lerp(arcY[i0], arcY[i1], fr);
            const sc = lerp(arcS[i0], arcS[i1], fr);
            const pa = Math.sin(Math.PI * q) * netA;
            drawSprite(ctx, SPR.glow, X, Y, 70 * sc * (1 + df), 0.55 * pa);
            drawSprite(ctx, SPR.core, X, Y, 16 * sc * (1 + 2 * df), 0.9 * pa * (1 - 0.6 * df));
          }
        }
      }
    }
  }

  function updateCardsDOM(t, df) {
    for (let j = 0; j < cardEls.length; j++) {
      const el = cardEls[j];
      const st = cardState[j];
      if (st.vis <= 0.002 || st.s <= 0) {
        el.style.opacity = "0";
        continue;
      }
      const litE = ez("power2.out", st.lit);
      const pop = st.lit > 0 ? 0.93 + 0.07 * ez("back.out(2.8)", st.lit) : 0.93;
      const k = st.s * 1.08 * pop;
      const blur = Math.min(14, Math.abs(st.z - cam.D) / cam.D * 5 + df * 9);
      el.style.transform = `translate3d(${(st.X - CARD_W / 2).toFixed(2)}px, ${(st.Y - CARD_H).toFixed(2)}px, 0) scale(${k.toFixed(4)})`;
      el.style.opacity = (st.vis * (0.34 + 0.66 * litE)).toFixed(3);
      el.style.filter = blur > 0.25 ? `blur(${blur.toFixed(2)}px)` : "none";
      el.style.zIndex = String(Math.round(20000 - st.z));
      el.style.setProperty("--lit", litE.toFixed(3));
    }
  }

  // ---------------------------------------------------------------- FX layer
  function drawFx(ctx, t) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    // foreground bokeh drifting with parallax
    const hub = { X: 0, Y: 0 };
    if (proj(0, 0, 0, tmp)) {
      hub.X = tmp.X;
      hub.Y = tmp.Y;
    }
    const fg = t < T.brand ? 1 : t < T.logo ? 0.5 : 0.7;
    for (const b of FORE) {
      const x = ((b.x + (hub.X - W / 2) * b.par * 0.25 + 40 * Math.sin(t * 0.4 + b.ph)) % (W + 400) + W + 400) % (W + 400) - 200;
      const y = b.y + (hub.Y - H / 2) * b.par * 0.18 + 30 * Math.sin(t * 0.33 + b.ph * 2);
      drawSprite(ctx, SPR.bokeh, x, y, b.r, b.a * fg * (0.7 + 0.3 * Math.sin(t * 0.9 + b.ph)));
    }

    // the drop: flash from the hub + anamorphic streak
    const d = t - T.drop;
    const pre = ez("power3.in", inv(T.suck, T.gap, t)) * (1 - inv(T.gap, T.gap + 0.05, t));
    if (pre > 0.01) drawSprite(ctx, SPR.white, hub.X, hub.Y, 220 + 160 * pre, 0.35 * pre);
    if (d >= 0 && d < 1.2) {
      const f = Math.exp(-d / 0.1);
      const f2 = Math.exp(-d / 0.45);
      ctx.globalAlpha = 0.85 * f;
      const g = ctx.createRadialGradient(hub.X, hub.Y, 0, hub.X, hub.Y, 1900);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.2, "rgba(190,215,255,0.6)");
      g.addColorStop(0.55, "rgba(59,130,246,0.18)");
      g.addColorStop(1, "rgba(29,84,201,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      streak(ctx, hub.X, hub.Y, 2600 * (0.6 + 0.4 * f2), 26 * f2 + 6, 0.8 * f2);
    }

    // push into the hub light
    const dv = inv(T.dive - 0.05, T.brand, t);
    const out = inv(T.brand, T.brand + 0.2, t);
    if (dv > 0 && out < 1) {
      const e = ez("power3.in", dv);
      const oe = ez("power3.out", out);
      const a = e * (1 - oe);
      // the light fills the frame, then closes back into the centre like an iris,
      // turning blue as it goes so it never reads as a grey veil
      const rr = out > 0 ? lerp(4800, 500, oe) : lerp(300, 5200, e);
      const cx = lerp(hub.X, W / 2, e);
      const cy = lerp(hub.Y, H / 2, e);
      ctx.globalAlpha = a;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      if (out > 0) {
        g.addColorStop(0, "rgba(235,243,255,1)");
        g.addColorStop(0.35, "rgba(120,170,255,0.85)");
        g.addColorStop(0.7, "rgba(59,130,246,0.42)");
        g.addColorStop(1, "rgba(29,84,201,0)");
      } else {
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.3, "rgba(206,226,255,0.95)");
        g.addColorStop(0.62, "rgba(92,150,255,0.6)");
        g.addColorStop(1, "rgba(59,130,246,0)");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // logo: the dot that becomes a slit of light
    const lg = t - T.logo;
    if (lg > -0.12 && lg < 1.0) {
      // follow the brand mark as it collapses (measured path, power3.in over 13.7 to 14.0)
      const fol = ez("power3.in", inv(T.collapse + 0.1, T.logo, t));
      const cx = lerp(1134, W / 2, fol);
      const cy = lerp(489, H / 2 - 20, fol);
      const dotA = sstep(-0.1, -0.03, lg) * (1 - inv(0.05, 0.3, lg));
      drawSprite(ctx, SPR.white, cx, cy, 70 + 60 * Math.exp(-Math.abs(lg) / 0.05), 0.9 * dotA);
      drawSprite(ctx, SPR.glow, cx, cy, 360, 0.5 * dotA);
      const open = ez("expo.out", inv(0, 0.32, lg));
      const fade = 1 - ez("power2.in", inv(0.3, 0.8, lg));
      if (lg > 0) {
        streak(ctx, cx, cy, 80 + 1500 * open, 10 + 4 * open, 0.95 * fade);
        streak(ctx, cx, cy, 200 + 2600 * open, 40, 0.25 * fade);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function streak(ctx, X, Y, len, th, a) {
    if (a <= 0.003) return;
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(X - len, Y, X + len, Y);
    g.addColorStop(0, "rgba(59,130,246,0)");
    g.addColorStop(0.35, "rgba(120,168,255,0.35)");
    g.addColorStop(0.5, "rgba(245,248,252,1)");
    g.addColorStop(0.65, "rgba(120,168,255,0.35)");
    g.addColorStop(1, "rgba(59,130,246,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(X, Y, len, th, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // whip-pan smear (horizontal), in screen pixels
  const smear = track([
    [T.whipPre + 0.15, 0],
    [T.whip + 0.14, 110, "power2.in"],
    [T.whip + 0.4, 0, "power2.out"],
  ]);

  // ---------------------------------------------------------------- frame
  function render(t) {
    if (!tracks) return;
    setCam(t);
    const df = defocus(t);
    const blurPx = smear(t);
    const ctx = blurPx > 0.5 ? bx : wx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    drawBackdrop(ctx, t, df);
    const brandPhase = t >= T.brand + 0.01 && t < T.logo - 0.3;
    if (!brandPhase) {
      if (t < T.drop + 0.1) drawParticles(ctx, t, df);
      drawStream(ctx, t);
      drawRings(ctx, t);
      drawNetwork(ctx, t, df);
      drawHub(ctx, t, t < T.brand ? 1 : networkAlpha(t));
    } else {
      for (let j = 0; j < cardState.length; j++) cardState[j].vis = 0;
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (ctx === bx) {
      // average shifted copies: a horizontal shutter smear
      wx.setTransform(1, 0, 0, 1, 0, 0);
      wx.globalCompositeOperation = "source-over";
      wx.clearRect(0, 0, W, H);
      const N = 18;
      for (let k = 0; k < N; k++) {
        wx.globalAlpha = 1 / (k + 1);
        wx.drawImage(buf, ((k / (N - 1)) * 2 - 1) * blurPx, 0);
      }
      wx.globalAlpha = 1;
    }

    updateCardsDOM(t, df + (blurPx > 0.5 ? blurPx / 40 : 0));
    drawFx(fx, t);

    if (grainEl) {
      const f = Math.floor(t * 60);
      const gx = ((f * 7919) % 512) | 0;
      const gy = ((f * 104729) % 512) | 0;
      grainEl.style.backgroundPosition = `${gx}px ${gy}px`;
    }
  }

  // screen position of the hub, used by the DOM layer
  function hubScreen(t) {
    setCam(t);
    proj(0, 0, 0, tmp);
    return { X: tmp.X, Y: tmp.Y, s: tmp.s };
  }

  function camDistance(t) {
    return Math.exp(tracks.logD(t));
  }

  window.World = { init, render, hubScreen, camDistance, SPR };
})();
