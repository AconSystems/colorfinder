/* app.js v9.1 init fix + existing index.html UI */
(() => {
  "use strict";

  const VERSION = "v9.1";
  const BASE_PATH = "/colorfinder/daten-os/";

  const CORE_ASSETS = [
    `${BASE_PATH}`,
    `${BASE_PATH}index.html`,
    `${BASE_PATH}style.css`,
    `${BASE_PATH}app.js`,
    `${BASE_PATH}sw.js`,
    `${BASE_PATH}manifest.webmanifest`,
    `${BASE_PATH}icons/icon-192.png`,
    `${BASE_PATH}icons/icon-512.png`
  ];

  const LS_OFFLINE_READY_KEY = `offlineReady_${VERSION}`;
  const LS_WB_KEY = "colorfinder_wb_v1";

  const $ = (id) => document.getElementById(id);

  const els = {
    videoShell: null,
    video: null,
    canvas: null,
    tapHint: null,
    tapRing: null,

    btnStart: null,
    btnLight: null,
    btnWB: null,

    statusText: null,

    swatch: null,
    colorName: null,
    colorDesc: null,

    outHex: null,
    outRgb: null,
    outHsl: null,
    outCss: null,

    toast: null
  };

  function bindEls() {
    els.videoShell = $("videoShell");
    els.video = $("video");
    els.canvas = $("canvas");
    els.tapHint = $("tapHint");
    els.tapRing = $("tapRing");

    els.btnStart = $("btnStart");
    els.btnLight = $("btnLight");
    els.btnWB = $("btnWB");

    els.statusText = $("statusText");

    els.swatch = $("swatch");
    els.colorName = $("colorName");
    els.colorDesc = $("colorDesc");

    els.outHex = $("outHex");
    els.outRgb = $("outRgb");
    els.outHsl = $("outHsl");
    els.outCss = $("outCss");

    els.toast = $("toast");
  }

  function assertElements() {
    const required = [
      "videoShell","video","canvas","tapRing",
      "btnStart","btnLight","btnWB",
      "statusText",
      "swatch","colorName","colorDesc",
      "outHex","outRgb","outHsl","outCss"
    ];
    const missing = required.filter((k) => !els[k]);
    if (missing.length) {
      alert("Fehlende Elemente in index.html: " + missing.join(", "));
      throw new Error("Missing UI elements");
    }
  }

  function clamp255(n) {
    if (n < 0) return 0;
    if (n > 255) return 255;
    return n;
  }

  function rgbToHex(r, g, b) {
    const to2 = (v) => v.toString(16).padStart(2, "0").toUpperCase();
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  }

  function rgbToHsl(r, g, b) {
    let rr = r / 255, gg = g / 255, bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rr: h = (gg - bb) / d + (gg < bb ? 6 : 0); break;
        case gg: h = (bb - rr) / d + 2; break;
        case bb: h = (rr - gg) / d + 4; break;
      }
      h = h / 6;
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function toast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg || "";
    if (!msg) return;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { els.toast.textContent = ""; }, 1200);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast("kopiert");
        return;
      }
    } catch {}
    try {
      prompt("copy", text);
    } catch {}
  }

  function wireCopyButtons() {
    const btns = document.querySelectorAll("[data-copy]");
    btns.forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-copy");
        const el = document.getElementById(id);
        if (!el) return;
        copyText(el.textContent.trim());
      });
    });
  }

  let stream = null;
  let videoTrack = null;
  let hasTorch = false;
  let torchOn = false;

  let calibrateArmed = false;
  let wb = { has: false, enabled: false, gainR: 1, gainG: 1, gainB: 1 };

  function loadWb() {
    try {
      const raw = localStorage.getItem(LS_WB_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (!obj) return;
      if (typeof obj.gainR === "number" && typeof obj.gainG === "number" && typeof obj.gainB === "number") {
        wb.has = true;
        wb.enabled = !!obj.enabled;
        wb.gainR = obj.gainR;
        wb.gainG = obj.gainG;
        wb.gainB = obj.gainB;
      }
    } catch {}
  }

  function saveWb() {
    try {
      localStorage.setItem(LS_WB_KEY, JSON.stringify({
        enabled: wb.enabled,
        gainR: wb.gainR,
        gainG: wb.gainG,
        gainB: wb.gainB
      }));
    } catch {}
  }

  function applyWb(r, g, b) {
    if (!wb.has || !wb.enabled) return { r, g, b };
    return {
      r: clamp255(Math.round(r * wb.gainR)),
      g: clamp255(Math.round(g * wb.gainG)),
      b: clamp255(Math.round(b * wb.gainB))
    };
  }

  function computeWbFromWhiteSample(r, g, b) {
    const avg = (r + g + b) / 3;
    const gainR = avg / (r || 1);
    const gainG = avg / (g || 1);
    const gainB = avg / (b || 1);
    const norm = Math.max(gainR, gainG, gainB);

    wb.gainR = gainR / norm;
    wb.gainG = gainG / norm;
    wb.gainB = gainB / norm;
    wb.has = true;
    wb.enabled = true;
    saveWb();
  }

  function setStatus(text) {
    els.statusText.textContent = text;
  }

  function updateWBButton() {
    els.btnWB.disabled = false;
    if (!wb.has) {
      els.btnWB.textContent = calibrateArmed ? "weiss tippen" : "kalibrieren";
      return;
    }
    els.btnWB.textContent = wb.enabled ? "wb aus" : "wb an";
  }

  function updateTorchButton() {
    if (!hasTorch) {
      els.btnLight.disabled = true;
      els.btnLight.textContent = "licht";
      return;
    }
    els.btnLight.disabled = false;
    els.btnLight.textContent = torchOn ? "licht aus" : "licht an";
  }

  function stopCamera() {
    try {
      if (els.video) els.video.srcObject = null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    } catch {}

    stream = null;
    videoTrack = null;
    hasTorch = false;
    torchOn = false;

    els.btnStart.textContent = "kamera starten";
    updateTorchButton();
    setStatus("bereit");
  }

  async function startCamera() {
    if (stream) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Dieser Browser unterstuetzt keine Kamera API.");
      return;
    }

    try {
      setStatus("kamera startet");
      const constraints = {
        audio: false,
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      els.video.srcObject = stream;

      const tracks = stream.getVideoTracks();
      videoTrack = tracks && tracks[0] ? tracks[0] : null;

      hasTorch = false;
      torchOn = false;

      if (videoTrack && videoTrack.getCapabilities) {
        const caps = videoTrack.getCapabilities();
        if (caps && typeof caps.torch !== "undefined") hasTorch = !!caps.torch;
      }

      els.btnStart.textContent = "kamera stoppen";
      updateTorchButton();
      setStatus("bereit");

    } catch (e) {
      stopCamera();
      alert("Kamera Zugriff nicht moeglich. Safari Rechte pruefen.");
    }
  }

  async function toggleTorch() {
    if (!hasTorch || !videoTrack) return;
    try {
      torchOn = !torchOn;
      await videoTrack.applyConstraints({ advanced: [{ torch: torchOn }] });
    } catch {
      torchOn = false;
    }
    updateTorchButton();
  }

  function showRing(clientX, clientY) {
    const rect = els.videoShell.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    els.tapRing.style.left = `${x}px`;
    els.tapRing.style.top = `${y}px`;
    els.tapRing.style.opacity = "1";
    els.tapRing.style.transform = "translate(-50%,-50%) scale(1)";

    clearTimeout(showRing._t);
    showRing._t = setTimeout(() => {
      els.tapRing.style.opacity = "0";
    }, 220);
  }

  function sampleAt(clientX, clientY) {
    const v = els.video;
    if (!v.videoWidth || !v.videoHeight) return null;

    const rect = els.videoShell.getBoundingClientRect();
    const xNorm = (clientX - rect.left) / rect.width;
    const yNorm = (clientY - rect.top) / rect.height;

    const x = Math.floor(xNorm * v.videoWidth);
    const y = Math.floor(yNorm * v.videoHeight);

    if (x < 0 || y < 0 || x >= v.videoWidth || y >= v.videoHeight) return null;

    const c = els.canvas;
    const ctx = c.getContext("2d", { willReadFrequently: true });

    c.width = v.videoWidth;
    c.height = v.videoHeight;
    ctx.drawImage(v, 0, 0, c.width, c.height);

    const d = ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }

  function renderColor(r, g, b) {
    const hex = rgbToHex(r, g, b);
    const hsl = rgbToHsl(r, g, b);

    els.outHex.textContent = hex;
    els.outRgb.textContent = `${r}, ${g}, ${b}`;
    els.outHsl.textContent = `${hsl.h}, ${hsl.s}%, ${hsl.l}%`;
    els.outCss.textContent = `color: ${hex}; background: ${hex};`;

    els.swatch.style.background = hex;
    els.colorName.textContent = hex;
    els.colorDesc.textContent = calibrateArmed ? "weiss tippen zum kalibrieren" : "tippe ins videobild";
  }

  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    try {
      await navigator.serviceWorker.register(`${BASE_PATH}sw.js`, { scope: BASE_PATH });
    } catch {}
  }

  async function offlineWarmup() {
    try {
      if (localStorage.getItem(LS_OFFLINE_READY_KEY) === "1") return;
      if (!navigator.onLine) return;

      if ("serviceWorker" in navigator) {
        try { await navigator.serviceWorker.ready; } catch {}
      }

      await Promise.all(CORE_ASSETS.map((u) => fetch(u, { cache: "reload" }).catch(() => null)));
      localStorage.setItem(LS_OFFLINE_READY_KEY, "1");
    } catch {}
  }

  function wireEvents() {
    els.btnStart.addEventListener("click", () => {
      if (stream) stopCamera();
      else startCamera();
    });

    els.btnLight.addEventListener("click", () => {
      toggleTorch();
    });

    els.btnWB.addEventListener("click", () => {
      if (!wb.has) {
        calibrateArmed = !calibrateArmed;
        updateWBButton();
        setStatus(calibrateArmed ? "weiss auswaehlen" : "bereit");
        els.colorDesc.textContent = calibrateArmed ? "weiss tippen zum kalibrieren" : "tippe ins videobild";
        return;
      }
      wb.enabled = !wb.enabled;
      saveWb();
      calibrateArmed = false;
      updateWBButton();
      setStatus("bereit");
    });

    els.videoShell.addEventListener("pointerdown", (ev) => {
      if (!stream) return;
      showRing(ev.clientX, ev.clientY);

      const raw = sampleAt(ev.clientX, ev.clientY);
      if (!raw) return;

      if (calibrateArmed) {
        computeWbFromWhiteSample(raw.r, raw.g, raw.b);
        calibrateArmed = false;
        updateWBButton();
        setStatus("wb gesetzt");
      }

      const c = applyWb(raw.r, raw.g, raw.b);
      renderColor(c.r, c.g, c.b);
    });

    window.addEventListener("beforeunload", () => {
      try { stopCamera(); } catch {}
    });
  }

  function initDefaults() {
    els.btnLight.disabled = true;
    updateTorchButton();
    updateWBButton();
    renderColor(0, 0, 0);
    setStatus("bereit");
    wireCopyButtons();
  }

  function init() {
    bindEls();
    assertElements();
    loadWb();
    initDefaults();
    wireEvents();
    registerSW().then(() => offlineWarmup());
  }

  function boot() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  boot();
})();
