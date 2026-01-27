"use strict";

/*
ColorFinder / FarbFinder Desktop Referenz v01
app.js

Funktionen
1 Service Worker registrieren
2 Bild laden (Choose) und Drag Drop
3 Bild auf Canvas zeichnen
4 Klick ins Bild -> Pixel lesen -> RGB HEX -> nächster Farbname aus fixer Referenzliste
5 DE EN Umschaltung
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

    howList: document.getElementById("t-how-list"),

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
    "t-result-note",
    "t-how-title",
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
      "t-result-note":
        "Ausgabe erfolgt nach fester Farbliste. Genauigkeit hängt von Bild, Licht, Display und Browser ab.",
      "t-how-title": "So funktioniert es",
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
      "t-result-note":
        "Output follows a fixed color list. Accuracy depends on image, light, display and browser.",
      "t-how-title": "How it works",
      "t-footer-left": "FarbFinder ColorFinder Desktop Reference v01",
      "t-footer-right": "Not a product. No updates. Own responsibility.",
      footer_privacy: "Images are processed locally in the browser. No upload."
    }
  };

  const HOW_STEPS = {
    de: ["Bild laden oder hineinziehen", "Ins Bild klicken", "Farbnamen wird angezeigt"],
    en: ["Load or drag an image", "Click on the image", "The color name is shown"]
  };

  let currentLang = "de";

  const FIXED_COLORS = [
    { name_de: "Schwarz", name_en: "Black", hex: "#000000" },
    { name_de: "Anthrazit", name_en: "Anthracite", hex: "#1E1E1E" },
    { name_de: "Dunkelgrau", name_en: "Dark Gray", hex: "#3A3A3A" },
    { name_de: "Grau", name_en: "Gray", hex: "#808080" },
    { name_de: "Hellgrau", name_en: "Light Gray", hex: "#CFCFCF" },
    { name_de: "Silbergrau", name_en: "Silver Gray", hex: "#BFC3C7" },

    { name_de: "Reinweiß", name_en: "Pure White", hex: "#FFFFFF" },
    { name_de: "Weiß", name_en: "White", hex: "#F7F7F7" },
    { name_de: "Gebrochenes Weiß", name_en: "Off White", hex: "#F2F0E6" },
    { name_de: "Cremeweiß", name_en: "Cream White", hex: "#FFF1D6" },
    { name_de: "Elfenbein", name_en: "Ivory", hex: "#FFFFF0" },
    { name_de: "Warmweiß", name_en: "Warm White", hex: "#FFF4E5" },
    { name_de: "Kaltweiß", name_en: "Cool White", hex: "#F4FBFF" },
    { name_de: "Titanweiß", name_en: "Titanium White", hex: "#F8F9FF" },

    { name_de: "Silber", name_en: "Silver", hex: "#C0C0C0" },
    { name_de: "Aluminium", name_en: "Aluminum", hex: "#D6D6D6" },
    { name_de: "Titan", name_en: "Titanium", hex: "#A7A9AC" },

    { name_de: "Gold", name_en: "Gold", hex: "#D4AF37" },
    { name_de: "Hellgold", name_en: "Light Gold", hex: "#E6C86E" },
    { name_de: "Dunkelgold", name_en: "Dark Gold", hex: "#B38B2E" },
    { name_de: "Rotgold", name_en: "Rose Gold", hex: "#B76E79" },
    { name_de: "Weißgold", name_en: "White Gold", hex: "#E6E1D6" },
    { name_de: "Kupfer", name_en: "Copper", hex: "#B87333" },
    { name_de: "Bronze", name_en: "Bronze", hex: "#CD7F32" },

    { name_de: "Dunkelbraun", name_en: "Dark Brown", hex: "#3B2A1A" },
    { name_de: "Braun", name_en: "Brown", hex: "#6D4C41" },
    { name_de: "Hellbraun", name_en: "Light Brown", hex: "#A67C52" },
    { name_de: "Beige", name_en: "Beige", hex: "#DCC7A1" },
    { name_de: "Hellbeige", name_en: "Light Beige", hex: "#E9DCC6" },
    { name_de: "Sand", name_en: "Sand", hex: "#D8C08C" },
    { name_de: "Ocker", name_en: "Ochre", hex: "#C99700" },
    { name_de: "Camel", name_en: "Camel", hex: "#C19A6B" },
    { name_de: "Karamell", name_en: "Caramel", hex: "#C68E17" },
    { name_de: "Kastanienbraun", name_en: "Chestnut", hex: "#7B3F00" },
    { name_de: "Schokobraun", name_en: "Chocolate Brown", hex: "#4E2A1E" },
    { name_de: "Olivebraun", name_en: "Olive Brown", hex: "#6B5B2A" },

    { name_de: "Dunkelrot", name_en: "Dark Red", hex: "#8B0000" },
    { name_de: "Rot", name_en: "Red", hex: "#E53935" },
    { name_de: "Hellrot", name_en: "Light Red", hex: "#FF6B6B" },
    { name_de: "Ziegelrot", name_en: "Brick Red", hex: "#B22222" },
    { name_de: "Bordeaux", name_en: "Bordeaux", hex: "#6A0D25" },
    { name_de: "Weinrot", name_en: "Wine Red", hex: "#722F37" },
    { name_de: "Kirschrot", name_en: "Cherry Red", hex: "#D2042D" },
    { name_de: "Korallenrot", name_en: "Coral Red", hex: "#FF6F61" },

    { name_de: "Dunkelorange", name_en: "Dark Orange", hex: "#D35400" },
    { name_de: "Orange", name_en: "Orange", hex: "#FB8C00" },
    { name_de: "Hellorange", name_en: "Light Orange", hex: "#FFB366" },
    { name_de: "Apricot", name_en: "Apricot", hex: "#FBCEB1" },
    { name_de: "Pfirsich", name_en: "Peach", hex: "#FFDAB9" },

    { name_de: "Goldgelb", name_en: "Golden Yellow", hex: "#F4C430" },
    { name_de: "Gelb", name_en: "Yellow", hex: "#FDD835" },
    { name_de: "Hellgelb", name_en: "Light Yellow", hex: "#FFF59D" },
    { name_de: "Senfgelb", name_en: "Mustard", hex: "#CDA434" },

    { name_de: "Dunkelgrün", name_en: "Dark Green", hex: "#0B3D2E" },
    { name_de: "Waldgrün", name_en: "Forest Green", hex: "#228B22" },
    { name_de: "Moosgrün", name_en: "Moss Green", hex: "#6A7B3C" },
    { name_de: "Olivgrün", name_en: "Olive Green", hex: "#556B2F" },
    { name_de: "Khaki", name_en: "Khaki", hex: "#BDB76B" },

    { name_de: "Grün", name_en: "Green", hex: "#43A047" },
    { name_de: "Hellgrün", name_en: "Light Green", hex: "#A5D6A7" },
    { name_de: "Apfelgrün", name_en: "Apple Green", hex: "#7CFC00" },
    { name_de: "Lindgrün", name_en: "Lime Green", hex: "#32CD32" },
    { name_de: "Mintgrün", name_en: "Mint Green", hex: "#98FF98" },
    { name_de: "Graugrün", name_en: "Gray Green", hex: "#7E8F7A" },

    { name_de: "Dunkelblau", name_en: "Dark Blue", hex: "#0B2D5B" },
    { name_de: "Navyblau", name_en: "Navy Blue", hex: "#001F3F" },
    { name_de: "Blau", name_en: "Blue", hex: "#1E88E5" },
    { name_de: "Hellblau", name_en: "Light Blue", hex: "#90CAF9" },
    { name_de: "Babyblau", name_en: "Baby Blue", hex: "#BFE7FF" },

    { name_de: "Türkis", name_en: "Turquoise", hex: "#40E0D0" },
    { name_de: "Cyan", name_en: "Cyan", hex: "#00BCD4" },
    { name_de: "Petrol", name_en: "Petrol", hex: "#006D77" },
    { name_de: "Aqua", name_en: "Aqua", hex: "#7FDBFF" },
    { name_de: "Graublau", name_en: "Blue Gray", hex: "#6B7C93" },

    { name_de: "Dunkelviolett", name_en: "Dark Violet", hex: "#3B1B5A" },
    { name_de: "Violett", name_en: "Violet", hex: "#7E57C2" },
    { name_de: "Lila", name_en: "Purple", hex: "#8E24AA" },
    { name_de: "Aubergine", name_en: "Aubergine", hex: "#2E1A2F" },
    { name_de: "Pflaume", name_en: "Plum", hex: "#8E4585" },

    { name_de: "Magenta", name_en: "Magenta", hex: "#FF00FF" },
    { name_de: "Fuchsia", name_en: "Fuchsia", hex: "#E91E63" },

    { name_de: "Rosa", name_en: "Pink", hex: "#FF69B4" },
    { name_de: "Hellrosa", name_en: "Light Pink", hex: "#FFC1DA" },
    { name_de: "Altrosa", name_en: "Rose", hex: "#C9879A" },

    { name_de: "Olive", name_en: "Olive", hex: "#808000" },
    { name_de: "Olivgrün Braun", name_en: "Olive Green Brown", hex: "#5A4D2E" },
    { name_de: "Graubraun", name_en: "Gray Brown", hex: "#6E6259" }
  ];

  const ctx = els.canvas.getContext("2d", { willReadFrequently: true });

  let imageBitmap = null;
  let drawInfo = { x: 0, y: 0, w: 0, h: 0 };
  let lastMatch = null;

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

    renderHowList();

    if (lastMatch) {
      els.colorName.textContent = isDe ? lastMatch.name_de : lastMatch.name_en;
    }
  }

  function renderHowList() {
    if (!els.howList) return;
    const steps = HOW_STEPS[currentLang] || HOW_STEPS.de;
    els.howList.innerHTML = "";
    for (const s of steps) {
      const li = document.createElement("li");
      li.textContent = s;
      els.howList.appendChild(li);
    }
  }

  function hexToRgb(hex) {
    const h = String(hex || "").trim().replace("#", "");
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const toHex = v => {
      const n = Math.max(0, Math.min(255, v | 0));
      return n.toString(16).padStart(2, "0");
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function distanceRgb(a, b) {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
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

  function isNeutralColor(c) {
    const de = (c.name_de || "").toLowerCase();
    const en = (c.name_en || "").toLowerCase();
    return (
      de === "schwarz" || en === "black" ||
      de.indexOf("grau") !== -1 || en.indexOf("gray") !== -1 || en.indexOf("grey") !== -1 ||
      de.indexOf("weiß") !== -1 || en.indexOf("white") !== -1 || en.indexOf("ivory") !== -1
    );
  }

  function findNearestFixedColor(rgb, opts) {
    const excludeNeutrals = !!(opts && opts.excludeNeutrals);

    let best = null;
    let bestD = Infinity;

    for (const c of FIXED_COLORS) {
      if (excludeNeutrals && isNeutralColor(c)) continue;
      const ref = hexToRgb(c.hex);
      const d = distanceRgb(rgb, ref);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }

    if (!best && excludeNeutrals) {
      return findNearestFixedColor(rgb, { excludeNeutrals: false });
    }

    return { color: best, dist: bestD };
  }

  function resetResult() {
    els.swatch.style.background = "transparent";
    els.colorName.textContent = "-";
    els.rgbText.textContent = "-";
    els.hexText.textContent = "-";
    lastMatch = null;
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
    return {
      x: (evt.clientX - rect.left) * dpr,
      y: (evt.clientY - rect.top) * dpr
    };
  }

  function isInsideImageArea(px, py) {
    return (
      px >= drawInfo.x &&
      py >= drawInfo.y &&
      px < drawInfo.x + drawInfo.w &&
      py < drawInfo.y + drawInfo.h
    );
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

    const hsl = rgbToHsl(r, g, b);
    const excludeNeutrals = hsl.l < 0.22 && hsl.s > 0.20;

    const nearest = findNearestFixedColor({ r, g, b }, { excludeNeutrals });
    lastMatch = nearest.color;

    if (nearest.color) {
      els.colorName.textContent =
        currentLang === "de" ? nearest.color.name_de : nearest.color.name_en;
    } else {
      els.colorName.textContent = "-";
    }
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

    els.btnChoose.addEventListener("click", e => {
      e.stopPropagation();
      els.fileInput.click();
    });

    els.btnClear.addEventListener("click", e => {
      e.stopPropagation();
      els.fileInput.value = "";
      clearCanvas();
    });

    els.fileInput.addEventListener("change", () => {
      const file = els.fileInput.files && els.fileInput.files[0];
      loadFile(file);
    });

    els.dropzone.addEventListener("dragover", e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      els.dropzone.classList.add("is-dragover");
    });

    els.dropzone.addEventListener("dragleave", e => {
      e.preventDefault();
      els.dropzone.classList.remove("is-dragover");
    });

    els.dropzone.addEventListener("drop", e => {
      e.preventDefault();
      els.dropzone.classList.remove("is-dragover");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) loadFile(file);
    });

    els.canvas.addEventListener("click", e => {
      const pos = getCanvasClickPos(e);
      pickColorAt(pos.x, pos.y);
    });

    window.addEventListener("resize", () => {
      resizeCanvasForDisplay();
    });
  }

  function initCanvasSizing() {
    setTimeout(() => resizeCanvasForDisplay(), 0);
  }

  function init() {
    setLang("de");
    renderHowList();
    resetResult();
    initEvents();
    initCanvasSizing();
    registerServiceWorker();
  }

  init();
})();
