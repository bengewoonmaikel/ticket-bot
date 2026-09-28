/*
 * film.js
 * DOM layer and the single paused GSAP timeline. The canvas world is
 * driven from the same timeline through one proxy tween (frame(t)).
 */
(function () {
  "use strict";

  const S = window.SCORE;
  const T = S.T;
  const W = S.W;
  const H = S.H;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function splitChars(el, text) {
    el.textContent = "";
    const out = [];
    for (const ch of text) {
      const s = document.createElement("span");
      s.className = "ch";
      s.textContent = ch === " " ? " " : ch;
      el.appendChild(s);
      out.push(s);
    }
    return out;
  }

  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    const out = [];
    words.forEach((w, i) => {
      const m = document.createElement("span");
      m.className = "mask";
      const s = document.createElement("span");
      s.className = "w";
      s.textContent = w;
      m.appendChild(s);
      el.appendChild(m);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
      out.push(s);
    });
    return out;
  }

  // Cold open: "SAME TRAFFIC" plus an invisible period whose ink position
  // becomes the first light point.
  function layoutColdOpen() {
    const el = $("#t-same");
    const inner = $("#t-same-in");
    const fxw = document.createElement("div");
    fxw.id = "t-same-fx";
    inner.appendChild(fxw);
    const chars = splitChars(fxw, "SAME TRAFFIC");
    const probe = document.createElement("span");
    probe.className = "probe";
    probe.textContent = ".";
    const base = document.createElement("span");
    base.className = "base";
    fxw.appendChild(probe);
    fxw.appendChild(base);

    const r0 = el.getBoundingClientRect();
    const left = Math.round((W - r0.width) / 2);
    const top = Math.round(H / 2 - r0.height / 2 + 6);
    el.style.left = left + "px";
    el.style.top = top + "px";

    const pr = probe.getBoundingClientRect();
    const br = base.getBoundingClientRect();
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = "800 212px Manrope";
    const m = ctx.measureText(".");
    const x = pr.left + (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
    const y = br.top - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    inner.style.transformOrigin = `${(x - left).toFixed(2)}px ${(y - top).toFixed(2)}px`;
    // the measuring glyphs are no longer needed: the light point takes the period's place
    probe.remove();
    base.remove();
    return { x, y, chars, inner };
  }

  function makeGrain() {
    const n = 512;
    const c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d");
    const img = g.createImageData(n, n);
    const R = S.rng(99);
    for (let i = 0; i < n * n; i++) {
      const v = Math.floor(128 + (R() + R() + R() - 1.5) * 120);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    $("#grain").style.backgroundImage = `url(${c.toDataURL("image/png")})`;
  }

  function build() {
    const cold = layoutColdOpen();
    const tag1 = splitWords($("#tag-1"));
    const tag2 = splitWords($("#tag-2"));
    const brandWords = splitWords($("#t-brand-in"));
    makeGrain();

    World.init({
      world: $("#world"),
      fx: $("#fx"),
      cardHost: $("#cards"),
      grain: $("#grain"),
      anchor: { x: cold.x, y: cold.y },
    });
    const D0 = World.camDistance(0);
    const numT = $("#num-t");
    const numO = $("#num-o");

    const blobA = $("#blob-a");
    const blobB = $("#blob-b");
    function frame(t) {
      World.render(t);
      // the navy breathes: slow sinusoidal drift, already moving on frame one
      blobA.style.transform = `translate(${(220 * Math.sin(0.33 * t + 0.7)).toFixed(1)}px, ${(130 * Math.sin(0.26 * t + 2.1)).toFixed(1)}px) scale(${(1 + 0.09 * Math.sin(0.21 * t + 0.4)).toFixed(4)})`;
      blobB.style.transform = `translate(${(-260 * Math.sin(0.29 * t + 1.2)).toFixed(1)}px, ${(110 * Math.sin(0.31 * t + 0.2)).toFixed(1)}px) scale(${(1 + 0.08 * Math.sin(0.25 * t + 2.2)).toFixed(4)})`;
      const k = D0 / World.camDistance(t);
      cold.inner.style.transform = `scale(${k.toFixed(5)})`;
      const v = S.countValue(t);
      numT.textContent = String(Math.floor(v / 10) || 0);
      numT.style.visibility = v >= 10 ? "visible" : "hidden";
      numO.textContent = String(v % 10);
    }

    const tl = gsap.timeline({ paused: true });
    const P = { t: 0 };
    tl.to(P, { t: S.DURATION, duration: S.DURATION, ease: "none", onUpdate: () => frame(P.t) }, 0);

    // ------------------------------------------------ background breathing
    tl.fromTo("#bg", { opacity: 0.5 }, { opacity: 1, duration: 3.6, ease: "sine.out" }, 0);

    // ------------------------------------------------ 0. cold open: SAME TRAFFIC.
    // letters light up out of the dot, right to left: the rise overshoots, the focus pull does not
    tl.fromTo(cold.chars, { y: 54 }, { y: 0, duration: 0.8, ease: "back.out(1.6)", stagger: { each: 0.045, from: "end" } }, T.text);
    tl.fromTo(
      cold.chars,
      { opacity: 0, filter: "blur(16px)", color: "#8db8ff" },
      { opacity: 1, filter: "blur(0px)", color: "#f5f8fc", duration: 0.7, ease: "power3.out", stagger: { each: 0.045, from: "end" } },
      T.text,
    );
    tl.fromTo("#t-same-fx", { opacity: 1, filter: "blur(0px)" }, { opacity: 0.84, filter: "blur(1.4px)", duration: T.launch - T.windup, ease: "power2.in" }, T.windup);
    tl.to("#t-same-fx", { opacity: 0, filter: "blur(18px)", duration: 0.48, ease: "power2.in" }, T.launch);

    // ------------------------------------------------ 1. build: BUILT FOR SERIOUS IBs / WHO WANT BETTER TERMS
    const rise = { yPercent: 0, rotation: 0, opacity: 1, duration: 0.9, ease: "expo.out", stagger: 0.065 };
    tl.fromTo(tag1, { yPercent: 118, rotation: 5, opacity: 0 }, rise, T.tag1);
    tl.fromTo(tag2, { yPercent: 118, rotation: 5, opacity: 0 }, rise, T.tag2);
    tl.fromTo("#t-tag-drift", { y: 10, scale: 0.985 }, { y: -16, scale: 1.02, duration: T.tagOut + 0.45 - T.tag1, ease: "sine.inOut" }, T.tag1);
    tl.fromTo("#t-tag .scrim", { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power2.out" }, T.tag1 - 0.1);
    tl.to("#t-tag .scrim", { opacity: 0, duration: 0.5, ease: "power2.in" }, T.tagOut);
    tl.fromTo("#t-tag-in", { opacity: 1, filter: "blur(0px)", y: 0 }, { opacity: 0, filter: "blur(14px)", y: -36, duration: 0.42, ease: "power2.in", immediateRender: false }, T.tagOut);

    // ------------------------------------------------ 2. drop: HIGHER PAYOUTS.
    tl.fromTo("#t-high-in", { scale: 1.26, opacity: 0, filter: "blur(26px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.55, ease: "expo.out" }, T.drop);
    tl.fromTo("#t-high .gdot", { scale: 0 }, { scale: 1, duration: 0.7, ease: "back.out(3.2)" }, T.drop + 0.14);
    tl.fromTo("#t-high .scrim", { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, T.drop + 0.05);
    tl.fromTo("#t-high-drift", { y: 0, scale: 1 }, { y: -12, scale: 1.035, duration: T.whipPre - T.drop, ease: "sine.inOut" }, T.drop);
    // whip: anticipation to the right, then out to the left with a shutter smear
    tl.to("#t-high-in", { x: 38, duration: 0.2, ease: "power2.out" }, T.whipPre);
    tl.set("#t-high-in", { filter: "url(#mbH)" }, T.whipPre + 0.19);
    tl.fromTo("#mbH feGaussianBlur", { attr: { stdDeviation: "0 0" } }, { attr: { stdDeviation: "80 0" }, duration: 0.24, ease: "power2.in" }, T.whipPre + 0.2);
    tl.to("#t-high-in", { x: -1400, opacity: 0, duration: 0.26, ease: "power3.in" }, T.whipPre + 0.2);
    tl.to("#t-high .scrim", { opacity: 0, duration: 0.2, ease: "power2.in" }, T.whipPre + 0.2);

    // ------------------------------------------------ 3. 38% + average uplift vs. going direct
    tl.set("#stat-in", { filter: "url(#mbS)" }, T.whip);
    tl.fromTo("#mbS feGaussianBlur", { attr: { stdDeviation: "90 0" } }, { attr: { stdDeviation: "0 0" }, duration: 0.36, ease: "power2.out" }, T.whip + 0.1);
    tl.fromTo("#stat-in", { x: 1150, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: "back.out(1.15)" }, T.whip + 0.08);
    tl.set("#stat-in", { filter: "blur(0px)" }, T.whip + 0.47);
    tl.fromTo("#stat-num", { scale: 0.95 }, { scale: 1, duration: S.countTicks[S.countTicks.length - 1].t - T.count0, ease: "power2.out" }, T.count0);
    const hit38 = S.countTicks[S.countTicks.length - 1].t;
    tl.to("#stat-num", { scale: 1.045, duration: 0.1, ease: "power2.out" }, hit38);
    tl.to("#stat-num", { scale: 1, duration: 0.5, ease: "back.out(2.4)" }, hit38 + 0.1);
    tl.fromTo("#stat-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "expo.out" }, T.label - 0.06);
    tl.fromTo("#stat-label", { y: 26, opacity: 0, filter: "blur(8px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.7, ease: "expo.out" }, T.label);
    tl.fromTo("#stat-drift", { y: 0, scale: 1 }, { y: -10, scale: 1.03, duration: T.dive - T.whip, ease: "sine.inOut" }, T.whip);
    // the camera dives into the hub: the number rushes past
    tl.fromTo(
      "#stat-in",
      { scale: 1, opacity: 1, filter: "blur(0px)" },
      { scale: 1.45, opacity: 0, filter: "blur(26px)", duration: 0.26, ease: "power2.in", transformOrigin: "35% 50%", immediateRender: false },
      T.dive - 0.02,
    );

    // ------------------------------------------------ 4. YOUR BRAND, NOT OURS
    const chart = $("#app-chart");
    const len = chart.getTotalLength();
    chart.style.strokeDasharray = `${len} ${len}`;
    // the panels come out of the light overexposed and settle (no grey veil)
    tl.fromTo("#brand-stage", { filter: "brightness(2.4) saturate(0.85)" }, { filter: "brightness(1) saturate(1)", duration: 0.55, ease: "power2.out" }, T.brand - 0.05);
    tl.fromTo("#brand-light", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1.1, duration: 1.4, ease: "expo.out" }, T.brand - 0.05);
    tl.fromTo(brandWords, { yPercent: 118, rotation: 5, opacity: 0 }, { yPercent: 0, rotation: 0, opacity: 1, duration: 0.85, ease: "expo.out", stagger: 0.075 }, T.brand + 0.1);
    tl.fromTo("#p-app", { y: 280, rotationX: 26, opacity: 0, scale: 0.9 }, { y: 0, rotationX: 5, opacity: 1, scale: 1, duration: 1.0, ease: "expo.out" }, T.brand - 0.02);
    tl.fromTo("#p-web", { x: 0, z: -560, rotationY: 0, opacity: 0 }, { x: -770, z: -280, rotationY: 27, opacity: 1, duration: 1.05, ease: "expo.out" }, T.brand + 0.1);
    tl.fromTo("#p-portal", { x: 0, z: -560, rotationY: 0, opacity: 0 }, { x: 770, z: -280, rotationY: -27, opacity: 1, duration: 1.05, ease: "expo.out" }, T.brand + 0.16);
    tl.fromTo(".panel", { borderColor: "rgba(214,230,255,0.85)" }, { borderColor: "rgba(190,214,255,0.26)", duration: 1.1, ease: "power2.out", stagger: 0.06 }, T.brand + 0.05);
    tl.fromTo(".panel .psheen", { xPercent: -120 }, { xPercent: 320, duration: 0.9, ease: "power2.inOut", stagger: 0.08 }, T.brand + 0.12);
    tl.fromTo(".panel .sk, .portal .side i, .rows div, .phone .list div", { scaleX: 0 }, { scaleX: 1, duration: 0.65, ease: "expo.out", stagger: 0.012 }, T.brand + 0.28);
    tl.fromTo(".panel .pill", { scaleX: 0.15, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.6, ease: "back.out(1.7)", stagger: 0.05 }, T.brand + 0.42);
    tl.fromTo(chart, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.95, ease: "power2.inOut" }, T.brand + 0.3);
    tl.fromTo(".panel .mark", { scale: 1.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(2.4)", stagger: 0.07 }, T.brand + 0.36);
    tl.fromTo(".mring", { scale: 1, opacity: 0.95 }, { scale: 2.5, opacity: 0, duration: 0.75, ease: "expo.out", stagger: 0.07 }, T.brand + 0.5);
    tl.fromTo("#devices", { rotationY: -8, y: 20, x: 0, scale: 1.07 }, { rotationY: 5, y: -8, x: 0, scale: 1.07, duration: T.collapse - T.brand, ease: "sine.inOut" }, T.brand);
    // collapse: everything folds into the brand mark, which becomes a single point
    tl.to("#devices", { scale: 1.11, duration: 0.1, ease: "power2.out" }, T.collapse);
    tl.to("#devices", { x: 141, y: 204, scale: 1.07, duration: 0.3, ease: "power3.in" }, T.collapse + 0.1);
    tl.to(["#p-web", "#p-portal"], { x: 0, z: -60, rotationY: 0, scale: 0.1, opacity: 0, duration: 0.28, ease: "power3.in" }, T.collapse + 0.08);
    tl.to("#p-app", { scale: 0.04, rotationX: 0, duration: 0.3, ease: "power3.in", transformOrigin: "86px 138px" }, T.collapse + 0.1);
    tl.to("#p-app", { opacity: 0, duration: 0.12, ease: "power1.in" }, T.collapse + 0.26);
    tl.to("#brand-light", { opacity: 0, scale: 0.4, duration: 0.35, ease: "power2.in" }, T.collapse + 0.05);
    tl.fromTo("#t-brand-in", { y: 0, opacity: 1, filter: "blur(0px)" }, { y: -40, opacity: 0, filter: "blur(14px)", duration: 0.3, ease: "power2.in", immediateRender: false }, T.collapse);

    // ------------------------------------------------ 5. logo reveal
    tl.fromTo("#logo-glow", { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.9, ease: "expo.out" }, T.logo + 0.02);
    tl.fromTo("#wordmark", { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "power1.out" }, T.logo + 0.08);
    tl.fromTo("#wordmark", { clipPath: "inset(47% 0% 47% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.5, ease: "expo.out" }, T.logo + 0.1);
    tl.fromTo("#wordmark", { letterSpacing: "0.07em" }, { letterSpacing: "-0.03em", duration: 0.8, ease: "expo.out" }, T.logo + 0.06);
    tl.fromTo("#wordmark .sheen", { backgroundPosition: "100% 0%" }, { backgroundPosition: "0% 0%", duration: 0.75, ease: "power2.inOut" }, T.logo + 0.42);
    tl.fromTo("#lockup-move", { y: 0, scale: 1 }, { y: 0, scale: 1.03, duration: T.end - T.logo, ease: "sine.out" }, T.logo);

    // ------------------------------------------------ 6. end card
    tl.to("#lockup-move", { y: -214, scale: 0.7, duration: 0.54, ease: "power3.inOut" }, T.end);
    tl.to("#logo-glow", { y: -214, scale: 0.8, opacity: 0.8, duration: 0.54, ease: "power3.inOut" }, T.end);
    tl.fromTo("#url", { y: 34, opacity: 0, filter: "blur(10px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.6, ease: "expo.out" }, T.end + 0.14);
    tl.fromTo("#cta", { scale: 0.84, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.65, ease: "back.out(1.9)" }, T.end + 0.22);
    tl.fromTo("#cta-glow", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.9, ease: "expo.out" }, T.end + 0.22);
    tl.to("#cta-glow", { opacity: 0.55, scale: 0.94, duration: 0.7, ease: "sine.inOut", repeat: 3, yoyo: true }, T.end + 1.1);
    tl.fromTo("#disclaimer", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" }, T.end + 0.3);
    tl.fromTo("#cta .sheen", { x: 0 }, { x: 1150, duration: 0.9, ease: "power2.inOut" }, 16.15);
    tl.fromTo("#cta .sheen", { x: 0 }, { x: 1150, duration: 0.9, ease: "power2.inOut", immediateRender: false }, 17.15);
    tl.fromTo("#endcard-in", { scale: 1 }, { scale: 1.035, duration: 19.6 - T.end, ease: "sine.inOut" }, T.end);

    return tl;
  }

  window.Film = { build };
})();
