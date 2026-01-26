"use strict";

/*
ColorFinder
komplette datei ersetzen
*/

const video = document.getElementById("video");
const videoShell = document.getElementById("videoShell");
const tapRing = document.getElementById("tapRing");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const btnStart = document.getElementById("btnStart");
const btnLight = document.getElementById("btnLight");
const btnWB = document.getElementById("btnWB");

const statusText = document.getElementById("statusText");

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

let lightSupported = false;
let lightOn = false;

let wbMode = "idle"; // idle | calibrate

const CAL_KEY = "colorfinder_whitebalance_v3";
let calibration = loadCalibration();

setStatus("bereit");
updateButtons();

btnStart.addEventListener("click", async () => {
  if (stream) {
    stopCamera();
    setStatus("kamera aus");
    toastMsg("kamera aus");
    return;
  }
  await startCamera();
});

btnLight.addEventListener("click", async () => {
  await toggleLight();
});

btnWB.addEventListener("click", () => {
  if (!stream) {
    setStatus("starte kamera zuerst");
    return;
  }

  if (wbMode === "calibrate") {
    wbMode = "idle";
    setStatus("kalibrieren abgebrochen");
    updateButtons();
    return;
  }

  if (calibration && calibration.enabled) {
    calibration.enabled = false;
    saveCalibration(calibration);
    setStatus("weissabgleich aus");
    toastMsg("weissabgleich aus");
    updateButtons();
    return;
  }

  wbMode = "calibrate";
  setStatus("kalibrieren tippe auf weiss oder grau");
  toastMsg("kalibrieren bereit");
  updateButtons();
});

videoShell.addEventListener("contextmenu", (e) => { e.preventDefault(); });

videoShell.addEventListener("pointerdown", (e) => {
  if (!stream) return;
  e.preventDefault();
  handleTap(e.clientX, e.clientY);
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

    await detectLightSupport();
    setStatus("kamera bereit");
    toastMsg("bereit");
    updateButtons();
  } catch (err) {
    console.error(err);
    setStatus("kamera fehler erlaubnis pruefen");
    toastMsg("kamera fehler");
    stopCamera();
  }
}

function stopCamera() {
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());
  } catch (_) {}

  stream = null;
  videoTrack = null;

  lightSupported = false;
  lightOn = false;

  wbMode = "idle";

  updateButtons();
}

async function detectLightSupport() {
  lightSupported = false;
  if (!videoTrack) return;

  const caps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
  lightSupported = !!(caps && typeof caps.torch !== "undefined");
}

async function toggleLight() {
  if (!videoTrack) {
    setStatus("starte kamera zuerst");
    return;
  }
  if (!lightSupported) {
    setStatus("licht nicht verfuegbar");
    return;
  }

  try {
    lightOn = !lightOn;
    await videoTrack.applyConstraints({ advanced: [{ torch: lightOn }] });
    setStatus(lightOn ? "licht an" : "licht aus");
    updateButtons();
  } catch (err) {
    console.error(err);
    lightOn = false;
    setStatus("licht fehler");
    updateButtons();
  }
}

function updateButtons() {
  const running = !!stream;

  btnStart.textContent = running ? "kamera aus" : "kamera starten";

  btnLight.disabled = !running || !lightSupported;
  btnWB.disabled = !running;

  btnLight.textContent = lightOn ? "licht an" : "licht aus";

  if (wbMode === "calibrate") {
    btnWB.textContent = "tippe auf weiss";
    return;
  }

  const wbOn = calibration && calibration.enabled;
  btnWB.textContent = wbOn ? "weissabgleich an" : "kalibrieren";
}

function handleTap(clientX, clientY) {
  const rect = video.getBoundingClientRect();
  showRing(clientX, clientY, rect);

  if (video.videoWidth === 0 || video.videoHeight === 0) return;

  const x = Math.round((clientX - rect.left) * (video.videoWidth / rect.width));
  const y = Math.round((clientY - rect.top) * (video.videoHeight / rect.height));

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const sample = sampleAverageRgb(x, y, 10);
  if (!sample) return;

  if (wbMode === "calibrate") {
    applyCalibrationFromSample(sample);
    wbMode = "idle";
    updateButtons();
    setStatus("weissabgleich an");
    toastMsg("kalibriert");

    const msg = "weissabgleich an";
    setTimeout(() => {
      if (statusText.textContent === msg) setStatus("bereit");
    }, 5000);

    return;
  }

  const rgbRaw = sample;
  const rgb = applyCalibrationToRgb(rgbRaw);

  renderResult(rgb, rgbRaw);
}

function showRing(clientX, clientY, rect) {
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  tapRing.style.left = `${x}px`;
  tapRing.style.top = `${y}px`;

  tapRing.classList.remove("show");
  void tapRing.offsetWidth;
  tapRing.classList.add("show");
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
  const target = 235;

  const refR = Math.max(1, sample.r);
  const refG = Math.max(1, sample.g);
  const refB = Math.max(1, sample.b);

  const gainR = clampNum(target / refR, 0.5, 3.0);
  const gainG = clampNum(target / refG, 0.5, 3.0);
  const gainB = clampNum(target / refB, 0.5, 3.0);

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
  const wbOn = calibration && calibration.enabled;

  swatch.style.background = hex;
  colorNameEl.textContent = name;
  colorDescEl.textContent = wbOn
    ? `korrigiert aus ${rgbRaw.r}, ${rgbRaw.g}, ${rgbRaw.b}`
    : `raw ${rgbRaw.r}, ${rgbRaw.g}, ${rgbRaw.b}`;

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

function clampNum(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function copyText(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    toastMsg("kopiert");
  }).catch(() => {
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
  }, 900);
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
