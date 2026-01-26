/* app.js v9 */
(() => {
  "use strict";

  const VERSION = "v9";
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

  let stream = null;
  let videoTrack = null;
  let hasTorch = false;
  let torchOn = false;

  let calibrateArmed = false;
  let wb = {
    has: false,
    enabled: false,
    gainR: 1,
    gainG: 1,
    gainB: 1
  };

  function $(id) {
    return document.getElementById(id);
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

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  function safeCopy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(() => {
        prompt("Copy", text);
      });
    }
    prompt("Copy", text);
    return Promise.resolve();
  }

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

  function clearWb() {
    wb.has = false;
    wb.enabled = false;
    wb.gainR = 1;
    wb.gainG = 1;
    wb.gainB = 1;
    try { localStorage.removeItem(LS_WB_KEY); } catch {}
  }

  function applyWbToRgb(r, g, b) {
    if (!wb.has || !wb.enabled) return { r, g, b };
    const rr = clamp255(Math.round(r * wb.gainR));
    const gg = clamp255(Math.round(g * wb.gainG));
    const bb = clamp255(Math.round(b * wb.gainB));
    return { r: rr, g: gg, b: bb };
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

  function ensureUI() {
    let root = $("cf-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "cf-root";
      root.style.maxWidth = "720px";
      root.style.margin = "0 auto";
      root.style.padding = "12px";
      document.body.prepend(root);
    }

    let header = $("cf-header");
    if (!header) {
      header = document.createElement("div");
      header.id = "cf-header";
      header.style.textAlign = "center";
      header.style.fontSize = "22px";
      header.style.fontWeight = "700";
      header.style.margin = "8px 0 12px 0";
      header.textContent = "ColorFinder";
      root.appendChild(header);
    }

    let videoWrap = $("cf-videoWrap");
    if (!videoWrap) {
      videoWrap = document.createElement("div");
      videoWrap.id = "cf-videoWrap";
      videoWrap.style.position = "relative";
      videoWrap.style.borderRadius = "16px";
      videoWrap.style.overflow = "hidden";
      videoWrap.style.border = "1px solid rgba(0,0,0,0.12)";
      root.appendChild(videoWrap);
    }

    let hint = $("cf-hint");
    if (!hint) {
      hint = document.createElement("div");
      hint.id = "cf-hint";
      hint.textContent = "Tippe ins Bild";
      hint.style.position = "absolute";
      hint.style.left = "10px";
      hint.style.top = "10px";
      hint.style.padding = "6px 10px";
      hint.style.borderRadius = "12px";
      hint.style.fontSize = "13px";
      hint.style.background = "rgba(255,255,255,0.85)";
      hint.style.backdropFilter = "blur(6px)";
      videoWrap.appendChild(hint);
    }

    let video = $("cf-video");
    if (!video) {
      video = document.createElement("video");
      video.id = "cf-video";
      video.playsInline = true;
      video.autoplay = true;
      video.muted = true;
      video.style.display = "block";
      video.style.width = "100%";
      video.style.height = "auto";
      videoWrap.appendChild(video);
    }

    let overlay = $("cf-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "cf-overlay";
      overlay.style.position = "absolute";
      overlay.style.inset = "0";
      overlay.style.cursor = "crosshair";
      videoWrap.appendChild(overlay);
    }

    let ring = $("cf-ring");
    if (!ring) {
      ring = document.createElement("div");
      ring.id = "cf-ring";
      ring.style.position = "absolute";
      ring.style.width = "44px";
      ring.style.height = "44px";
      ring.style.borderRadius = "999px";
      ring.style.border = "3px solid rgba(255,255,255,0.9)";
      ring.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.18)";
      ring.style.transform = "translate(-50%,-50%)";
      ring.style.pointerEvents = "none";
      ring.style.display = "none";
      overlay.appendChild(ring);
    }

    let panel = $("cf-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "cf-panel";
      panel.style.marginTop = "12px";
      panel.style.padding = "12px";
      panel.style.borderRadius = "16px";
      panel.style.border = "1px solid rgba(0,0,0,0.12)";
      panel.style.display = "grid";
      panel.style.gridTemplateColumns = "1fr";
      panel.style.gap = "10px";
      root.appendChild(panel);
    }

    let rowBtns = $("cf-rowBtns");
    if (!rowBtns) {
      rowBtns = document.createElement("div");
      rowBtns.id = "cf-rowBtns";
      rowBtns.style.display = "flex";
      rowBtns.style.gap = "8px";
      rowBtns.style.flexWrap = "wrap";
      panel.appendChild(rowBtns);
    }

    function mkBtn(id, text) {
      let b = $(id);
      if (!b) {
        b = document.createElement("button");
        b.id = id;
        b.textContent = text;
        b.style.padding = "10px 12px";
        b.style.borderRadius = "12px";
        b.style.border = "1px solid rgba(0,0,0,0.15)";
        b.style.background = "white";
        b.style.cursor = "pointer";
        rowBtns.appendChild(b);
      }
      return b;
    }

    const btnStartStop = mkBtn("cf-btnStartStop", "Kamera starten");
    const btnTorch = mkBtn("cf-btnTorch", "Licht");
    const btnWb = mkBtn("cf-btnWb", "Kalibrieren");

    let values = $("cf-values");
    if (!values) {
      values = document.createElement("div");
      values.id = "cf-values";
      values.style.display = "grid";
      values.style.gap = "8px";
      panel.appendChild(values);
    }

    function mkField(label, idVal, idCopy) {
      let wrap = document.createElement("div");
      wrap.style.display = "grid";
      wrap.style.gridTemplateColumns = "92px 1fr auto";
      wrap.style.alignItems = "center";
      wrap.style.gap = "8px";

      const l = document.createElement("div");
      l.textContent = label;
      l.style.opacity = "0.75";

      let v = $(idVal);
      if (!v) {
        v = document.createElement("div");
        v.id = idVal;
        v.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        v.style.fontSize = "14px";
        v.textContent = "-";
      }

      let c = $(idCopy);
      if (!c) {
        c = document.createElement("button");
        c.id = idCopy;
        c.textContent = "Copy";
        c.style.padding = "8px 10px";
        c.style.borderRadius = "12px";
        c.style.border = "1px solid rgba(0,0,0,0.15)";
        c.style.background = "white";
        c.style.cursor = "pointer";
      }

      wrap.appendChild(l);
      wrap.appendChild(v);
      wrap.appendChild(c);
      values.appendChild(wrap);

      return { v, c };
    }

    const fHex = mkField("HEX", "cf-hex", "cf-copyHex");
    const fRgb = mkField("RGB", "cf-rgb", "cf-copyRgb");
    const fHsl = mkField("HSL", "cf-hsl", "cf-copyHsl");
    const fCss = mkField("CSS", "cf-css", "cf-copyCss");

    let swStatus = $("cf-swStatus");
    if (!swStatus) {
      swStatus = document.createElement("div");
      swStatus.id = "cf-swStatus";
      swStatus.style.fontSize = "12px";
      swStatus.style.opacity = "0.65";
      swStatus.textContent = "";
      panel.appendChild(swStatus);
    }

    return {
      root,
      videoWrap,
      video,
      overlay,
      ring,
      btnStartStop,
      btnTorch,
      btnWb,
      hexEl: fHex.v,
      rgbEl: fRgb.v,
      hslEl: fHsl.v,
      cssEl: fCss.v,
      copyHex: fHex.c,
      copyRgb: fRgb.c,
      copyHsl: fHsl.c,
      copyCss: fCss.c,
      swStatus
    };
  }

  const ui = ensureUI();
  loadWb();

  function updateWbButton() {
    if (!wb.has) {
      ui.btnWb.textContent = calibrateArmed ? "Weiss tippen" : "Kalibrieren";
      ui.btnWb.title = "Kalibrieren: tippe danach auf eine weisse Flaeche";
      return;
    }
    if (wb.enabled) {
      ui.btnWb.textContent = "WB aus";
      ui.btnWb.title = "Weissabgleich ist an. Klick: ausschalten. Option Klick: neu kalibrieren";
    } else {
      ui.btnWb.textContent = "WB an";
      ui.btnWb.title = "Weissabgleich ist aus. Klick: einschalten. Option Klick: neu kalibrieren";
    }
  }

  updateWbButton();

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

      await Promise.all(
        CORE_ASSETS.map((u) => fetch(u, { cache: "reload" }).catch(() => null))
      );

      localStorage.setItem(LS_OFFLINE_READY_KEY, "1");
      ui.swStatus.textContent = "Offline bereit";
    } catch {
      ui.swStatus.textContent = "";
    }
  }

  function updateTorchButton() {
    if (!hasTorch) {
      ui.btnTorch.textContent = "Licht";
      ui.btnTorch.disabled = true;
      ui.btnTorch.style.opacity = "0.5";
      ui.btnTorch.title = "Nicht verfuegbar";
      return;
    }
    ui.btnTorch.disabled = false;
    ui.btnTorch.style.opacity = "1";
    ui.btnTorch.textContent = torchOn ? "Licht aus" : "Licht an";
    ui.btnTorch.title = "";
  }

  async function startCamera() {
    if (stream) return;

    try {
      const constraints = {
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      ui.video.srcObject = stream;

      const tracks = stream.getVideoTracks();
      videoTrack = tracks && tracks[0] ? tracks[0] : null;

      hasTorch = false;
      torchOn = false;

      if (videoTrack && videoTrack.getCapabilities) {
        const caps = videoTrack.getCapabilities();
        if (caps && typeof caps.torch !== "undefined") {
          hasTorch = !!caps.torch;
        }
      }

      updateTorchButton();

      ui.btnStartStop.textContent = "Kamera stoppen";
      ui.btnStartStop.title = "";

    } catch (e) {
      stopCamera();
      alert("Kamera Zugriff nicht moeglich. Safari Rechte pruefen.");
    }
  }

  function stopCamera() {
    try {
      if (ui.video) ui.video.srcObject = null;
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach((t) => t.stop());
      }
    } catch {}
    stream = null;
    videoTrack = null;
    hasTorch = false;
    torchOn = false;
    updateTorchButton();

    ui.btnStartStop.textContent = "Kamera starten";
  }

  async function toggleTorch() {
    if (!hasTorch || !videoTrack) return;
    try {
      torchOn = !torchOn;
      await videoTrack.applyConstraints({ advanced: [{ torch: torchOn }] });
      updateTorchButton();
    } catch {
      torchOn = false;
      updateTorchButton();
    }
  }

  function showRing(clientX, clientY) {
    const rect = ui.overlay.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ui.ring.style.left = `${x}px`;
    ui.ring.style.top = `${y}px`;
    ui.ring.style.display = "block";
    ui.ring.style.opacity = "1";

    clearTimeout(showRing._t);
    showRing._t = setTimeout(() => {
      ui.ring.style.opacity = "0";
      ui.ring.style.display = "none";
    }, 220);
  }

  function sampleAt(clientX, clientY) {
    const v = ui.video;
    if (!v || !v.videoWidth || !v.videoHeight) return null;

    const rect = ui.overlay.getBoundingClientRect();
    const xNorm = (clientX - rect.left) / rect.width;
    const yNorm = (clientY - rect.top) / rect.height;

    const x = Math.floor(xNorm * v.videoWidth);
    const y = Math.floor(yNorm * v.videoHeight);

    if (x < 0 || y < 0 || x >= v.videoWidth || y >= v.videoHeight) return null;

    const canvas = sampleAt._c || (sampleAt._c = document.createElement("canvas"));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return { r: pixel[0], g: pixel[1], b: pixel[2] };
  }

  function renderValues(r, g, b) {
    const hex = rgbToHex(r, g, b);
    const hsl = rgbToHsl(r, g, b);

    const rgbText = `rgb(${r} ${g} ${b})`;
    const hslText = `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`;
    const cssText = `color: ${hex}; background: ${hex};`;

    ui.hexEl.textContent = hex;
    ui.rgbEl.textContent = `${r}, ${g}, ${b}`;
    ui.hslEl.textContent = `${hsl.h}, ${hsl.s}%, ${hsl.l}%`;
    ui.cssEl.textContent = cssText;

    ui.copyHex.onclick = () => safeCopy(hex);
    ui.copyRgb.onclick = () => safeCopy(rgbText);
    ui.copyHsl.onclick = () => safeCopy(hslText);
    ui.copyCss.onclick = () => safeCopy(cssText);
  }

  ui.btnStartStop.addEventListener("click", () => {
    if (stream) stopCamera();
    else startCamera();
  });

  ui.btnTorch.addEventListener("click", () => {
    toggleTorch();
  });

  ui.btnWb.addEventListener("click", (e) => {
    const optionKey = e.altKey || e.metaKey;
    if (optionKey) {
      clearWb();
      calibrateArmed = true;
      updateWbButton();
      return;
    }

    if (!wb.has) {
      calibrateArmed = true;
      updateWbButton();
      return;
    }

    wb.enabled = !wb.enabled;
    saveWb();
    calibrateArmed = false;
    updateWbButton();
  });

  ui.overlay.addEventListener("pointerdown", (ev) => {
    if (!stream) return;

    showRing(ev.clientX, ev.clientY);

    const raw = sampleAt(ev.clientX, ev.clientY);
    if (!raw) return;

    if (calibrateArmed) {
      computeWbFromWhiteSample(raw.r, raw.g, raw.b);
      calibrateArmed = false;
      updateWbButton();
    }

    const corrected = applyWbToRgb(raw.r, raw.g, raw.b);
    renderValues(corrected.r, corrected.g, corrected.b);
  });

  window.addEventListener("beforeunload", () => {
    try { stopCamera(); } catch {}
  });

  window.addEventListener("load", async () => {
    await registerSW();
    offlineWarmup();
  });

  renderValues(0, 0, 0);
})();
