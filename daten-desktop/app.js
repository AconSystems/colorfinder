"use strict";

/*
ColorFinder / FarbFinder Desktop Referenz v01
app.js

Ziele
- Foto taugliche Farbnamen
- Farbfamilie bleibt stabil (A)
- Kupfer Aluminium Olive Olivenbraun entfernt
- Gold Silber bleiben (nur wenn plausibel)
- Ergebnisbereich bleibt clean (keine Disclaimer Texte im Ergebnisfeld)
- So funktioniert es Bereich wird im Arbeitsbereich ausgeblendet
*/

(function () {
  const els = {
    langDe: document.getElementById("lang-de"),
    langEn: document.getElementById("lang-en"),

    brandTitle: document.getElementById("t-brand-title"),
    brandSub: document.getElementById("t-brand-sub"),

    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    btnChoose: document.getElementById("btnChoose"),
    btnClear: document.getElementById("btnClear"),

    canvas: document.getElementById("canvas"),
    swatch: document.getElementById("swatch"),
    colorName: document.getElementById("colorName"),
    rgbText: document.getElementById("rgbText"),
    hexText: document.getElementById("hexText"),

    howTitle: document.getElementById("t-how-title"),
    howList: document.getElementById("t-how-list"),

    resultNote: document.getElementById("t-result-note"),

    footerPrivacy: document.getElementById("t-footer-privacy")
  };

  const textIds = [
    "t-headline",
    "t-drop-title",
    "t-drop-sub",
    "t-choose",
    "t-clear",
    "t-formats",
    "t-result-title",
    "t-footer-left",
    "t-footer-right"
  ];

  const I18N = {
    de: {
      brand_title: "FarbFinder Desktop Referenz v01",
      brand_sub: "Foto und Bild Farbnamen nach fester Spezifikation",

      "t-headline": "Bild laden und Farbe anklicken",
      "t-drop-title": "Datei hier hineinziehen",
      "t-drop-sub": "oder per Button auswählen",
      "t-choose": "Bild auswählen",
      "t-clear": "Zurücksetzen",
      "t-formats": "Formate: jpg png webp gif bmp",
      "t-result-title": "Ergebnis",
      "t-footer-left": "FarbFinder ColorFinder Desktop Referenz v01",
      "t-footer-right": "Kein Produkt. Keine Updates. Eigenverantwortung.",
      footer_privacy: "Bilder werden lokal im Browser verarbeitet. Kein Upload."
    },
    en: {
      brand_title: "ColorFinder Desktop Reference v01",
      brand_sub: "Photo and image color names by fixed specification",

      "t-headline": "Load an image and click a color",
      "t-drop-title": "Drag and drop an image here",
      "t-drop-sub": "or choose a file",
      "t-choose": "Choose image",
      "t-clear": "Reset",
      "t-formats": "Formats: jpg png webp gif bmp",
      "t-result-title": "Result",
      "t-footer-left": "FarbFinder ColorFinder Desktop Reference v01",
      "t-footer-right": "Not a product. No updates. Own responsibility.",
      footer_privacy: "Images are processed locally in the browser. No upload."
    }
  };

  let currentLang = "de";

  const ctx = els.canvas.getContext("2d", { willReadFrequently: true });

  let imageBitmap = null;
  let drawInfo = { x: 0, y: 0, w: 0, h: 0 };
  let lastNameDe = null;
  let lastNameEn = null;

  function hideWorkAreaTexts() {
    // Ergebnis Disclaimer raus
    if (els.resultNote) {
      els.resultNote.style.display = "none";
    }

    // So funktioniert es raus (ganzen Block entfernen)
    if (els.howTitle) {
      const box = els.howTitle.closest(".card-inset");
      if (box) box.style.display = "none";
      else els.howTitle.style.display = "none";
    }
    if (els.howList) {
      els.howList.style.display = "none";
    }
  }

  function setLang(lang) {
    currentLang = lang === "en" ? "en" : "de";
    const map = I18N[currentLang];

    for (const id of textIds) {
      const el = document.getElementById(id);
      if (el && map[id] != null) el.textContent = map[id];
    }

    if (els.brandTitle) els.brandTitle.textContent = map.brand_title;
    if (els.brandSub) els.brandSub.textContent = map.brand_sub;
    if (els.footerPrivacy) els.footerPrivacy.textContent = map.footer_privacy;

    const isDe = currentLang === "de";
    els.langDe.classList.toggle("is-active", isDe);
    els.langEn.classList.toggle("is-active", !isDe);
    els.langDe.setAttribute("aria-pressed", isDe ? "true" : "false");
    els.langEn.setAttribute("aria-pressed", !isDe ? "true" : "false");

    if (lastNameDe && lastNameEn) {
      els.colorName.textContent = isDe ? lastNameDe : lastNameEn;
    }
  }

  function rgbToHex(r, g, b) {
    const toHex = (v) => {
      const n = Math.max(0, Math.min(255, v | 0));
      return n.toString(16).padStart(2, "0");
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function rgbToHsl(r, g, b) {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;

    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const d = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));

      switch (max) {
        case rr:
          h = ((gg - bb) / d) % 6;
          break;
        case gg:
          h = (bb - rr) / d + 2;
          break;
        default:
          h = (rr - gg) / d + 4;
          break;
      }

      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    return { h, s, l };
  }

  function resetResult() {
    els.swatch.style.background = "transparent";
    els.colorName.textContent = "-";
    els.rgbText.textContent = "-";
    els.hexText.textContent = "-";
    lastNameDe = null;
    lastNameEn = null;
  }

  function clearCanvas() {
    const { width, height } = els.canvas;
    ctx.clearRect(0, 0, width, height);
    imageBitmap = null;
    drawInfo = { x: 0, y: 0, w: 0, h: 0 };
    resetResult();
  }

  function resizeCanvasForDisplay() {
    const rect = els.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));

    if (els.canvas.width !== w || els.canvas.height !== h) {
      els.canvas.width = w;
      els.canvas.height = h;
      if (imageBitmap) drawImageToCanvas(imageBitmap);
    }
  }

  function drawImageToCanvas(bitmap) {
    const cw = els.canvas.width;
    const ch = els.canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    const iw = bitmap.width;
    const ih = bitmap.height;

    const scale = Math.min(cw / iw, ch / ih);
    const w = Math.floor(iw * scale);
    const h = Math.floor(ih * scale);
    const x = Math.floor((cw - w) / 2);
    const y = Math.floor((ch - h) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, x, y, w, h);

    drawInfo = { x, y, w, h };
  }

  async function loadFile(file) {
    if (!file) return;

    try {
      const bitmap = await createImageBitmap(file);
      imageBitmap = bitmap;
      drawImageToCanvas(bitmap);
      resetResult();
    } catch (e) {
      clearCanvas();
      alert(
        currentLang === "de"
          ? "Dieses Bildformat kann der Browser nicht laden. Bitte als jpg oder png exportieren und erneut versuchen."
          : "Your browser cannot load this image format. Please export as jpg or png and try again."
      );
    }
  }

  function getCanvasClickPos(evt) {
    const rect = els.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (evt.clientX - rect.left) * dpr;
    const y = (evt.clientY - rect.top) * dpr;
    return { x, y };
  }

  function isInsideImageArea(px, py) {
    return (
      px >= drawInfo.x &&
      py >= drawInfo.y &&
      px < drawInfo.x + drawInfo.w &&
      py < drawInfo.y + drawInfo.h
    );
  }

  // Familien Logik (A: Familie stabil)
  // 1 erst Familie bestimmen
  // 2 dann innerhalb Familie Hell Dunkel Variante wählen
  function classifyName(r, g, b) {
    const { h, s, l } = rgbToHsl(r, g, b);

    // Neutrale zuerst
    if (l <= 0.06) return { de: "Schwarz", en: "Black" };
    if (s <= 0.08) {
      // Graustufen
      if (l < 0.18) return { de: "Anthrazit", en: "Anthracite" };
      if (l < 0.34) return { de: "Dunkelgrau", en: "Dark Gray" };
      if (l < 0.60) return { de: "Grau", en: "Gray" };
      if (l < 0.85) return { de: "Hellgrau", en: "Light Gray" };
      return { de: "Reinweiß", en: "Pure White" };
    }

    // Metall Sonderfall nur wenn plausibel (Gold Silber)
    // Silber: sehr geringe Sättigung, relativ hell
    if (s <= 0.14 && l >= 0.62) {
      return { de: "Silber", en: "Silver" };
    }
    // Gold: Hue gelb bis gelborange, Sättigung moderat, Licht eher mittel
    if (h >= 35 && h <= 62 && s >= 0.18 && s <= 0.65 && l >= 0.25 && l <= 0.70) {
      if (l < 0.42) return { de: "Dunkelgold", en: "Dark Gold" };
      if (l < 0.58) return { de: "Gold", en: "Gold" };
      return { de: "Hellgold", en: "Light Gold" };
    }

    // Pink Bereich
    if (h >= 300 || h < 20) {
      // Rot Familie wird weiter unten abgegrenzt, hier nur sehr pinkige Sättigung
      if (s >= 0.45 && l >= 0.55 && h >= 310 && h <= 355) {
        if (l >= 0.80) return { de: "Hellrosa", en: "Light Pink" };
        return { de: "Rosa", en: "Pink" };
      }
    }

    // Familien anhand Hue
    // Rot: 345..360 und 0..15
    const isRed = (h >= 345 || h <= 15);
    // Orange: 16..40
    const isOrange = (h >= 16 && h <= 40);
    // Gelb: 41..70
    const isYellow = (h >= 41 && h <= 70);
    // Grün: 71..165
    const isGreen = (h >= 71 && h <= 165);
    // Cyan Türkis: 166..205
    const isCyan = (h >= 166 && h <= 205);
    // Blau: 206..255
    const isBlue = (h >= 206 && h <= 255);
    // Violett Lila: 256..299
    const isViolet = (h >= 256 && h <= 299);

    // Braun Familie nur wenn Sättigung moderat niedrig und eher dunkel
    // Aber A: Wenn Hue klar Orange und Sättigung ordentlich, bleibt es Orange
    const isBrownCandidate =
      (h >= 10 && h <= 70) && s < 0.30 && l < 0.55 && l > 0.10;

    if (isBrownCandidate) {
      if (l < 0.22) return { de: "Dunkelbraun", en: "Dark Brown" };
      if (l < 0.34) return { de: "Schokobraun", en: "Chocolate Brown" };
      if (l < 0.46) return { de: "Braun", en: "Brown" };
      return { de: "Hellbraun", en: "Light Brown" };
    }

    // Rot Familie
    if (isRed) {
      if (l < 0.22) return { de: "Dunkelrot", en: "Dark Red" };
      if (l < 0.40) return { de: "Weinrot", en: "Wine Red" };
      if (l < 0.58) return { de: "Rot", en: "Red" };
      return { de: "Hellrot", en: "Light Red" };
    }

    // Orange Familie (stabil)
    if (isOrange) {
      if (l < 0.26) return { de: "Dunkelorange", en: "Dark Orange" };
      if (l < 0.48) return { de: "Orange", en: "Orange" };
      // sehr hell im Orange Bereich
      if (l < 0.70) return { de: "Hellorange", en: "Light Orange" };
      // sehr helle pastellige Oranges
      if (h >= 22 && h <= 34) return { de: "Apricot", en: "Apricot" };
      return { de: "Pfirsich", en: "Peach" };
    }

    // Gelb Familie
    if (isYellow) {
      if (l < 0.35) return { de: "Senfgelb", en: "Mustard" };
      if (l < 0.55) return { de: "Goldgelb", en: "Golden Yellow" };
      if (l < 0.75) return { de: "Gelb", en: "Yellow" };
      return { de: "Hellgelb", en: "Light Yellow" };
    }

    // Grün Familie
    if (isGreen) {
      if (l < 0.22) return { de: "Dunkelgrün", en: "Dark Green" };
      if (l < 0.35) return { de: "Waldgrün", en: "Forest Green" };
      if (l < 0.48) return { de: "Grün", en: "Green" };
      if (l < 0.62) return { de: "Hellgrün", en: "Light Green" };
      // sehr helle frische Grüntöne
      if (s >= 0.55) return { de: "Lindgrün", en: "Lime Green" };
      return { de: "Mintgrün", en: "Mint Green" };
    }

    // Cyan Türkis Familie
    if (isCyan) {
      if (l < 0.30) return { de: "Petrol", en: "Petrol" };
      if (l < 0.52) return { de: "Türkis", en: "Turquoise" };
      if (l < 0.72) return { de: "Cyan", en: "Cyan" };
      return { de: "Aqua", en: "Aqua" };
    }

    // Blau Familie
    if (isBlue) {
      if (l < 0.22) return { de: "Navyblau", en: "Navy Blue" };
      if (l < 0.35) return { de: "Dunkelblau", en: "Dark Blue" };
      if (l < 0.55) return { de: "Blau", en: "Blue" };
      if (l < 0.75) return { de: "Hellblau", en: "Light Blue" };
      return { de: "Babyblau", en: "Baby Blue" };
    }

    // Violett Familie
    if (isViolet) {
      if (l < 0.22) return { de: "Aubergine", en: "Aubergine" };
      if (l < 0.38) return { de: "Dunkelviolett", en: "Dark Violet" };
      if (l < 0.58) return { de: "Lila", en: "Purple" };
      return { de: "Violett", en: "Violet" };
    }

    // Fallback
    if (l < 0.18) return { de: "Dunkelgrau", en: "Dark Gray" };
    if (l < 0.60) return { de: "Grau", en: "Gray" };
    return { de: "Hellgrau", en: "Light Gray" };
  }

  function pickColorAt(px, py) {
    if (!imageBitmap) return;
    if (!isInsideImageArea(px, py)) return;

    const x = clamp(Math.floor(px), 0, els.canvas.width - 1);
    const y = clamp(Math.floor(py), 0, els.canvas.height - 1);

    const data = ctx.getImageData(x, y, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];

    const hex = rgbToHex(r, g, b);

    els.rgbText.textContent = `${r} ${g} ${b}`;
    els.hexText.textContent = hex;
    els.swatch.style.background = hex;

    const name = classifyName(r, g, b);

    lastNameDe = name.de;
    lastNameEn = name.en;

    els.colorName.textContent = currentLang === "de" ? name.de : name.en;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
    });
  }

  function initEvents() {
    els.langDe.addEventListener("click", () => setLang("de"));
    els.langEn.addEventListener("click", () => setLang("en"));

    els.btnChoose.addEventListener("click", (e) => {
      e.stopPropagation();
      els.fileInput.click();
    });

    els.btnClear.addEventListener("click", (e) => {
      e.stopPropagation();
      els.fileInput.value = "";
      clearCanvas();
    });

    els.fileInput.addEventListener("change", () => {
      const file = els.fileInput.files && els.fileInput.files[0];
      loadFile(file);
    });

    els.dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      els.dropzone.classList.add("is-dragover");
    });

    els.dropzone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("is-dragover");
    });

    els.dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("is-dragover");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) loadFile(file);
    });

    els.canvas.addEventListener("click", (e) => {
      const rect = els.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const px = (e.clientX - rect.left) * dpr;
      const py = (e.clientY - rect.top) * dpr;
      pickColorAt(px, py);
    });

    window.addEventListener("resize", () => {
      resizeCanvasForDisplay();
    });
  }

  function initCanvasSizing() {
    setTimeout(() => resizeCanvasForDisplay(), 0);
  }

  function init() {
    hideWorkAreaTexts();
    setLang("de");
    resetResult();
    initEvents();
    initCanvasSizing();
    registerServiceWorker();
  }

  init();
})();
