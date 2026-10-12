/* PilotTube motion graphics runtime (HyperFrames composition "motion").
   Reads window.MOTION = { beats, total, handle }. One paused GSAP timeline; deterministic (no Math.random).
   Techniques follow HyperFrames' animation rules: kinetic-beat-slam, motion-blur-streak, spring-pop-entrance,
   counting-dynamic-scale, chromatic-glitch, particle-burst, svg-path-draw, multi-phase-camera. */
(function () {
  const { beats: BEATS, total: TOTAL, handle: HANDLE } = window.MOTION;
  const tl = gsap.timeline({ paused: true });
  const SVGNS = "http://www.w3.org/2000/svg";

  // ---------- helpers ----------
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9$%]/g, "");
  /** Words in overflow masks (rise-from-mask reveal). The word matching `hot` gets a marker box. */
  const maskWords = (text, hot, cls) => {
    const wrap = el("div", cls);
    const key = norm(hot);
    let marked = false;
    String(text).split(/\s+/).filter(Boolean).forEach((w) => {
      const outer = el("span", "mw");
      const inner = el("span", "mi", w);
      const c = norm(w);
      if (key && !marked && c && (c === key || (c.length > 3 && (key.includes(c) || c.includes(key))))) {
        inner.classList.add("hot");
        inner.prepend(el("span", "mark"));
        marked = true;
      }
      outer.append(inner);
      wrap.append(outer);
    });
    return wrap;
  };
  /** Shrink text until it fits its box width and line budget (big glyphs overhang their line box: slack). */
  const fit = (node, start, min, maxLines) => {
    let size = start;
    node.style.fontSize = size + "px";
    const lh = () => parseFloat(getComputedStyle(node).lineHeight) || size;
    while ((node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > lh() * maxLines * 1.25 + 6) && size > min) {
      size -= 6;
      node.style.fontSize = size + "px";
    }
  };
  const svg = (tag, attrs) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

  // ---------- camera: slow push per beat + impact punch/shake ----------
  const shakeEl = document.getElementById("shake");
  const shakeAmp = { a: 0 };
  const writeShake = () => {
    const step = Math.floor(tl.time() / 0.033);
    gsap.set(shakeEl, { x: (hash(step * 3) * 2 - 1) * 26 * shakeAmp.a, y: (hash(step * 7 + 1) * 2 - 1) * 18 * shakeAmp.a, rotation: (hash(step * 11 + 2) * 2 - 1) * 0.6 * shakeAmp.a });
  };
  const shake = (at, strength = 1, dur = 0.45) => {
    tl.set(shakeAmp, { a: strength }, at);
    tl.to(shakeAmp, { a: 0, duration: dur, ease: "power3.in", onUpdate: writeShake }, at);
    tl.set(shakeEl, { x: 0, y: 0, rotation: 0 }, at + dur);
  };
  const punch = (at) => tl.fromTo("#cam", { scale: 1.07 }, { scale: 1, duration: 0.5, ease: "expo.out" }, at);

  // ---------- background (whole video) ----------
  tl.to("#aur-a", { x: 420, y: 560, scale: 1.2, duration: TOTAL, ease: "sine.inOut" }, 0)
    .to("#aur-b", { x: -380, y: -700, scale: 0.85, duration: TOTAL, ease: "sine.inOut" }, 0)
    .to("#aur-c", { x: 260, y: -900, duration: TOTAL, ease: "sine.inOut" }, 0)
    .fromTo("#floor-grid", { y: 0 }, { y: 140 * Math.ceil(TOTAL / 1.2), duration: TOTAL, ease: "none" }, 0)
    .fromTo("#progress-fill", { scaleX: 0 }, { scaleX: 1, duration: TOTAL, ease: "none" }, 0)
    .from("#kicker", { x: -60, opacity: 0, duration: 0.6, ease: "expo.out" }, 0.1)
    .from(".bracket", { scale: 1.6, opacity: 0, duration: 0.6, ease: "expo.out", stagger: 0.06 }, 0.15);
  // Live dot blinks for the whole video (finite repeat: total / period).
  tl.to("#live", { opacity: 0.25, duration: 0.5, yoyo: true, repeat: Math.max(0, Math.floor(TOTAL / 0.5) - 1), ease: "sine.inOut" }, 0);

  // Floating particles: deterministic pool, one driver.
  const field = document.getElementById("particles");
  const dots = [];
  for (let i = 0; i < 34; i++) {
    const d = el("div", "dot");
    const size = 3 + hash(i * 3 + 1) * 7;
    Object.assign(d.style, { width: size + "px", height: size + "px", left: hash(i * 5 + 2) * 1080 + "px", opacity: String(0.15 + hash(i * 7 + 3) * 0.45) });
    field.append(d);
    dots.push({ d, y0: hash(i * 11 + 4) * 1920, speed: 30 + hash(i * 13 + 5) * 90, sway: 10 + hash(i * 17 + 6) * 30 });
  }
  const drive = { t: 0 };
  tl.to(drive, {
    t: TOTAL, duration: TOTAL, ease: "none",
    onUpdate: () => dots.forEach((p, i) => {
      const y = (((p.y0 - drive.t * p.speed) % 1980) + 1980) % 1980 - 30;
      p.d.style.transform = `translate(${Math.sin(drive.t * 0.8 + i) * p.sway}px, ${y}px)`;
    }),
  }, 0);

  // ---------- transitions between beats ----------
  gsap.set(["#wipe-a", "#wipe-b"], { skewX: -18, x: -2600 });
  BEATS.forEach((b, i) => {
    if (i === 0) return;
    const at = b.start - 0.28;
    const dir = i % 2 ? 1 : -1;
    tl.fromTo("#wipe-a", { x: -2600 * dir }, { x: 2600 * dir, duration: 0.56, ease: "power2.inOut" }, at)
      .fromTo("#wipe-b", { x: -2600 * dir }, { x: 2600 * dir, duration: 0.56, ease: "power2.inOut" }, at + 0.07)
      .fromTo("#flash", { opacity: 0.18 }, { opacity: 0, duration: 0.3, ease: "power2.out" }, b.start);
  });

  // ---------- beats ----------
  const N = BEATS.filter((b) => b.type !== "outro").length;
  BEATS.forEach((b, i) => {
    const root = document.getElementById("b" + i);
    const t = b.start;
    const end = b.start + b.duration;
    const c = el("div", "content");
    root.append(c);
    const q = (s) => root.querySelectorAll(s);

    if (b.type !== "outro") {
      const n = el("div", "count");
      n.append(el("b", null, String(i + 1).padStart(2, "0")), document.createTextNode(" / " + String(N).padStart(2, "0")));
      root.append(n);
      tl.from(n, { y: -30, opacity: 0, duration: 0.4, ease: "expo.out" }, t + 0.05);
    }
    // Slow push-in under every beat (camera feel without moving the layout).
    tl.fromTo(c, { scale: 0.97 }, { scale: 1.03, duration: b.duration, ease: "none" }, t);

    if (b.type === "statement") {
      const w = maskWords(b.text, b.highlight, "display stext");
      c.append(w, el("div", "underline"));
      fit(w, 150, 80, 6);
      tl.from(q(".mi"), { yPercent: 115, rotation: 4, duration: 0.55, ease: "expo.out", stagger: Math.min(0.07, 0.9 / Math.max(1, q(".mi").length)) }, t + 0.08)
        .from(q(".mark"), { scaleX: 0, duration: 0.45, ease: "expo.inOut" }, t + 0.55)
        .from(q(".underline"), { scaleX: 0, duration: 0.6, ease: "expo.out" }, t + 0.45);
    } else if (b.type === "keyword") {
      const stack = el("div", "kw-stack");
      const main = el("div", "display kw", b.text);
      stack.append(main);
      c.append(stack);
      fit(main, 260, 110, 3);
      const size = main.style.fontSize;
      ["kw-echo", "kw-echo", "kw-rgb r", "kw-rgb c"].forEach((cls) => { const e = el("div", "display kw " + cls, b.text); e.style.fontSize = size; stack.insertBefore(e, main); });
      const echoes = q(".kw-echo");
      if (b.sub) c.append(el("div", "sub", b.sub));
      // Slam from blur (kinetic-beat-slam) + outline echoes flying out (3d-text-depth-layers).
      tl.fromTo(main, { scale: 1.7, filter: "blur(22px)", opacity: 0 }, { scale: 1, filter: "blur(0px)", opacity: 1, duration: 0.5, ease: "power4.out" }, t + 0.05);
      echoes.forEach((e, k) => tl.fromTo(e, { scale: 1, opacity: 0.8 }, { scale: 1.35 + k * 0.25, opacity: 0, duration: 0.9, ease: "power2.out" }, t + 0.35 + k * 0.08));
      punch(t + 0.35);
      shake(t + 0.35, 0.6, 0.35);
      // RGB glitch on landing (chromatic-glitch, form A).
      const rgb = q(".kw-rgb");
      const amp = { a: 0 };
      tl.set(amp, { a: 1 }, t + 0.38).set(rgb, { opacity: 0.85 }, t + 0.38);
      tl.to(amp, { a: 0, duration: 0.45, ease: "power3.in", onUpdate: () => {
        const step = Math.floor(tl.time() / 0.04);
        rgb.forEach((r, k) => gsap.set(r, { x: (hash(step * 13 + k * 7) * 2 - 1) * 26 * amp.a, y: (hash(step * 29 + k * 11) * 2 - 1) * 8 * amp.a }));
      } }, t + 0.38);
      tl.set(rgb, { x: 0, y: 0, opacity: 0 }, t + 0.83);
      if (b.sub) tl.from(q(".sub"), { y: 40, opacity: 0, duration: 0.5, ease: "expo.out" }, t + 0.6);
    } else if (b.type === "number") {
      const wrap = el("div", "num-wrap");
      const ring = svg("svg", { class: "ring", viewBox: "0 0 820 820" });
      const defs = svg("defs", {});
      const grad = svg("linearGradient", { id: "ring-grad-" + i, x1: "0", y1: "0", x2: "1", y2: "1" });
      grad.append(svg("stop", { offset: "0%", "stop-color": getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#7cff6b" }), svg("stop", { offset: "100%", "stop-color": "#ff3b47" }));
      defs.append(grad);
      const R = 380, C = 2 * Math.PI * R;
      const arc = svg("circle", { class: "arc", cx: "410", cy: "410", r: String(R), stroke: `url(#ring-grad-${i})`, transform: "rotate(-90 410 410)", "stroke-dasharray": String(C), "stroke-dashoffset": String(C) });
      ring.append(defs, svg("circle", { class: "track", cx: "410", cy: "410", r: String(R) }), arc);
      const glow = el("div", "num-glow");
      const numEl = el("div", "display num", b.value);
      wrap.append(glow, ring, numEl);
      c.append(wrap, el("div", "label", b.label));
      fit(numEl, 240, 110, 1);
      // Sparks for the burst, generated once (particle-burst).
      const sparks = [];
      for (let k = 0; k < 26; k++) {
        const s = el("div", "spark");
        s.style.background = k % 2 ? "var(--accent)" : "var(--hot)";
        wrap.append(s);
        const ang = hash(i * 97 + k * 5) * Math.PI * 2;
        sparks.push({ s, vx: Math.cos(ang) * (380 + hash(k * 7 + i) * 320), vy: Math.sin(ang) * (380 + hash(k * 11 + i) * 320), spin: (hash(k * 13) * 2 - 1) * 540 });
      }
      const COUNT = 1.1;
      tl.from(wrap, { scale: 0.6, opacity: 0, duration: 0.5, ease: "back.out(1.6)" }, t);
      tl.to(arc, { attr: { "stroke-dashoffset": 0 }, duration: COUNT, ease: "power2.inOut" }, t + 0.15);
      const m = String(b.value).match(/^([^\d]*)(\d[\d,]*(?:\.\d+)?)(.*)$/);
      if (m) {
        const target = parseFloat(m[2].replace(/,/g, ""));
        const dec = (m[2].split(".")[1] || "").length;
        const st = { v: 0 };
        tl.to(st, { v: target, duration: COUNT, ease: "power2.out", onUpdate: () => { numEl.textContent = m[1] + st.v.toFixed(dec) + m[3]; } }, t + 0.15);
        tl.fromTo(numEl, { scale: 0.55 }, { scale: 1, duration: COUNT, ease: "power2.out" }, t + 0.15);
      } else {
        tl.from(numEl, { scale: 0.4, opacity: 0, filter: "blur(16px)", duration: 0.6, ease: "back.out(2)" }, t + 0.15);
      }
      const burstAt = t + 0.15 + COUNT;
      tl.fromTo(glow, { opacity: 0, scale: 0.6 }, { opacity: 0.55, scale: 1.1, duration: 0.35, ease: "power2.out" }, burstAt)
        .to(glow, { opacity: 0.18, duration: 0.8, ease: "power2.in" }, burstAt + 0.35);
      const flight = { T: 0 };
      tl.fromTo(flight, { T: 0 }, { T: 1, duration: 0.9, ease: "none", onUpdate: () => {
        const tt = flight.T * 0.9;
        sparks.forEach((p) => {
          p.s.style.transform = `translate(${p.vx * tt}px, ${p.vy * tt + 600 * tt * tt}px) rotate(${p.spin * tt}deg)`;
          p.s.style.opacity = flight.T === 0 ? "0" : String(Math.max(0, 1 - flight.T));
        });
      } }, burstAt);
      punch(burstAt);
      tl.from(q(".label"), { y: 50, opacity: 0, duration: 0.5, ease: "expo.out" }, t + 0.5);
    } else if (b.type === "quote") {
      const card = el("div", "card");
      const txt = maskWords(b.text, "", "qtext");
      card.append(el("div", "qglyph", "“"), txt);
      if (b.source) { const s = el("div", "qsrc"); s.append(el("i"), el("span", null, b.source)); card.append(s); }
      c.append(card);
      fit(txt, 78, 50, 7);
      tl.fromTo(card, { y: 160, scale: 0.85, opacity: 0, rotation: -3 }, { y: 0, scale: 1, opacity: 1, rotation: 0, duration: 0.7, ease: "back.out(1.4)" }, t)
        .from(q(".qglyph"), { scale: 0, rotation: -40, duration: 0.55, ease: "back.out(2.5)", transformOrigin: "50% 60%" }, t + 0.25)
        .from(q(".mi"), { opacity: 0, filter: "blur(12px)", y: 20, duration: 0.45, ease: "power2.out", stagger: Math.min(0.06, 1.1 / Math.max(1, q(".mi").length)) }, t + 0.35);
      if (b.source) tl.from(q(".qsrc i"), { scaleX: 0, duration: 0.5, ease: "expo.out" }, t + 0.9).from(q(".qsrc span"), { x: -30, opacity: 0, duration: 0.45 }, t + 1.0);
    } else if (b.type === "vs") {
      root.append(el("div", "vs-panel top"), el("div", "vs-panel bottom"));
      const l = el("div", "display vs-name l", b.left);
      const r = el("div", "display vs-name r", b.right);
      root.append(l, r, el("div", "vs-slash"), el("div", "vs-ring"), el("div", "vs-badge", "VS"));
      if (b.note) root.append(el("div", "vs-note", b.note));
      fit(l, 170, 80, 2);
      fit(r, 170, 80, 2);
      c.remove();
      tl.from(q(".vs-panel.top"), { xPercent: -100, duration: 0.5, ease: "expo.out" }, t)
        .from(q(".vs-panel.bottom"), { xPercent: 100, duration: 0.5, ease: "expo.out" }, t + 0.08)
        .fromTo(l, { x: -900, filter: "blur(30px)" }, { x: 0, filter: "blur(0px)", duration: 0.55, ease: "expo.out" }, t + 0.1)
        .fromTo(r, { x: 900, filter: "blur(30px)" }, { x: 0, filter: "blur(0px)", duration: 0.55, ease: "expo.out" }, t + 0.25)
        .from(q(".vs-slash"), { scaleX: 0, duration: 0.35, ease: "power4.out" }, t + 0.55)
        .from(q(".vs-badge"), { scale: 0, rotation: -180, duration: 0.6, ease: "back.out(2.6)" }, t + 0.6)
        .fromTo(q(".vs-ring"), { scale: 1, opacity: 0.9 }, { scale: 2.6, opacity: 0, duration: 0.8, ease: "power2.out" }, t + 0.75);
      shake(t + 0.7, 1, 0.5);
      punch(t + 0.7);
      if (b.note) tl.from(q(".vs-note"), { y: 30, opacity: 0, duration: 0.45 }, t + 1.0);
    } else if (b.type === "timeline") {
      const box = el("div", "tl");
      box.append(el("div", "tl-rail"), el("div", "tl-fill"));
      b.steps.forEach((s, k) => { const step = el("div", "tl-step", s); step.prepend(el("div", "tl-node", String(k + 1))); box.append(step); });
      c.append(el("div", "tag", "Timeline"), box);
      const gap = Math.min(0.6, (b.duration - 1.0) / b.steps.length);
      tl.from(q(".tag"), { x: -40, opacity: 0, duration: 0.4, ease: "expo.out" }, t)
        .from(q(".tl-fill"), { scaleY: 0, duration: gap * b.steps.length + 0.2, ease: "none" }, t + 0.2);
      q(".tl-step").forEach((s, k) => {
        tl.from(s, { x: 120, opacity: 0, duration: 0.5, ease: "expo.out" }, t + 0.2 + k * gap)
          .from(s.querySelector(".tl-node"), { scale: 0, duration: 0.45, ease: "back.out(3)" }, t + 0.25 + k * gap);
      });
    } else if (b.type === "list") {
      const title = el("div", "display ltitle", b.title);
      c.append(title);
      fit(title, 120, 70, 2);
      b.items.forEach((s) => {
        const row = el("div", "lrow");
        const chk = el("div", "lcheck");
        const s2 = svg("svg", { viewBox: "0 0 52 52" });
        s2.append(svg("path", { d: "M12 27 L22 37 L41 16", "stroke-dasharray": "48", "stroke-dashoffset": "48" }));
        chk.append(s2);
        row.append(chk, el("span", null, s));
        c.append(row);
      });
      const gap = Math.min(0.5, (b.duration - 1.0) / b.items.length);
      tl.fromTo(title, { scale: 1.4, opacity: 0, filter: "blur(14px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "power4.out" }, t);
      q(".lrow").forEach((row, k) => {
        tl.from(row, { y: 120, opacity: 0, scale: 0.9, duration: 0.55, ease: "back.out(1.6)" }, t + 0.35 + k * gap)
          .to(row.querySelector("path"), { attr: { "stroke-dashoffset": 0 }, duration: 0.35, ease: "power2.out" }, t + 0.6 + k * gap);
      });
    } else if (b.type === "question") {
      const qbig = el("div", "display qbig", "?");
      qbig.append(el("div", "qring"));
      const w = maskWords(b.text, "", "display qtxt");
      const pill = el("div", "pill", "Comment below 👇");
      c.append(qbig, w, pill);
      fit(w, 120, 64, 4);
      tl.fromTo(qbig, { rotation: -60, scale: 0, transformOrigin: "30% 90%" }, { rotation: 0, scale: 1, duration: 0.8, ease: "elastic.out(1, 0.5)" }, t)
        .from(q(".mi"), { yPercent: 115, duration: 0.5, ease: "expo.out", stagger: 0.05 }, t + 0.3)
        .from(pill, { scale: 0, opacity: 0, duration: 0.5, ease: "back.out(2.4)" }, t + 0.9);
      [0.6, 1.2, 1.8].forEach((d) => { if (t + d + 0.8 < end) tl.fromTo(q(".qring"), { scale: 0.8, opacity: 0.8 }, { scale: 2.2, opacity: 0, duration: 0.8, ease: "power2.out" }, t + d); });
    } else if (b.type === "outro") {
      const txt = maskWords(b.text, "", "display outro-text");
      const btn = el("div", "sub-btn");
      const bell = svg("svg", { class: "bell", viewBox: "0 0 24 24" });
      bell.append(svg("path", { d: "M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" }));
      btn.append(el("span", null, "SUBSCRIBE"));
      const done = el("div", "done");
      done.append(el("span", null, "SUBSCRIBED ✓"), bell);
      btn.append(done);
      c.append(txt, btn);
      if (HANDLE) c.append(el("div", "handle", HANDLE.startsWith("@") ? HANDLE : "@" + HANDLE));
      fit(txt, 150, 80, 4);
      tl.from(q(".mi"), { yPercent: 115, duration: 0.55, ease: "expo.out", stagger: 0.06 }, t + 0.05)
        .from(btn, { y: 80, scale: 0.7, opacity: 0, duration: 0.55, ease: "back.out(2)" }, t + 0.45)
        // The press: squash, then flip to SUBSCRIBED and ring the bell.
        .to(btn, { scale: 0.9, duration: 0.12, ease: "power2.in" }, t + 1.15)
        .to(btn, { scale: 1, duration: 0.4, ease: "back.out(3)" }, t + 1.27)
        .to(done, { opacity: 1, duration: 0.15 }, t + 1.2)
        .to(bell, { rotation: 18, duration: 0.08, yoyo: true, repeat: 5, ease: "sine.inOut" }, t + 1.4);
      if (HANDLE) tl.from(q(".handle"), { opacity: 0, y: 20, duration: 0.4 }, t + 0.8);
    }

    // Exit just before the wipe covers the frame (the last beat holds to the end).
    if (i < BEATS.length - 1) tl.to(c, { opacity: 0, scale: 1.08, filter: "blur(10px)", duration: 0.28, ease: "power2.in" }, end - 0.3);
  });

  window.__timelines = window.__timelines || {};
  window.__timelines["motion"] = tl;
  tl.seek(0);
})();
