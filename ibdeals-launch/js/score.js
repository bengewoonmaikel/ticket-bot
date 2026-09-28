/*
 * score.js
 * Single source of truth for timing, shared by the picture (index.html)
 * and the soundtrack (audio/synth.html). Everything here is deterministic:
 * the same seed always gives the same particles, beats and counter ticks.
 */
(function (root) {
  "use strict";

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smoothstep = (a, b, x) => {
    const t = c01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const TAU = Math.PI * 2;
  const wrap = (a) => {
    a = (a + Math.PI) % TAU;
    if (a < 0) a += TAU;
    return a - Math.PI;
  };

  const S = {
    W: 2560,
    H: 1440,
    FPS: 60,
    DURATION: 18,
    BPM: 120,
    BEAT: 0.5,
    BAR: 2,
    // Story beats (seconds). Bars of 2 s at 120 BPM: 0, 2, 4, 6, 8, 10, 12, 14, 16.
    T: {
      dot: 0.25, // the first light point ignites
      text: 0.45, // "SAME TRAFFIC." reveals out of the dot
      windup: 1.72, // anticipation before launch
      launch: 2.0, // bar 2: the dot shoots off, camera pulls back
      tag1: 3.0,
      tag2: 3.5,
      heroArrive: 4.0, // bar 3: first dot reaches the hub, hub ignites
      tagOut: 5.5,
      cards: 6.0, // bar 4: unlit broker cards appear in the dark
      suck: 7.5, // everything is pulled into the hub
      gap: 7.9, // a breath of silence
      drop: 8.0, // bar 5: the stream hits, the network lights up
      whipPre: 9.78,
      whip: 10.0, // bar 6: whip pan to the number
      stat: 10.22,
      count0: 10.3,
      count1: 11.4,
      label: 10.62,
      dive: 11.8, // push into the hub light
      brand: 12.05, // bar 7: "YOUR BRAND, NOT OURS"
      collapse: 13.6,
      logo: 14.0, // bar 8: logo reveal
      end: 14.9, // end card assembles, fully composed by ~15.75, holds to 18.0
    },
    rng: mulberry32,
    smoothstep,
    wrap,
  };

  // ---------------------------------------------------------------------
  // Flow geometry. Particles live on a disk (world plane y = 0), polar
  // coordinates (r, a): x = r cos a, z = r sin a.
  // ---------------------------------------------------------------------
  const R_OUT = 2300;
  const ARM_BASE = 3.45; // angle of the main stream at r = R_OUT
  const WIND = 2.35; // radians the stream curls on the way in
  const TRIBS = [0, -1.0, 1.05, -2.0, 2.1]; // tributary offsets, 0 is the main stream
  const MERGE_IN = 480;
  const MERGE_OUT = 1700;

  function mainArm(r) {
    const q = 1 - Math.min(1, r / R_OUT);
    return ARM_BASE + WIND * Math.pow(q, 1.3);
  }
  function armAngle(k, r) {
    return mainArm(r) + TRIBS[k] * smoothstep(MERGE_IN, MERGE_OUT, r);
  }
  S.flow = { R_OUT, mainArm, armAngle, TRIBS };

  // ---------------------------------------------------------------------
  // Particle schedule: every IB is a light point with its own volume.
  // ---------------------------------------------------------------------
  const N = 520;
  const CASCADE = 70;
  const HERO_R = 1650;

  function buildParticles() {
    const R = mulberry32(20260928);
    const list = [];
    const heroA = mainArm(HERO_R);
    const heroX = HERO_R * Math.cos(heroA);
    const heroZ = HERO_R * Math.sin(heroA);

    list.push({
      hero: true,
      r0: HERO_R,
      a0: heroA,
      y0: 0,
      k: 0,
      jit: 0,
      vol: 1.5,
      ph: 0.3,
      spawn: S.T.dot,
      depart: S.T.launch,
      L: S.T.heroArrive - S.T.launch,
      accent: true,
    });

    function nearestArm(r0, a0) {
      let best = 0;
      let bestD = 1e9;
      for (let k = 0; k < TRIBS.length; k++) {
        const d = Math.abs(wrap(armAngle(k, r0) - a0)) * (k === 0 ? 0.72 : 1);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      return best;
    }
    function add(spawn, r0, a0, y0) {
      // volume: many small IBs, a few big ones
      const g = (R() + R() + R() - 1.5) * 1.3;
      const vol = Math.max(0.42, Math.min(2.7, Math.exp(g * 0.55)));
      const wait = 0.16 + 0.5 * R();
      const depart = spawn + wait;
      let L = 1.3 + 1.45 * R() + 0.55 * (r0 / R_OUT);
      if (depart + L > 7.86) L = Math.max(0.45, 7.86 - depart);
      list.push({
        hero: false,
        r0,
        a0,
        y0,
        k: nearestArm(r0, a0),
        jit: R() * 2 - 1,
        vol,
        ph: R() * TAU,
        spawn,
        depart,
        L,
        accent: false,
      });
    }

    // the launch sets off a chain reaction around the first point
    for (let i = 0; i < CASCADE; i++) {
      const reach = 140 + 1150 * Math.pow(R(), 0.8);
      const ang = R() * TAU;
      const x = heroX + Math.cos(ang) * reach;
      const z = heroZ + Math.sin(ang) * reach * 0.75;
      const spawn = S.T.launch + 0.04 + (reach / 1290) * 0.85 + 0.08 * R();
      add(spawn, Math.min(R_OUT, Math.hypot(x, z)), Math.atan2(z, x), (R() * 2 - 1) * (50 + reach * 0.3));
    }

    for (let i = 0; i < N; i++) {
      const u = R();
      // more and more points join as the build goes on
      const spawn = 2.3 + 4.5 * Math.pow(u, 0.8);
      let r0, a0, y0;
      const near = 1 - smoothstep(2.3, 3.6, spawn);
      if (R() < near * 0.85) {
        const reach = 300 + 1300 * c01((spawn - 2.3) / 1.3) * (0.35 + 0.65 * R());
        const ang = R() * TAU;
        const x = heroX + Math.cos(ang) * reach;
        const z = heroZ + Math.sin(ang) * reach * 0.8;
        r0 = Math.min(R_OUT, Math.hypot(x, z));
        a0 = Math.atan2(z, x);
        y0 = (R() * 2 - 1) * (60 + reach * 0.35);
      } else {
        r0 = 620 + 1680 * Math.sqrt(R());
        a0 = R() * TAU;
        y0 = (R() * 2 - 1) * (160 + 700 * (r0 / R_OUT)) - 120 * R();
      }
      add(spawn, r0, a0, y0);
    }

    // Accent points: the biggest volumes light up on the 8th-note grid and
    // each one gets a pluck in the soundtrack.
    const cands = list
      .filter((p) => !p.hero && p.spawn > 2.2 && p.spawn < 7.05)
      .sort((a, b) => b.vol - a.vol)
      .slice(0, 36);
    const used = {};
    for (const p of cands) {
      let q = Math.round(p.spawn * 4) / 4;
      while ((used[q] || 0) >= 2) q += 0.25;
      if (q > 7.25) continue;
      used[q] = (used[q] || 0) + 1;
      p.spawn = q;
      p.depart = q + 0.2 + 0.25 * ((p.ph / TAU) % 1);
      if (p.depart + p.L > 7.86) p.L = Math.max(0.45, 7.86 - p.depart);
      p.accent = true;
    }
    return list;
  }

  S.particles = buildParticles();
  S.accents = S.particles
    .filter((p) => p.accent)
    .map((p) => ({
      t: p.spawn,
      vol: p.vol,
      pan: Math.max(-0.85, Math.min(0.85, (p.r0 * Math.cos(p.a0)) / 1900)),
      hero: p.hero,
    }))
    .sort((a, b) => a.t - b.t);

  // Arrival times feed the hub's energy.
  S.arrivals = S.particles.map((p) => Math.min(p.depart + p.L, S.T.gap)).sort((a, b) => a - b);

  // ---------------------------------------------------------------------
  // Broker ring: ten neutral cards around the hub.
  // ---------------------------------------------------------------------
  S.ring = {
    count: 10,
    R: 1260,
    lift: 170, // cards float above the plane
    rot0: -0.42,
    lineStart: (j) => S.T.drop + 0.012 + 0.034 * j,
    lineDur: 0.22,
    litAt: (j) => S.T.drop + 0.012 + 0.034 * j + 0.2,
  };
  S.ringRotation = function (t) {
    const T = S.T;
    let a = S.ring.rot0 + 0.05 * Math.sin(t * 0.35);
    if (t > T.drop) {
      const d = t - T.drop;
      a += 0.3 * (1 - Math.pow(2, -6 * Math.min(d, 3))) + 0.07 * Math.log(1 + d);
    }
    return a;
  };
  // order in which the connections ignite: sweep around from the stream side
  S.ring.order = (function () {
    const out = [];
    for (let j = 0; j < 10; j++) out.push(j);
    return out;
  })();

  // ---------------------------------------------------------------------
  // The 38% counter (with its label "average uplift vs. going direct").
  // ---------------------------------------------------------------------
  S.countValue = function (t) {
    const p = c01((t - S.T.count0) / (S.T.count1 - S.T.count0));
    if (p <= 0) return 0;
    if (p >= 1) return 38;
    return Math.round(38 * (1 - Math.pow(2, -10 * p)));
  };
  S.countTicks = (function () {
    const out = [];
    let last = 0;
    for (let t = S.T.count0; t <= S.T.count1 + 0.001; t += 0.001) {
      const v = S.countValue(t);
      if (v !== last) {
        out.push({ t: Math.round(t * 1000) / 1000, v });
        last = v;
      }
    }
    return out;
  })();

  root.SCORE = S;
})(typeof window !== "undefined" ? window : globalThis);
