const startButton = document.getElementById("startButton");
const startScreen = document.getElementById("startScreen");
const cameraScreen = document.getElementById("cameraScreen");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const buttons = Array.from(document.querySelectorAll("#result button[data-copy]"));

const torchBtn = document.getElementById("torchToggle");
let torchOn = false;
let videoTrack = null;

let stream = null;

const COLORS = [
  { de: "schwarz",   en: "black",     css: "black",     rgb: [0, 0, 0] },
  { de: "weiß",      en: "white",     css: "white",     rgb: [255, 255, 255] },
  { de: "grau",      en: "gray",      css: "gray",      rgb: [128, 128, 128] },
  { de: "rot",       en: "red",       css: "red",       rgb: [255, 0, 0] },
  { de: "grün",      en: "green",     css: "green",     rgb: [0, 128, 0] },
  { de: "blau",      en: "blue",      css: "blue",      rgb: [0, 0, 255] },
  { de: "gelb",      en: "yellow",    css: "yellow",    rgb: [255, 255, 0] },
  { de: "orange",    en: "orange",    css: "orange",    rgb: [255, 165, 0] },
  { de: "violett",   en: "purple",    css: "purple",    rgb: [128, 0, 128] },
  { de: "pink",      en: "pink",      css: "pink",      rgb: [255, 192, 203] },
  { de: "braun",     en: "brown",     css: "brown",     rgb: [165, 42, 42] },
  { de: "beige",     en: "beige",     css: "beige",     rgb: [245, 245, 220] },
  { de: "türkis",    en: "turquoise", css: "turquoise", rgb: [64, 224, 208] },
  { de: "cyan",      en: "cyan",      css: "cyan",      rgb: [0, 255, 255] },
  { de: "magenta",   en: "magenta",   css: "magenta",   rgb: [255, 0, 255] },
  { de: "marine",    en: "navy",      css: "navy",      rgb: [0, 0, 128] },
  { de: "oliv",      en: "olive",     css: "olive",     rgb: [128, 128, 0] },
  { de: "bordeaux",  en: "burgundy",  css: "maroon",    rgb: [128, 0, 32] },
  { de: "gold",      en: "gold",      css: "gold",      rgb: [255, 215, 0] },
  { de: "silber",    en: "silver",    css: "silver",    rgb: [192, 192, 192] }
];

function clampByte(n){
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r, g, b){
  const to2 = (x) => x.toString(16).padStart(2, "0").toUpperCase();
  return "#" + to2(clampByte(r)) + to2(clampByte(g)) + to2(clampByte(b));
}

function rgbToHsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function dist2(a, b){
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function nearestColor(r, g, b){
  const target = [r, g, b];
  let best = COLORS[0];
  let bestD = Infinity;
  for (const c of COLORS) {
    const d = dist2(target, c.rgb);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function setButton(key, value){
  const btn = buttons.find(b => b.dataset.copy === key);
  if (!btn) return;
  btn.textContent = value;
  btn.dataset.value = value;
}

function showToast(text){
  const el = document.createElement("div");
  el.textContent = text;
  el.style.position = "fixed";
  el.style.left = "50%";
  el.style.bottom = "18px";
  el.style.transform = "translateX(-50%)";
  el.style.background = "rgba(0,0,0,0.8)";
  el.style.color = "#fff";
  el.style.padding = "10px 12px";
  el.style.borderRadius = "10px";
  el.style.fontSize = "14px";
  el.style.zIndex = "9999";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 650);
}

function showTapMarker(clientX, clientY){
  const m = document.createElement("div");
  m.style.position = "fixed";
  m.style.left = (clientX - 10) + "px";
  m.style.top = (clientY - 10) + "px";
  m.style.width = "20px";
  m.style.height = "20px";
  m.style.border = "2px solid #fff";
  m.style.borderRadius = "50%";
  m.style.zIndex = "9999";
  m.style.pointerEvents = "none";
  document.body.appendChild(m);
  setTimeout(() => m.remove(), 350);
}

async function copyText(text){
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

async function startCamera(){
  const constraints = {
    audio: false,
    video: { facingMode: { ideal: "environment" } }
  };

  stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;

  videoTrack = stream.getVideoTracks()[0] || null;
  if (torchBtn) {
    torchBtn.disabled = true;
    torchBtn.textContent = "Licht an";
    torchOn = false;
  }

  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });

  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;

  await video.play();

  startScreen.hidden = true;
  cameraScreen.hidden = false;

  if (torchBtn && videoTrack) {
    const caps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
    torchBtn.disabled = !(caps && caps.torch);
  }

  showToast("Kamera bereit");
}

function pickColorFromTap(evt){
  const rect = video.getBoundingClientRect();

  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

  const x = clientX - rect.left;
  const y = clientY - rect.top;

  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

  showTapMarker(clientX, clientY);

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const px = Math.floor((x / rect.width) * canvas.width);
  const py = Math.floor((y / rect.height) * canvas.height);

  const data = ctx.getImageData(px, py, 1, 1).data;
  const r = data[0], g = data[1], b = data[2];

  const hex = rgbToHex(r, g, b);
  const hsl = rgbToHsl(r, g, b);
  const nearest = nearestColor(r, g, b);

  setButton("de", nearest.de);
  setButton("en", nearest.en);
  setButton("hex", hex);
  setButton("rgb", `rgb(${r}, ${g}, ${b})`);
  setButton("hsl", `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`);
  setButton("css", nearest.css);
}

async function setTorch(on){
  if (!videoTrack) return false;

  const caps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
  if (!caps || !caps.torch) return false;

  try {
    await videoTrack.applyConstraints({ advanced: [{ torch: on }] });
    return true;
  } catch (e) {
    return false;
  }
}

if (torchBtn) {
  torchBtn.addEventListener("click", async () => {
    torchOn = !torchOn;
    const ok = await setTorch(torchOn);

    if (!ok) {
      torchOn = false;
      torchBtn.textContent = "Licht an";
      showToast("Lichtsteuerung nicht unterstuetzt");
      return;
    }

    torchBtn.textContent = torchOn ? "Licht aus" : "Licht an";
    showToast(torchOn ? "Licht an" : "Licht aus");
  });
}

startButton.addEventListener("click", async () => {
  try {
    await startCamera();
  } catch (e) {
    showToast("Kamera Fehler oder keine Freigabe");
  }
});

video.addEventListener("click", pickColorFromTap, { passive: true });
video.addEventListener("touchstart", pickColorFromTap, { passive: true });

buttons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const text = btn.dataset.value || btn.textContent || "";
    if (!text) return;
    const ok = await copyText(text);
    showToast(ok ? "kopiert" : "copy nicht moeglich");
  });
});
