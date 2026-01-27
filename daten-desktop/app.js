"use strict";

/*
ColorFinder / FarbFinder Desktop Referenz v01
app.js

Aufgaben
1 Service Worker registrieren (Offline PWA)
2 Bild laden (Datei Auswahl und Drag Drop)
3 Bild auf Canvas zeichnen
4 Klick ins Bild -> Pixel lesen -> RGB HEX anzeigen -> Farbnamen aus fixer Liste bestimmen
5 DE EN Umschaltung

Wichtig
Die fixe Farbliste muss exakt der Spezifikation aus euren PDFs entsprechen.
Unten ist eine klare Stelle markiert, wo ihr eure finale Farbliste eintragt.
*/

(function () {
  const els = {
    langDe: document.getElementById("lang-de"),
    langEn: document.getElementById("lang-en"),

    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("fileInput"),
    btnChoose: document.getElementById("btnChoose"),
    btnClear: document.getElementById("btnClear"),

    canvas: document.getElementById("canvas"),
    swatch: document.getElementById("swatch"),
    colorName: document.getElementById("colorName"),
    rgbText: document.getElementById("rgbText"),
    hexText: document.getElementById("hexText"),

    fixedList: document.getElementById("fixedList")
  };

  const textIds = [
    "t-headline",
    "t-intro",
    "t-drop-title",
    "t-drop-sub",
    "t-choose",
    "t-clear",
    "t-formats",
    "t-canvas-help",
    "t-result-title",
    "t-result-note",
    "t-how-title",
    "t-scope-title",
    "t-scope-text",
    "t-privacy-title",
    "t-privacy-text",
    "t-fixed-title",
    "t-fixed-text",
    "t-readme-title",
    "t-readme-text",
    "t-footer-left",
    "t-footer-right"
  ];

  const I18N = {
    de: {
      "t-headline": "Bild laden und Farbe anklicken",
      "t-intro":
        "Diese Seite ist eine technische Referenz zur Methode. Kein Softwareprodukt. Keine App im klassischen Sinn. Keine Weiterentwicklung. Keine Updates. Kein Support. Nutzung auf eigene Verantwortung.",
      "t-drop-title": "Datei hier hineinziehen",
      "t-drop-sub": "oder per Button auswählen",
      "t-choose": "Bild auswählen",
      "t-clear": "Zurücksetzen",
      "t-formats": "Formate: jpg png webp gif bmp",
      "t-canvas-help": "Tipp: Nach dem Laden ins Bild klicken, um den Farbnamen zu erhalten.",
      "t-result-title": "Ergebnis",
      "t-result-note":
        "Ausgabe erfolgt nach fester Farbliste. Genauigkeit hängt von Bild, Licht, Kamera, Display und Browser ab.",
      "t-how-title": "So funktioniert es",
      "t-scope-title": "Abgrenzung",
      "t-scope-text":
        "Diese Referenz ist eine Methode zur Farbnamen Orientierung. Sie ersetzt keine professionelle Farbprüfung. Keine Zusagen zu Vollständigkeit, Fehlerfreiheit oder Eignung für bestimmte Zwecke.",
      "t-privacy-title": "Datenschutz Hinweis",
      "t-privacy-text":
        "Bilder werden lokal im Browser verarbeitet. Es findet kein Upload statt, sofern du selbst nichts hochlädst.",
      "t-fixed-title": "Feste Farbliste",
      "t-fixed-text":
        "Die Methode arbeitet mit einer festen Liste von Farbnamen und definierten Referenzfarben. Die genaue Liste steht in den PDFs und in den README Dateien.",
      "t-readme-title": "Dateien und Nutzung",
      "t-readme-text":
        "Diese Desktop Referenz wird als ZIP verteilt. Nach dem Entpacken index.html im Browser öffnen. Details stehen in ColorFinder_README_DE.txt und ColorFinder_README_EN.txt.",
      "t-footer-left": "FarbFinder ColorFinder Desktop Referenz v01",
      "t-footer-right": "Kein Produkt. Keine Updates. Eigenverantwortung."
    },
    en: {
      "t-headline": "Load an image and click a color",
      "t-intro":
        "This page is a technical reference for the method. Not a software product. Not an app in the classic sense. No further development. No updates. No support. Use at your own responsibility.",
      "t-drop-title": "Drag and drop an image here",
      "t-drop-sub": "or choose a file",
      "t-choose": "Choose image",
      "t-clear": "Reset",
      "t-formats": "Formats: jpg png webp gif bmp",
      "t-canvas-help": "Tip: After loading, click on the image to get the color name.",
      "t-result-title": "Result",
      "t-result-note":
        "Output follows a fixed color list. Accuracy depends on image, light, camera, display and browser.",
      "t-how-title": "How it works",
      "t-scope-title": "Scope",
      "t-scope-text":
        "This reference is a method for color name orientation. It does not replace professional color verification. No guarantees of completeness, error free operation, or fitness for a particular purpose.",
      "t-privacy-title": "Privacy note",
      "t-privacy-text":
        "Images are processed locally in the browser. No upload happens unless you upload something yourself.",
      "t-fixed-title": "Fixed color list",
      "t-fixed-text":
        "The method uses a fixed list of color names and defined reference colors. The exact list is in the PDFs and in the README files.",
      "t-readme-title": "Files and usage",
      "t-readme-text":
        "This desktop reference is distributed as a ZIP. After extracting, open index.html in your browser. Details are in ColorFinder_README_DE.txt and ColorFinder_README_EN.txt.",
      "t-footer-left": "FarbFinder ColorFinder Desktop Reference v01",
      "t-footer-right": "Not a product. No updates. Own responsibility."
    }
  };

  let currentLang = "de";

  // ---------- FIXE FARBLISTE HIER EINTRAGEN ----------
  // Wichtig: Diese Liste muss exakt der Spezifikation aus euren PDFs entsprechen.
  // Format: { name_de: "...", name_en: "...", hex: "#RRGGBB" }
  const FIXED_COLORS = [
    // Beispiel Platzhalter. Bitte durch eure finale Liste ersetzen.
    { name_de: "Rot", name_en: "Red", hex: "#E53935" },
    { name_de: "Orange", name_en: "Orange", hex: "#FB8C00" },
    { name_de: "Gelb", name_en: "Yellow", hex: "#FDD835" },
    { name_de: "Grün", name_en: "Green", hex: "#43A047" },
    { name_de: "Cyan", name_en: "Cyan", hex: "#00ACC1" },
    { name_de: "Blau", name_en: "Blue", hex: "#1E88E5" },
    { name_de: "Violett", name_en: "Purple", hex: "#8E24AA" },
    { name_de: "Rosa", name_en: "Pink", hex: "#D81B60" },
    { name_de: "Braun", name_en: "Brown", hex: "#6D4C41" },
    { name_de: "Grau", name_en: "Gray", hex: "#757575" },
    { name_de: "Schwarz", name_en: "Black", hex: "#212121" },
    { name_de: "Weiß", name_en: "White", hex: "#FAFAFA" }
  ];
  // --------------------------------------------------

  const ctx = els.canvas.getContext("2d", { willReadFrequently: true });

  let imageBitmap = null;
  let drawInfo = {
    // wo liegt das Bild im Canvas (wegen Klick-Koordinaten)
    x: 0,
    y: 0,
    w: 0,
    h: 0
  };

  function setLang(lang) {
    currentLang = lang === "en" ? "en" : "de";

    const map = I18N[currentLang];
    for (const id of textIds) {
      const el = document.getElementById(id);
      if (el && map[id] != null) el.textContent = map[id];
    }

    const isDe = currentLang === "de";
    els.langDe.classList.toggle("is-active", isDe);
    els.langEn.classList.toggle("is-active", !isDe);
    els.langDe.setAttribute("aria-pressed", isDe ? "true" : "false");
    els.langEn.setAttribute("aria-pressed", !isDe ? "true" : "false");

    renderFixedList();
    // Ergebnisname neu anzeigen, falls schon gesetzt
    if (lastMatch) {
      els.colorName.textContent = isDe ? lastMatch.name_de : lastMatch.name_en;
    }
  }

  function hexToRgb(hex) {
    const h = String(hex || "").trim().replace("#", "");
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
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

  function findNearestFixedColor(rgb) {
    let best = null;
    let bestD = Infinity;

    for (const c of FIXED_COLORS) {
      const ref = hexToRgb(c.hex);
      const d = distanceRgb(rgb, ref);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }

    return { color: best, dist: bestD };
  }

  function renderFixedList() {
    if (!els.fixedList) return;

    els.fixedList.innerHTML = "";
    for (const c of FIXED_COLORS) {
      const item = document.createElement("div");
      item.className = "fixed-item";

      const sw = document.createElement("div");
      sw.className = "fixed-swatch";
      sw.style.background = c.hex;

      const label = document.createElement("div");
      label.className = "fixed-label";
      label.textContent = currentLang === "de" ? c.name_de : c.name_en;

      const meta = document.createElement("div");
      meta.className = "fixed-meta";
      meta.textContent = c.hex.toUpperCase();

      item.appendChild(sw);
      item.appendChild(label);
      item.appendChild(meta);
      els.fixedList.appendChild(item);
    }
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
    // Canvas soll sich am Container orientieren, aber intern scharf bleiben
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

    // contain scaling
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

    // Browser kann nicht jedes Format (zB tiff) nativ decodieren.
    // Wir halten es bewusst simpel und stabil: was der Browser kann, geht.
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

  let lastMatch = null;

  function pickColorAt(px, py) {
    if (!imageBitmap) return;

    if (!isInsideImageArea(px, py)) {
      // Klick außerhalb des Bildbereichs ignorieren
      return;
    }

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

    const nearest = findNearestFixedColor({ r, g, b });
    lastMatch = nearest.color;

    if (nearest.color) {
      els.colorName.textContent =
        currentLang === "de" ? nearest.color.name_de : nearest.color.name_en;
    } else {
      els.colorName.textContent = "-";
    }
  }

  function onChooseClick() {
    els.fileInput.click();
  }

  function onClearClick() {
    els.fileInput.value = "";
    clearCanvas();
  }

  function onDropzoneClick() {
    els.fileInput.click();
  }

  function onFileInputChange() {
    const file = els.fileInput.files && els.fileInput.files[0];
    loadFile(file);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    els.dropzone.classList.add("is-dragover");
  }

  function onDragLeave(e) {
    e.preventDefault();
    els.dropzone.classList.remove("is-dragover");
  }

  function onDrop(e) {
    e.preventDefault();
    els.dropzone.classList.remove("is-dragover");

    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadFile(file);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    // Scope automatisch aus dem aktuellen Ordner
    // Wichtig: sw.js muss im gleichen Ordner liegen wie index.html
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js", { scope: "./" })
        .catch(() => {
          // bewusst still, keine Support-Erwartung triggern
        });
    });
  }

  function initEvents() {
    els.langDe.addEventListener("click", () => setLang("de"));
    els.langEn.addEventListener("click", () => setLang("en"));

    els.btnChoose.addEventListener("click", onChooseClick);
    els.btnClear.addEventListener("click", onClearClick);
    els.fileInput.addEventListener("change", onFileInputChange);

    els.dropzone.addEventListener("click", onDropzoneClick);
    els.dropzone.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") onDropzoneClick();
    });

    els.dropzone.addEventListener("dragover", onDragOver);
    els.dropzone.addEventListener("dragleave", onDragLeave);
    els.dropzone.addEventListener("drop", onDrop);

    els.canvas.addEventListener("click", e => {
      const pos = getCanvasClickPos(e);
      pickColorAt(pos.x, pos.y);
    });

    window.addEventListener("resize", () => {
      resizeCanvasForDisplay();
    });
  }

  function initCanvasSizing() {
    // Wenn CSS die Canvas Größe steuert, müssen wir sie intern passend setzen.
    // Falls CSS noch nicht geladen ist, resize nach einem Tick.
    setTimeout(() => {
      resizeCanvasForDisplay();
    }, 0);
  }

  function init() {
    setLang("de");
    renderFixedList();
    resetResult();
    initEvents();
    initCanvasSizing();
    registerServiceWorker();
  }

  init();
})();
