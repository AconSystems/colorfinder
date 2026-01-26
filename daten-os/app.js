"use strict";

/*
ColorFinder FarbFinder
live kamera tap farbe torch weissabgleich
komplette datei ersetzen
*/

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const btnStart = document.getElementById("btnStart");
const btnTorch = document.getElementById("btnTorch");
const btnCalibrate = document.getElementById("btnCalibrate");
const btnCalOff = document.getElementById("btnCalOff");

const statusText = document.getElementById("statusText");
const torchText = document.getElementById("torchText");
const calText = document.getElementById("calText");

const swatch = document.getElementById("swatch");
const colorNameEl = document.getElementById("colorName");
const colorDescEl = document.getElementById("colorDesc");

const outHex = document.getElementById("outHex");
const outRgb = document.getElementById("outRgb");
const outHsl = document.getElementById("outHsl");
const outCss = document.getElementById("outCss");

const toast = document.getElementById("toast");

let stream = null;
let videoTrack = null;

let torchSupported = false;
let torchOn = false;

let calibrating = false;

const CAL_KEY = "colorfinder_whitebalance_v1";
let calibration = loadCalibration(); 
// calibration format
// { enabled: true, gainR: number, gainG: number, gainB: number, refR: number, refG: number, refB: number }

setStatus("bereit");

updateCalUi();
updateTorchUi();

btnStart.addEventListener("click", async () => {
  await startCamera();
});

btnTorch.addEventListener("click", async () => {
  await toggleTorch();
});

btnCalibrate.addEventListener("click", () => {
  if (!stream) {
    setStatus("starte kamera zuerst");
    return;
  }
  calibrating = true;
  setStatus("kalibrierung bereit tippe auf weiss oder neutral grau");
  toastMsg("kalibrierung modus an tippe ins bild");
});

btnCalOff.addEventListener("click", () => {
  calibrating = false;
  if (calibration && calibration.enabled) {
    calibration.enabled = false;
    saveCalibration(calibration);
  }
  updateCalUi();
  setStatus("kalibrierung aus");
  toastMsg("kalibrierung aus");
});

video.addEventListener("click", (e) => {
  if (!stream) return;
  handleTap(e);
});

document.addEventListener("click", (e) => {
  const t = e.target;
  if (!t) return;
  const key = t.getAttribute("data-copy");
  if (!key) return;
  const el = document.getElementById(key);
  if (!el) return;
  copyText(el.textContent || "");
});

async function startCamera() {
  try {
    setStatus("kamera start");
    if (stream) {
      stopCamera();
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    videoTrack = stream.getVideoTracks()[0];

    await detectTorchSupport();
    updateTorchUi();

    setStatus("kamera bereit tippe ins bild");
    toastMsg("bereit");
  } catch (err) {
    console.error(err);
    setStatus("kamera fehler erlaubnis pruefen");
    toastMsg("kamera fehler");
  }
}

function stopCamera() {
  try {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
  } catch (_) {}
  stream = null;
  videoTrack = null;
  torchSupported = false;
  torchOn = false;
  updateTorchUi();
}

async function detectTorchSupport() {
  torchSupported = false;
  if (!videoTrack) return;

  const caps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
  if (caps && typeof caps.torch !== "undefined") {
    torchSupported = true;
    torchText.textContent = "bereit";
  } else {
    torchSupported = false;
    torchText.textContent = "nicht verfuegbar";
  }
}

async function toggleTorch() {
  if (!videoTrack) {
    setStatus("starte kamera zuerst");
    return;
  }
  if (!torchSupported) {
    setStatus("torch nicht verfuegbar");
    return;
  }

  try {
    torchOn = !torchOn;
    await videoTrack.applyConstraints({ advanced: [{ torch: torchOn }] });
    updateTorchUi();
    setStatus(torchOn ? "licht an" : "licht aus");
  } catch (err) {
    console.error(err);
    torchOn = false;
    updateTorchUi();
    setStatus("torch fehler");
  }
}

function updateTorchUi() {
  if (!videoTrack) {
    btnTorch.disabled = true;
    btnTorch.textContent = "licht aus";
    torchText.textContent = "aus";
    return;
  }

  btnTorch.disabled = !torchSupported;
  btnTorch.textContent = torchOn ? "licht an" : "licht aus";
  torchText.textContent = torchSupported ? (torchOn ? "an" : "aus") : "nicht verfuegbar";
}

function updateCalUi() {
  const enabled = calibration && calibration.enabled;
  calText.textContent = enabled ? "an" : "aus";
}

function handleTap(e) {
  const rect = video.getBoundingClientRect();

  const x = Math.round((e.clientX - rect.left) * (video.videoWidth / rect.width));
  const y = Math.round((e.clientY - rect.top) * (video.videoHeight / rect.height));

  if (video.videoWidth === 0 || video.videoHeight === 0) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const sample = sampleAverageRgb(x, y, 10);
  if (!sample) return;

  if (calibrating) {
    applyCalibrationFromSample(sample);
    calibrating = false;
    updateCalUi();
    setStatus("kalibriert tippe normal zum messen");
    toastMsg("kalibrierung gespeichert");
    return;
  }

  const rgbRaw = sample;
  const rgb = applyCalibrationToRgb(rgbRaw);

  renderResult(rgb, rgbRaw);
}

function sampleAverageRgb(cx, cy, radius) {
  const w = canvas.width;
  const h = canvas.height;

  const x0 = clampInt(cx - radius, 0, w - 1);
  const y0 = clampInt(cy - radius, 0, h - 1);
  const x1 = clampInt(cx + radius, 0, w - 1);
  const y1 = clampInt(cy + radius, 0, h - 1);

  const sw = x1 - x0 + 1;
  const sh = y1 - y0 + 1;

  try {
    const img = ctx.getImageData(x0, y0, sw, sh);
    const d = img.data;

    let r = 0, g = 0, b = 0;
    const n = sw * sh;

    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
    }

    return {
      r: Math.round(r / n),
      g: Math.round(g / n),
      b: Math.round(b / n)
    };
  } catch (err) {
    console.error(err);
    setStatus("pixel lesen blockiert");
    return null;
  }
}

