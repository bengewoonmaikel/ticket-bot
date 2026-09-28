/*
 * synth.js
 * The whole soundtrack, synthesized with the Web Audio API and rendered
 * offline (OfflineAudioContext). No samples, no audio files: every sound is
 * an oscillator, filtered noise or a buffer computed here. Timing comes from
 * js/score.js, the same file that drives the picture.
 *
 * 120 BPM, D minor build, D major from the drop on.
 */
(function () {
  "use strict";

  const S = window.SCORE;
  const T = S.T;
  const SR = 48000;
  const DUR = S.DURATION;
  const BEAT = 60 / S.BPM;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  async function render() {
    const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.round(SR * DUR), sampleRate: SR });
    const R = S.rng(424242);
    const rnd = (a, b) => a + (b - a) * R();

    // ------------------------------------------------------------ buses
    // No DynamicsCompressorNode here: its automatic make-up gain would lift the
    // quiet cold open and flatten the drop. Limiting happens after rendering.
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    // gentle fade into silence at the very end of the end card
    master.gain.setValueAtTime(1, 0);
    master.gain.setValueAtTime(1, 16.7);
    master.gain.setTargetAtTime(0.0001, 16.7, 0.42);

    const mix = ctx.createGain();
    mix.connect(master);

    // ------------------------------------------------------------ noise
    const NOISE_LEN = 4 * SR;
    const noise = ctx.createBuffer(2, NOISE_LEN, SR);
    for (let c = 0; c < 2; c++) {
      const d = noise.getChannelData(c);
      for (let i = 0; i < NOISE_LEN; i++) d[i] = R() * 2 - 1;
    }
    function noiseSrc(t, dur) {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      s.start(t, rnd(0, 3.5), dur + 0.05);
      return s;
    }

    // ------------------------------------------------------------ reverbs (impulse responses computed here)
    function makeIR(seconds, damp, pre) {
      const n = Math.round(SR * seconds);
      const p = Math.round(SR * pre);
      const buf = ctx.createBuffer(2, n + p, SR);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        let lp = 0;
        for (let i = 0; i < n; i++) {
          const t = i / SR;
          const env = Math.pow(1 - i / n, 1.6) * Math.exp((-3.0 * t) / seconds);
          const a = Math.min(0.985, damp * (0.25 + (1.5 * t) / seconds));
          lp += (1 - a) * (R() * 2 - 1 - lp);
          d[p + i] = lp * env * (1 + 1.2 * a);
        }
        // a few early reflections
        for (let k = 0; k < 9; k++) {
          const at = p + Math.round(SR * rnd(0.004, 0.06));
          d[at] += (R() < 0.5 ? -1 : 1) * rnd(0.2, 0.5);
        }
      }
      return buf;
    }
    const hall = ctx.createConvolver();
    hall.buffer = makeIR(3.6, 0.55, 0.018);
    const hallIn = ctx.createGain();
    const hallOut = ctx.createGain();
    hallOut.gain.value = 0.5;
    hallIn.connect(hall);
    hall.connect(hallOut);
    hallOut.connect(mix);

    const room = ctx.createConvolver();
    room.buffer = makeIR(0.9, 0.4, 0.006);
    const roomIn = ctx.createGain();
    const roomOut = ctx.createGain();
    roomOut.gain.value = 0.45;
    roomIn.connect(room);
    room.connect(roomOut);
    roomOut.connect(mix);

    // ping-pong delay, dotted eighth
    const delayIn = ctx.createGain();
    const dl = ctx.createDelay(2);
    const dr = ctx.createDelay(2);
    dl.delayTime.value = BEAT * 0.75;
    dr.delayTime.value = BEAT * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.36;
    const dlp = ctx.createBiquadFilter();
    dlp.type = "lowpass";
    dlp.frequency.value = 3600;
    const merger = ctx.createChannelMerger(2);
    const delayOut = ctx.createGain();
    delayOut.gain.value = 0.32;
    delayIn.connect(dl);
    dl.connect(merger, 0, 0);
    dl.connect(dr);
    dr.connect(merger, 0, 1);
    dr.connect(fb);
    fb.connect(dlp);
    dlp.connect(dl);
    merger.connect(delayOut);
    delayOut.connect(mix);

    // groups that duck under the kick
    // pads: keep the low end for the bass and take the box out of the mids
    const padBus = ctx.createGain();
    const padHP = ctx.createBiquadFilter();
    padHP.type = "highpass";
    padHP.frequency.value = 170;
    padHP.Q.value = 0.6;
    const padMud = ctx.createBiquadFilter();
    padMud.type = "peaking";
    padMud.frequency.value = 420;
    padMud.Q.value = 0.9;
    padMud.gain.value = -3;
    const padAir = ctx.createBiquadFilter();
    padAir.type = "highshelf";
    padAir.frequency.value = 3500;
    padAir.gain.value = 3;
    padBus.connect(padHP);
    padHP.connect(padMud);
    padMud.connect(padAir);
    padAir.connect(mix);
    const bassBus = ctx.createGain();
    bassBus.connect(mix);
    const drumBus = ctx.createGain();
    drumBus.gain.value = 0.85;
    drumBus.connect(mix);

    // soft saturation
    function shaper(amount) {
      const ws = ctx.createWaveShaper();
      const n = 2048;
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = Math.tanh(amount * x) / Math.tanh(amount);
      }
      ws.curve = curve;
      ws.oversample = "2x";
      return ws;
    }

    // route a node to the mix with pan and sends
    function out(node, { pan = 0, dest = mix, hallS = 0, roomS = 0, delayS = 0 } = {}) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      p.connect(dest);
      if (hallS) {
        const g = ctx.createGain();
        g.gain.value = hallS;
        p.connect(g);
        g.connect(hallIn);
      }
      if (roomS) {
        const g = ctx.createGain();
        g.gain.value = roomS;
        p.connect(g);
        g.connect(roomIn);
      }
      if (delayS) {
        const g = ctx.createGain();
        g.gain.value = delayS;
        p.connect(g);
        g.connect(delayIn);
      }
      return p;
    }

    function perc(g, t, attack, peak, tau) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.setTargetAtTime(0, t + attack, tau);
    }

    // ------------------------------------------------------------ instruments
    // glassy FM bell
    function bell(t, f, vel, { pan = 0, tau = 0.9, ratio = 3.5, index = 3.2, hallS = 0.45, delayS = 0, dest = mix } = {}) {
      const car = ctx.createOscillator();
      car.frequency.value = f;
      const mod = ctx.createOscillator();
      mod.frequency.value = f * ratio;
      const mg = ctx.createGain();
      mg.gain.setValueAtTime(f * index, t);
      mg.gain.setTargetAtTime(f * 0.15, t, tau * 0.25);
      mod.connect(mg);
      mg.connect(car.frequency);
      const g = ctx.createGain();
      perc(g, t, 0.002, vel, tau);
      car.connect(g);
      // a pure octave partial on top, shorter
      const o2 = ctx.createOscillator();
      o2.frequency.value = f * 2.001;
      const g2 = ctx.createGain();
      perc(g2, t, 0.002, vel * 0.25, tau * 0.35);
      o2.connect(g2);
      const sum = ctx.createGain();
      g.connect(sum);
      g2.connect(sum);
      out(sum, { pan, hallS, delayS, dest });
      const end = t + tau * 7 + 0.1;
      for (const o of [car, mod, o2]) {
        o.start(t);
        o.stop(end);
      }
    }

    // soft pluck (the light points)
    function pluck(t, f, vel, { pan = 0, cutoff = 5200, tau = 0.2, hallS = 0.3, delayS = 0.28, dest = mix } = {}) {
      const a = ctx.createOscillator();
      a.type = "triangle";
      a.frequency.value = f;
      const b = ctx.createOscillator();
      b.type = "sawtooth";
      b.frequency.value = f * 1.004;
      const bg = ctx.createGain();
      bg.gain.value = 0.35;
      b.connect(bg);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 2;
      lp.frequency.setValueAtTime(cutoff, t);
      lp.frequency.setTargetAtTime(f * 1.5, t, 0.07);
      a.connect(lp);
      bg.connect(lp);
      const g = ctx.createGain();
      perc(g, t, 0.003, vel, tau);
      lp.connect(g);
      out(g, { pan, hallS, delayS, dest });
      const end = t + tau * 7;
      a.start(t);
      b.start(t);
      a.stop(end);
      b.stop(end);
    }

    // pad chord: detuned saws through one filter
    function pad(t0, t1, notes, level, { cutoff = [900, 1600], attack = 0.9, release = 1.2, hallS = 0.4, width = 0.7 } = {}) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 0.7;
      lp.frequency.setValueAtTime(cutoff[0], t0);
      lp.frequency.linearRampToValueAtTime(cutoff[1], t1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(level, t0 + attack);
      g.gain.setValueAtTime(level, t1);
      g.gain.setTargetAtTime(0, t1, release / 4);
      lp.connect(g);
      out(g, { dest: padBus, hallS });
      const end = t1 + release * 2;
      notes.forEach((m, i) => {
        for (const det of [-9, 0, 8]) {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = mtof(m) * Math.pow(2, det / 1200);
          const p = ctx.createStereoPanner();
          p.pan.value = Math.max(-1, Math.min(1, ((i / Math.max(1, notes.length - 1)) * 2 - 1) * width * 0.6 + det / 30));
          const vg = ctx.createGain();
          vg.gain.value = 0.11 / Math.sqrt(notes.length);
          o.connect(vg);
          vg.connect(p);
          p.connect(lp);
          o.start(t0);
          o.stop(end);
        }
      });
      return lp;
    }

    // sub / bass note
    function bass(t, dur, m, vel, { sub = true } = {}) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = mtof(m);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.setTargetAtTime(260, t, 0.08);
      o.connect(lp);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel, t + 0.006);
      g.gain.setTargetAtTime(vel * 0.6, t + 0.006, 0.08);
      g.gain.setTargetAtTime(0, t + dur * 0.9, 0.03);
      lp.connect(g);
      const sh = shaper(1.6);
      g.connect(sh);
      out(sh, { dest: bassBus });
      o.start(t);
      o.stop(t + dur + 0.3);
      if (sub) {
        const s = ctx.createOscillator();
        s.frequency.value = mtof(m - 12);
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0, t);
        sg.gain.linearRampToValueAtTime(vel * 0.9, t + 0.01);
        sg.gain.setTargetAtTime(0, t + dur * 0.9, 0.04);
        s.connect(sg);
        out(sg, { dest: bassBus });
        s.start(t);
        s.stop(t + dur + 0.3);
      }
    }

    function kick(t, vel, { tau = 0.13, f0 = 150, f1 = 46 } = {}) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + 0.11);
      const g = ctx.createGain();
      perc(g, t, 0.001, vel, tau);
      o.connect(g);
      const sh = shaper(2.2);
      g.connect(sh);
      out(sh, { dest: drumBus, roomS: 0.08 });
      o.start(t);
      o.stop(t + 0.9);
      // click
      const n = noiseSrc(t, 0.02);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 2600;
      const ng = ctx.createGain();
      perc(ng, t, 0.0005, vel * 0.22, 0.004);
      n.connect(hp);
      hp.connect(ng);
      out(ng, { dest: drumBus });
      duck(t, 0.42);
    }

    // sidechain: pads and bass breathe with the kick
    const duckTimes = [];
    function duck(t, depth) {
      duckTimes.push([t, depth]);
    }
    function applyDucks() {
      duckTimes.sort((a, b) => a[0] - b[0]);
      // merge hits that land together (an impact carries its own kick)
      for (let i = duckTimes.length - 1; i > 0; i--) {
        if (duckTimes[i][0] - duckTimes[i - 1][0] < 0.03) {
          duckTimes[i - 1][1] = Math.max(duckTimes[i - 1][1], duckTimes[i][1]);
          duckTimes.splice(i, 1);
        }
      }
      for (const bus of [padBus, bassBus]) {
        bus.gain.setValueAtTime(1, 0);
        for (const [t, depth] of duckTimes) {
          bus.gain.setValueAtTime(1, t);
          bus.gain.linearRampToValueAtTime(1 - depth, t + 0.012);
          bus.gain.setTargetAtTime(1, t + 0.02, 0.085);
        }
      }
    }

    function hat(t, vel, { open = false, pan = 0 } = {}) {
      const n = noiseSrc(t, open ? 0.5 : 0.12);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 7600;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 10500;
      bp.Q.value = 0.7;
      const g = ctx.createGain();
      perc(g, t, 0.0008, vel, open ? 0.11 : 0.022);
      n.connect(hp);
      hp.connect(bp);
      bp.connect(g);
      out(g, { dest: drumBus, pan, roomS: 0.12 });
    }

    function clap(t, vel) {
      const n = noiseSrc(t, 0.5);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1450;
      bp.Q.value = 1.1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      for (const [d, a] of [
        [0, 1],
        [0.011, 0.8],
        [0.023, 0.9],
      ]) {
        g.gain.setValueAtTime(vel * a, t + d);
        g.gain.setTargetAtTime(vel * 0.15, t + d + 0.0005, 0.004);
      }
      g.gain.setValueAtTime(vel * 0.7, t + 0.034);
      g.gain.setTargetAtTime(0, t + 0.035, 0.07);
      n.connect(bp);
      bp.connect(g);
      out(g, { dest: drumBus, roomS: 0.5, hallS: 0.12 });
    }

    function tick(t, vel, pan = 0) {
      const o = ctx.createOscillator();
      o.frequency.value = 3150;
      const g = ctx.createGain();
      perc(g, t, 0.0005, vel, 0.004);
      o.connect(g);
      out(g, { pan, roomS: 0.2 });
      o.start(t);
      o.stop(t + 0.05);
    }

    function whoosh(t, dur, vel, { from = 500, peak = 5200, to = 900, panFrom = -0.6, panTo = 0.6, hallS = 0.3 } = {}) {
      const n = noiseSrc(t, dur);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(from, t);
      bp.frequency.exponentialRampToValueAtTime(peak, t + dur * 0.55);
      bp.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp);
      bp.connect(g);
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(panFrom, t);
      p.pan.linearRampToValueAtTime(panTo, t + dur);
      g.connect(p);
      out(p, { hallS });
    }

    // noise rising into a hard stop: the inhale before a hit
    function swell(tEnd, dur, vel, { f0 = 400, f1 = 6000, hallS = 0.2 } = {}) {
      const t = tEnd - dur;
      const n = noiseSrc(t, dur);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 0.9;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.exponentialRampToValueAtTime(f1, tEnd);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel, tEnd - 0.005);
      g.gain.linearRampToValueAtTime(0, tEnd);
      n.connect(bp);
      bp.connect(g);
      out(g, { hallS });
    }

    // a chord that grows toward tEnd (computed as a reversed decay)
    function reverseChord(tEnd, dur, midis, vel, pan = 0) {
      const n = Math.round(dur * SR);
      const buf = ctx.createBuffer(2, n, SR);
      const tau = dur / 3.2;
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (const m of midis) {
          const f = mtof(m) * (c ? 1.0015 : 0.9985);
          const ph = R() * 6.283;
          for (let i = 0; i < n; i++) {
            const back = (n - i) / SR;
            const env = Math.exp(-back / tau);
            d[i] += Math.sin(6.283185307 * f * back + ph) * env * (0.6 + 0.4 * Math.exp(-back * 3));
          }
        }
        for (let i = 0; i < n; i++) d[i] /= midis.length;
      }
      const s = ctx.createBufferSource();
      s.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vel, 0);
      g.gain.setValueAtTime(vel, tEnd - 0.012);
      g.gain.linearRampToValueAtTime(0, tEnd);
      s.connect(g);
      out(g, { pan, hallS: 0.25 });
      s.start(tEnd - dur);
    }

    function impact(t, size) {
      // sub boom with a pitch fall
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(62, t);
      o.frequency.exponentialRampToValueAtTime(31, t + 1.5);
      const g = ctx.createGain();
      perc(g, t, 0.002, 0.68 * size, 0.7);
      o.connect(g);
      const sh = shaper(1.8);
      g.connect(sh);
      out(sh, { dest: mix, hallS: 0.12 });
      o.start(t);
      o.stop(t + 5);
      kick(t, 0.8 * size, { tau: 0.2, f0: 190, f1: 42 });
      // noise crash, falling
      const n = noiseSrc(t, 3);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(11000, t);
      lp.frequency.exponentialRampToValueAtTime(260, t + 1.8);
      const ng = ctx.createGain();
      perc(ng, t, 0.001, 0.42 * size, 0.42);
      n.connect(lp);
      lp.connect(ng);
      out(ng, { hallS: 0.55 });
      // air
      const n2 = noiseSrc(t, 6);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6000;
      const ag = ctx.createGain();
      perc(ag, t, 0.004, 0.09 * size, 1.1);
      n2.connect(hp);
      hp.connect(ag);
      out(ag, { hallS: 0.4 });
      duck(t, 0.8);
    }

    function stab(t, midis, vel) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 1.2;
      lp.frequency.setValueAtTime(9000, t);
      lp.frequency.setTargetAtTime(1100, t, 0.22);
      const g = ctx.createGain();
      perc(g, t, 0.004, vel, 0.8);
      lp.connect(g);
      out(g, { hallS: 0.55 });
      midis.forEach((m, i) => {
        for (const det of [-11, 0, 10]) {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = mtof(m) * Math.pow(2, det / 1200);
          const p = ctx.createStereoPanner();
          p.pan.value = Math.max(-1, Math.min(1, ((i / (midis.length - 1)) * 2 - 1) * 0.7 + det / 25));
          const vg = ctx.createGain();
          vg.gain.value = 0.2 / Math.sqrt(midis.length);
          o.connect(vg);
          vg.connect(p);
          p.connect(lp);
          o.start(t);
          o.stop(t + 6);
        }
      });
    }

    function shimmer(t, dur, count, vel, notes, { hallS = 0.7 } = {}) {
      for (let i = 0; i < count; i++) {
        const tt = t + dur * Math.pow(i / count, 0.8) + rnd(0, 0.03);
        const m = notes[Math.floor(R() * notes.length)] + 12 * Math.floor(R() * 2);
        bell(tt, mtof(m), vel * rnd(0.5, 1), { pan: rnd(-0.8, 0.8), tau: rnd(0.35, 0.8), ratio: 2.0, index: 1.2, hallS });
      }
    }

    function riser(t0, t1, vel) {
      const n = noiseSrc(t0, t1 - t0);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(300, t0);
      bp.frequency.exponentialRampToValueAtTime(7500, t1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vel, t1 - 0.01);
      g.gain.linearRampToValueAtTime(0, t1);
      n.connect(bp);
      bp.connect(g);
      out(g, { hallS: 0.25 });
      // pitched rise: two saws gliding up, spread wide
      for (const [pan, det] of [
        [-0.7, 0.997],
        [0.7, 1.003],
      ]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(mtof(45) * det, t0);
        o.frequency.exponentialRampToValueAtTime(mtof(81) * det, t1);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(400, t0);
        lp.frequency.exponentialRampToValueAtTime(6500, t1);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.0001, t0);
        og.gain.exponentialRampToValueAtTime(vel * 0.3, t1 - 0.01);
        og.gain.linearRampToValueAtTime(0, t1);
        o.connect(lp);
        lp.connect(og);
        out(og, { pan, hallS: 0.2 });
        o.start(t0);
        o.stop(t1 + 0.05);
      }
    }

    function snareRoll(t0, t1, vel) {
      let t = t0;
      let k = 0;
      while (t < t1) {
        const q = (t - t0) / (t1 - t0);
        const step = q < 0.35 ? BEAT / 2 : q < 0.65 ? BEAT / 4 : q < 0.87 ? BEAT / 8 : BEAT / 16;
        const n = noiseSrc(t, 0.2);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1900 + 900 * q;
        bp.Q.value = 0.8;
        const g = ctx.createGain();
        perc(g, t, 0.001, vel * (0.25 + 0.75 * q * q), 0.045);
        n.connect(bp);
        bp.connect(g);
        out(g, { pan: k % 2 ? 0.15 : -0.15, roomS: 0.4 });
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = 195;
        const og = ctx.createGain();
        perc(og, t, 0.001, vel * 0.35 * (0.25 + 0.75 * q), 0.03);
        o.connect(og);
        out(og, { roomS: 0.2 });
        o.start(t);
        o.stop(t + 0.2);
        t += step;
        k++;
      }
    }

    // debugging aid: window.__MUTE = ["kick", ...] silences an instrument
    const MUTE = new Set(window.__MUTE || []);
    const gate = (name, fn) => (...args) => (MUTE.has(name) ? undefined : fn(...args));
    bell = gate("bell", bell);
    pluck = gate("pluck", pluck);
    pad = gate("pad", pad);
    bass = gate("bass", bass);
    kick = gate("kick", kick);
    hat = gate("hat", hat);
    clap = gate("clap", clap);
    tick = gate("tick", tick);
    whoosh = gate("whoosh", whoosh);
    swell = gate("swell", swell);
    reverseChord = gate("reverseChord", reverseChord);
    impact = gate("impact", impact);
    stab = gate("stab", stab);
    shimmer = gate("shimmer", shimmer);
    riser = gate("riser", riser);
    snareRoll = gate("snareRoll", snareRoll);

    // ============================================================ SCORE
    const Dm_add9 = [50, 57, 60, 64, 65];
    const Bb_maj9 = [46, 53, 57, 60, 62];
    const G_m9 = [43, 50, 53, 57, 58];
    const A_sus = [45, 52, 55, 62];
    const A_maj = [45, 52, 55, 61];
    const D_maj9 = [50, 57, 61, 64, 66];
    const B_m11 = [47, 54, 57, 62, 64];
    const G_maj9 = [43, 50, 54, 57, 59];
    const D_add9 = [50, 57, 64, 66, 69];
    const minorPenta = [74, 77, 79, 81, 84, 86];
    const majorPenta = [74, 76, 78, 81, 83, 86, 88];

    // ---- 0. cold open: one point of light
    {
      // room tone and a low drone that barely breathes
      const n = noiseSrc(0, DUR);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.exponentialRampToValueAtTime(0.006, 1.2);
      g.gain.setTargetAtTime(0.0001, 3.0, 0.8);
      n.connect(lp);
      lp.connect(g);
      out(g, {});
      pad(0.15, T.launch + 0.2, [38, 45, 57], 0.07, { cutoff: [300, 700], attack: 1.4, release: 1.6, hallS: 0.3 });
    }
    // the dot ignites
    bell(T.dot, mtof(86), 0.11, { pan: 0.32, tau: 1.3, ratio: 3.5, index: 2.4, hallS: 0.45, delayS: 0.1 });
    bell(T.dot, mtof(74), 0.045, { pan: 0.32, tau: 1.6, ratio: 2.0, index: 0.8, hallS: 0.4 });
    // each letter of SAME TRAFFIC lights up (right to left)
    for (let i = 0; i < 12; i++) {
      if (i === 7) continue; // the space
      const tt = T.text + 0.045 * i + 0.06;
      const m = [86, 84, 81, 79, 77, 74, 72, 74, 72, 69, 67, 69][i];
      bell(tt, mtof(m + 12), 0.014, { pan: 0.3 - i * 0.05, tau: 0.25, ratio: 2.0, index: 0.6, hallS: 0.4 });
    }
    // heartbeat
    for (const t of [1.0, 1.25]) kick(t, t === 1.0 ? 0.14 : 0.09, { tau: 0.11, f0: 90, f1: 40 });
    // wind-up into the launch
    swell(T.launch, 0.3, 0.05, { f0: 800, f1: 5000 });
    reverseChord(T.launch, 0.55, [62, 69, 74], 0.05, 0.3);

    // ---- 1. launch + build
    impact(T.launch, 0.2);
    whoosh(T.launch - 0.02, 0.9, 0.08, { from: 300, peak: 2600, to: 400, panFrom: 0.4, panTo: -0.3, hallS: 0.35 });
    pad(T.launch, 4.0, Dm_add9, 0.08, { cutoff: [500, 1300], attack: 1.1, release: 0.9 });
    pad(4.0, 6.0, Bb_maj9, 0.11, { cutoff: [1100, 1700], attack: 0.35, release: 0.7 });
    pad(6.0, 7.0, G_m9, 0.14, { cutoff: [1500, 2200], attack: 0.25, release: 0.5 });
    pad(7.0, 7.5, A_sus, 0.17, { cutoff: [2000, 2800], attack: 0.15, release: 0.3 });
    pad(7.5, 7.86, A_maj, 0.18, { cutoff: [2600, 3600], attack: 0.1, release: 0.08 });

    // accent points: a pluck for each one, climbing as the build goes on
    S.accents.forEach((a, i) => {
      if (a.hero) return;
      const q = (a.t - 2) / 5.5;
      const idx = Math.min(minorPenta.length - 1, Math.floor(q * 3 + (i % 3)));
      const m = minorPenta[idx] + (q > 0.55 && i % 4 === 0 ? 12 : 0);
      pluck(a.t, mtof(m), (0.035 + 0.045 * Math.min(1, a.vol / 2)) * (0.55 + 0.6 * q), { pan: a.pan, cutoff: 3800 + 3000 * q, tau: 0.16 + 0.08 * q });
    });
    // heartbeat pulse, then a soft four on the floor
    for (let t = 2.5; t < 4.0; t += BEAT) kick(t, 0.12, { tau: 0.12, f0: 110, f1: 42 });
    for (let t = 4.0; t < 7.0; t += BEAT) kick(t, 0.2 + 0.18 * ((t - 4) / 3), { tau: 0.13 });
    for (let t = 7.0; t < 7.5; t += BEAT / 2) kick(t, 0.42, { tau: 0.1 });
    // bass
    for (let t = 4.0; t < 6.0; t += BEAT / 2) bass(t, BEAT / 2 - 0.02, 34, 0.1);
    for (let t = 6.0; t < 7.0; t += BEAT / 2) bass(t, BEAT / 2 - 0.02, 31, 0.14);
    for (let t = 7.0; t < 7.86; t += BEAT / 4) bass(t, BEAT / 4 - 0.02, 33, 0.17);
    // hats from bar 3
    for (let t = 5.0; t < 7.86; t += BEAT / 2) {
      hat(t + BEAT / 2 - 0.0, 0.05, { pan: 0.2 });
    }
    for (let t = 6.0; t < 7.86; t += BEAT / 4) hat(t, 0.02 + 0.03 * ((t - 6) / 1.9), { pan: -0.25 });
    // the hub ignites when the first point arrives
    bell(T.heroArrive, mtof(62), 0.08, { tau: 1.8, ratio: 2.0, index: 1.4, hallS: 0.5 });
    bell(T.heroArrive, mtof(69), 0.055, { tau: 1.6, ratio: 3.5, index: 1.8, hallS: 0.5, pan: 0.2 });
    kick(T.heroArrive, 0.3, { tau: 0.25, f0: 120, f1: 38 });
    // the cards wake up in the dark
    swell(T.cards, 0.6, 0.06, { f0: 200, f1: 1400 });
    bell(T.cards, mtof(57), 0.1, { tau: 1.2, ratio: 1.5, index: 1.2, hallS: 0.7, pan: -0.3 });
    // tension
    riser(6.0, 7.86, 0.2);
    snareRoll(7.0, 7.84, 0.26);
    // the pull into the hub
    reverseChord(7.88, 0.42, [69, 74, 78, 81], 0.14, 0);
    swell(7.88, 0.42, 0.18, { f0: 1200, f1: 9000 });

    // ---- 2. DROP
    impact(T.drop, 1.0);
    stab(T.drop, [50, 57, 61, 64, 66, 69], 0.42);
    shimmer(T.drop + 0.02, 0.9, 10, 0.05, [74, 76, 78, 81, 83]);
    // the ten connections light up, one after the other
    for (let j = 0; j < S.ring.count; j++) {
      const t = S.ring.litAt(j);
      const ang = S.ringRotation(t) + (j / S.ring.count) * Math.PI * 2 - 0.35;
      bell(t, mtof(majorPenta[j % majorPenta.length] + (j >= 7 ? 12 : 0)), 0.07, { pan: 0.75 * Math.cos(ang), tau: 0.5, ratio: 3.5, index: 1.6, hallS: 0.45, delayS: 0.1 });
    }
    // groove: half-time, forward leaning
    const grooveKicks = [0, 0.75, 1.25];
    for (let bar = 8.0; bar < 12.0; bar += 2) {
      for (const k of grooveKicks) if (!(bar === 8.0 && k === 0)) kick(bar + k, 0.6, { tau: 0.14 });
      if (bar === 10.0) kick(bar + 1.75, 0.45, { tau: 0.1 });
      clap(bar + 1.0, 0.5);
      for (let s = 0; s < 16; s++) {
        const tt = bar + s * (BEAT / 4);
        const acc = s % 4 === 2 ? 0.1 : s % 2 ? 0.035 : 0.05;
        hat(tt, acc, { pan: s % 2 ? 0.28 : -0.12, open: s % 8 === 6 });
      }
    }
    // bass line
    const bassPlan = [
      [8.0, 10.0, 38],
      [10.0, 12.0, 35],
      [12.0, 14.0, 31],
    ];
    for (const [a, b, m] of bassPlan) {
      for (let t = a; t < b - 0.01; t += BEAT / 2) {
        const oct = Math.round((t - a) / (BEAT / 2)) % 4 === 3 ? 12 : 0;
        bass(t, BEAT / 2 - 0.03, m + oct, a === 12.0 ? 0.2 : 0.28);
      }
    }
    // pads after the drop
    pad(T.drop, 10.0, D_maj9, 0.25, { cutoff: [2600, 2000], attack: 0.02, release: 0.4 });
    pad(10.0, 12.0, B_m11, 0.24, { cutoff: [1900, 2300], attack: 0.25, release: 0.4 });
    pad(12.0, 14.0, G_maj9, 0.25, { cutoff: [1400, 2600], attack: 0.3, release: 0.35 });
    // arpeggio: sixteenths on the network pulses
    const arpNotes = {
      8: [74, 78, 81, 85, 86, 85, 81, 78],
      10: [71, 74, 78, 81, 83, 81, 78, 74],
      12: [67, 71, 74, 78, 79, 78, 74, 71],
    };
    for (const bar of [8, 10, 12]) {
      for (let s = 0; s < 16; s++) {
        const t = bar + s * (BEAT / 4);
        if (bar === 12 && s % 2) continue;
        const m = arpNotes[bar][s % 8] + (s >= 8 && bar !== 12 ? 12 : 0);
        pluck(t, mtof(m), 0.07, { pan: Math.sin(s * 1.3) * 0.5, cutoff: bar === 12 ? 2600 : 4200, tau: 0.12, delayS: 0.22, hallS: 0.2 });
      }
    }

    // ---- 3. whip + 38%
    swell(T.whip, 0.22, 0.1, { f0: 900, f1: 5000 });
    whoosh(T.whip - 0.05, 0.42, 0.34, { from: 700, peak: 6000, to: 800, panFrom: 0.8, panTo: -0.8, hallS: 0.25 });
    impact(T.stat, 0.35);
    // the counter, one tick per step
    for (const tk of S.countTicks) tick(tk.t, 0.028 + 0.02 * (tk.v / 38), -0.3);
    {
      // a tone that climbs with the number
      const o = ctx.createOscillator();
      o.type = "sine";
      const t0 = T.count0;
      const t1 = S.countTicks[S.countTicks.length - 1].t;
      o.frequency.setValueAtTime(mtof(62), t0);
      o.frequency.setTargetAtTime(mtof(81), t0, (t1 - t0) / 4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.035, t0 + 0.05);
      g.gain.setTargetAtTime(0.0001, t1 - 0.1, 0.1);
      o.connect(g);
      out(g, { hallS: 0.3, pan: -0.3 });
      o.start(t0);
      o.stop(t1 + 1);
      const hit = t1;
      bell(hit, mtof(81), 0.12, { pan: -0.3, tau: 0.9, ratio: 3.5, index: 2, hallS: 0.5, delayS: 0.15 });
      bell(hit + 0.06, mtof(88), 0.09, { pan: -0.2, tau: 0.8, ratio: 3.5, index: 2, hallS: 0.5 });
    }

    // ---- 4. dive into the light, YOUR BRAND, NOT OURS
    swell(T.brand, 0.3, 0.16, { f0: 500, f1: 10000, hallS: 0.4 });
    reverseChord(T.brand, 0.35, [67, 74, 78, 83], 0.1, 0);
    stab(T.brand, [55, 62, 66, 69, 71], 0.22);
    kick(T.brand, 0.6, { tau: 0.18, f0: 120, f1: 40 });
    for (const [t, m, p] of [
      [T.brand + 0.02, 74, 0],
      [T.brand + 0.12, 78, -0.5],
      [T.brand + 0.18, 81, 0.5],
    ]) {
      pluck(t, mtof(m), 0.1, { pan: p, tau: 0.25, cutoff: 3000, hallS: 0.35 });
    }
    // the brand marks stamp onto app, site and portal
    for (let i = 0; i < 3; i++) {
      const t = T.brand + 0.36 + 0.07 * i;
      bell(t, mtof([86, 90, 93][i]), 0.06, { pan: [0.5, -0.5, 0][i], tau: 0.35, ratio: 1.5, index: 1, hallS: 0.4 });
      tick(t, 0.05, [0.5, -0.5, 0][i]);
    }
    // lighter groove under the brand
    kick(12.75, 0.55, { tau: 0.12 });
    clap(13.0, 0.35);
    for (let s = 0; s < 12; s++) hat(12.0 + s * (BEAT / 4) + BEAT / 4, s % 2 ? 0.03 : 0.06, { pan: 0.2 });
    // collapse into one point
    swell(T.logo, 0.4, 0.2, { f0: 600, f1: 9000, hallS: 0.35 });
    reverseChord(T.logo, 0.5, [74, 78, 81, 86], 0.13, 0);
    whoosh(T.collapse + 0.05, 0.35, 0.12, { from: 2000, peak: 5000, to: 1200, panFrom: -0.5, panTo: 0.5 });

    // ---- 5. logo: the brand sting
    impact(T.logo, 0.45);
    pad(T.logo, 15.6, D_add9, 0.24, { cutoff: [3200, 1400], attack: 0.02, release: 2.4, hallS: 0.55 });
    bell(T.logo, mtof(86), 0.2, { tau: 1.6, ratio: 3.5, index: 2.2, hallS: 0.6, delayS: 0.12 });
    bell(T.logo + 0.01, mtof(81), 0.14, { tau: 1.5, ratio: 2.0, index: 1.4, hallS: 0.6, pan: -0.3 });
    bell(T.logo + 0.02, mtof(90), 0.1, { tau: 1.4, ratio: 3.5, index: 1.6, hallS: 0.6, pan: 0.3 });
    bell(T.logo + 0.03, mtof(62), 0.16, { tau: 2.2, ratio: 2.0, index: 1, hallS: 0.5 });
    shimmer(T.logo + 0.1, 0.9, 16, 0.045, [86, 88, 90, 93, 95]);
    swell(T.logo + 0.35, 0.3, 0.05, { f0: 3000, f1: 12000 }); // the slit of light
    bass(T.logo, 2.6, 38, 0.3);

    // ---- 6. end card
    whoosh(T.end - 0.02, 0.7, 0.07, { from: 300, peak: 1800, to: 500, panFrom: 0, panTo: 0 });
    bell(T.end + 0.22, mtof(81), 0.09, { tau: 0.9, ratio: 3.5, index: 1.6, hallS: 0.5, delayS: 0.15, pan: 0.1 });
    bell(T.end + 0.34, mtof(86), 0.08, { tau: 1.1, ratio: 3.5, index: 1.6, hallS: 0.55, delayS: 0.15, pan: -0.1 });
    pad(15.3, 18.2, [50, 57, 64, 69], 0.16, { cutoff: [1200, 700], attack: 0.8, release: 1.5, hallS: 0.6 });
    for (const t of [16.15, 17.1]) {
      shimmer(t, 0.6, 5, 0.022, [86, 88, 90, 93]);
    }

    applyDucks();
    const buf = await ctx.startRendering();
    return buf;
  }

  // Linked stereo lookahead limiter (3 ms lookahead, 80 ms release), run on
  // the rendered samples so it cannot pump the quiet passages.
  function limit(L, Rr, pre, ceiling) {
    const n = L.length;
    const look = Math.round(0.003 * SR);
    const need = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.max(Math.abs(L[i]), Math.abs(Rr[i])) * pre;
      need[i] = a > ceiling ? ceiling / a : 1;
    }
    // minimum over the lookahead window (monotonic deque)
    const win = new Float32Array(n);
    const dq = new Int32Array(n);
    let h = 0;
    let tl = 0;
    for (let i = n - 1; i >= 0; i--) {
      while (tl > h && need[dq[tl - 1]] >= need[i]) tl--;
      dq[tl++] = i;
      while (dq[h] > i + look) h++;
      win[i] = need[dq[h]];
    }
    const rel = Math.exp(-1 / (0.08 * SR));
    let g = 1;
    let reduced = 0;
    const blk = Math.round(0.25 * SR);
    const grMax = new Array(Math.ceil(n / blk)).fill(0);
    for (let i = 0; i < n; i++) {
      const target = win[i];
      g = target < g ? target : target + (g - target) * rel;
      if (g < 0.999) reduced++;
      const db = -20 * Math.log10(g);
      const k = Math.floor(i / blk);
      if (db > grMax[k]) grMax[k] = db;
      L[i] *= pre * g;
      Rr[i] *= pre * g;
    }
    limit.grMax = grMax;
    return reduced / n;
  }

  // 24-bit PCM WAV
  function toWav(buf) {
    const L = buf.getChannelData(0);
    const Rr = buf.getChannelData(1);
    let rawPeak = 0;
    for (let i = 0; i < L.length; i++) rawPeak = Math.max(rawPeak, Math.abs(L[i]), Math.abs(Rr[i]));
    const reducedFrac = limit(L, Rr, window.__PREGAIN || 1, Math.pow(10, -1.5 / 20));
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < L.length; i++) {
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i]));
      sum += L[i] * L[i] + Rr[i] * Rr[i];
    }
    const gain = 1;
    const n = L.length;
    const bytes = 44 + n * 2 * 3;
    const ab = new ArrayBuffer(bytes);
    const v = new DataView(ab);
    const w = (o, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
    };
    w(0, "RIFF");
    v.setUint32(4, bytes - 8, true);
    w(8, "WAVE");
    w(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 2, true);
    v.setUint32(24, SR, true);
    v.setUint32(28, SR * 6, true);
    v.setUint16(32, 6, true);
    v.setUint16(34, 24, true);
    w(36, "data");
    v.setUint32(40, n * 6, true);
    let o = 44;
    for (let i = 0; i < n; i++) {
      for (const ch of [L, Rr]) {
        let x = Math.max(-1, Math.min(1, ch[i] * gain));
        let q = Math.round(x * 8388607);
        v.setUint8(o, q & 255);
        v.setUint8(o + 1, (q >> 8) & 255);
        v.setUint8(o + 2, (q >> 16) & 255);
        o += 3;
      }
    }
    const u8 = new Uint8Array(ab);
    let bin = "";
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { b64: btoa(bin), peak, gain: rawPeak, rms: Math.sqrt(sum / (2 * n)), reducedFrac, grMax: limit.grMax };
  }

  window.renderSoundtrack = async function () {
    const buf = await render();
    return toWav(buf);
  };
})();