function applyCalibrationFromSample(sample) {
  // ziel ist neutral weiss
  const target = 255;

  const refR = Math.max(1, sample.r);
  const refG = Math.max(1, sample.g);
  const refB = Math.max(1, sample.b);

  const gainR = target / refR;
  const gainG = target / refG;
  const gainB = target / refB;

  calibration = {
    enabled: true,
    gainR,
    gainG,
    gainB,
    refR,
    refG,
    refB
  };

  saveCalibration(calibration);

  calText.textContent = "an";
}

function applyCalibrationToRgb(rgb) {
  if (!calibration || !calibration.enabled) return rgb;

  const r = clampInt(Math.round(rgb.r * calibration.gainR), 0, 255);
  const g = clampInt(Math.round(rgb.g * calibration.gainG), 0, 255);
  const b = clampInt(Math.round(rgb.b * calibration.gainB), 0, 255);

  return { r, g, b };
}

function renderResult(rgb, rgbRaw) {
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const name = getColorName(rgb.r, rgb.g, rgb.b);
  const extra = calibration && calibration.enabled
    ? `korrigiert aus raw rgb ${rgbRaw.r}, ${rgbRaw.g}, ${rgbRaw.b}`
    : `raw rgb ${rgbRaw.r}, ${rgbRaw.g}, ${rgbRaw.b}`;

  swatch.style.background = hex;
  colorNameEl.textContent = name;
  colorDescEl.textContent = extra;

  outHex.textContent = hex;
  outRgb.textContent = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  outHsl.textContent = `${hsl.h} ${hsl.s}% ${hsl.l}%`;
  outCss.textContent = `color: ${hex}; background: ${hex};`;

  toastMsg("gemessen");
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function rgbToHsl(r, g, b) {
  let rr = r / 255, gg = g / 255, bb = b / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rr: h = ((gg - bb) / d) % 6; break;
      case gg: h = (bb - rr) / d + 2; break;
      case bb: h = (rr - gg) / d + 4; break;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function copyText(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    toastMsg("kopiert");
  }).catch(() => {
    // fallback
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toastMsg("kopiert");
    } catch (_) {
      toastMsg("copy fehler");
    }
  });
}

function toastMsg(msg) {
  toast.textContent = msg;
  setTimeout(() => {
    if (toast.textContent === msg) toast.textContent = "";
  }, 1200);
}

function setStatus(msg) {
  statusText.textContent = msg;
}

function saveCalibration(obj) {
  try {
    localStorage.setItem(CAL_KEY, JSON.stringify(obj));
  } catch (_) {}
}

function loadCalibration() {
  try {
    const raw = localStorage.getItem(CAL_KEY);
    if (!raw) return { enabled: false };
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return { enabled: false };
    if (typeof obj.enabled !== "boolean") obj.enabled = false;
    return obj;
  } catch (_) {
    return { enabled: false };
  }
}

/*
farbnamen logik simple robust
*/

function getColorName(r, g, b) {
  const hsl = rgbToHsl(r, g, b);
  const h = hsl.h;
  const s = hsl.s;
  const l = hsl.l;

  if (l <= 8) return "schwarz";
  if (l >= 92 && s <= 12) return "weiss";
  if (s <= 10 && l > 8 && l < 92) return "grau";

  if (h >= 0 && h < 15) return l < 50 ? "dunkelrot" : "rot";
  if (h >= 15 && h < 35) return "orange";
  if (h >= 35 && h < 60) return "gelb";
  if (h >= 60 && h < 95) return "gelbgruen";
  if (h >= 95 && h < 150) return "gruen";
  if (h >= 150 && h < 190) return "tuerkis";
  if (h >= 190 && h < 230) return "cyanblau";
  if (h >= 230 && h < 265) return "blau";
  if (h >= 265 && h < 295) return "violett";
  if (h >= 295 && h < 330) return "magenta";
  if (h >= 330 && h <= 360) return "rot";

  return "farbe";
}
