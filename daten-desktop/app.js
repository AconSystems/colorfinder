"use strict";

/*
ColorFinder / FarbFinder Desktop Referenz v01
app.js

Vollversion mit CSV Palette + Familien Gate + DE/EN

Enthält
- DE/EN Umschaltung UI
- Drag & Drop + Choose + Reset
- Canvas Resize stabil
- Klick ins Bild -> RGB/HEX -> Farbnamen
- Service Worker Registrierung
- Matching gegen große Palette aus CSV 1
- Familien Gate für alle Grundfarben
- Sonderlogik: Beige, Braun, Gold, Silber
- Filter raus: kupfer aluminium olive oliv (auch zusammengesetzte Namen)
- Ergebnis Hinweis ausblenden
- How it works ausblenden
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
    if (els.resultNote) els.resultNote.style.display = "none";
    if (els.howTitle) {
      const box = els.howTitle.closest(".card-inset");
      if (box) box.style.display = "none";
      else els.howTitle.style.display = "none";
    }
    if (els.howList) els.howList.style.display = "none";
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

  function isInsideImageArea(px, py) {
    return (
      px >= drawInfo.x &&
      py >= drawInfo.y &&
      px < drawInfo.x + drawInfo.w &&
      py < drawInfo.y + drawInfo.h
    );
  }

  function dist2RGB(r, g, b, p) {
    const dr = r - p.r;
    const dg = g - p.g;
    const db = b - p.b;
    return dr * dr + dg * dg + db * db;
  }

  // Kontrollierte EN Übersetzung (Variante A)
  // 1) harte Ausnahmen
  // 2) definierte Wortbausteine (keine freie Fantasie)
  const EN_EXACT = {
    "Elfenbein": "Ivory",
    "Hellelfenbein": "Light Ivory",
    "Cremeweiß": "Cream White",
    "Grauweiß": "Grey White",
    "Reinweiß": "Pure White",
    "Tiefschwarz": "Deep Black",
    "Signalschwarz": "Signal Black",
    "Signalweiß": "Signal White",
    "Verkehrsweiß": "Traffic White",
    "Verkehrsschwarz": "Traffic Black",
    "Papyrusweiß": "Papyrus White",
    "Perlweiß": "Pearl White",
    "Silbergrau": "Silver Grey",
    "Anthrazitgrau": "Anthracite Grey",
    "Graphitgrau": "Graphite Grey",
    "Graphitschwarz": "Graphite Black"
  };

  const EN_PARTS = [
    ["Verkehrs", "Traffic "],
    ["Signal", "Signal "],
    ["Perl", "Pearl "],
    ["Leucht", "Fluorescent "],
    ["Hell", "Light "],
    ["Dunkel", "Dark "]
  ];

  const EN_SUFFIX = [
    ["weiß", "White"],
    ["schwarz", "Black"],
    ["grau", "Grey"],
    ["blau", "Blue"],
    ["grün", "Green"],
    ["rot", "Red"],
    ["gelb", "Yellow"],
    ["orange", "Orange"],
    ["violett", "Violet"],
    ["purpur", "Purple"],
    ["magenta", "Magenta"],
    ["braun", "Brown"]
  ];

  function capitalizeWords(s) {
    return s
      .split(" ")
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function toEnName(deName) {
    if (!deName) return deName;

    if (EN_EXACT[deName]) return EN_EXACT[deName];

    let s = deName;

    // erst bekannte Präfixe auseinanderziehen
    for (const [de, en] of EN_PARTS) {
      if (s.startsWith(de)) {
        s = s.replace(de, en);
        break;
      }
    }

    // typische Komposita in Wortgrenzen bringen
    // Beispiel: "Beigebraun" -> "Beige braun" (danach Suffix Mapping)
    s = s.replace(/([a-zäöü])([A-ZÄÖÜ])/g, "$1 $2");

    // Suffix Mapping am Wortende oder als letztes Wort
    // wir arbeiten auf lower-case zur Erkennung, behalten aber danach Capitalize
    const parts = s.split(" ").filter(Boolean);

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const lower = p.toLowerCase();

      let replaced = p;
      for (const [deSuf, enSuf] of EN_SUFFIX) {
        if (lower.endsWith(deSuf)) {
          // Spezial: wenn Wort genau "Beige" ist, lassen wir es
          if (lower === "beige") {
            replaced = "Beige";
            break;
          }
          const stem = p.slice(0, p.length - deSuf.length);
          // Falls Stem leer: direkt das englische Wort
          replaced = (stem ? stem : "") + enSuf;
          break;
        }
      }
      parts[i] = replaced;
    }

    let out = parts.join(" ");

    // ein paar weitere kontrollierte Begriffe
    out = out.replace(/\bLachs\b/gi, "Salmon");
    out = out.replace(/\bTomaten\b/gi, "Tomato");
    out = out.replace(/\bWein\b/gi, "Wine");
    out = out.replace(/\bRose\b/gi, "Rose");
    out = out.replace(/\bApricot\b/gi, "Apricot");
    out = out.replace(/\bPfirsich\b/gi, "Peach");
    out = out.replace(/\bNuss\b/gi, "Nut");
    out = out.replace(/\bMaus\b/gi, "Mouse");
    out = out.replace(/\bZement\b/gi, "Cement");
    out = out.replace(/\bBeton\b/gi, "Concrete");
    out = out.replace(/\bFenster\b/gi, "Window");
    out = out.replace(/\bStein\b/gi, "Stone");

    return capitalizeWords(out.trim());
  }

  // CSV Palette
  const CSV_PALETTE = `
Farbname,Hexcode,RGB
Grünbeige,#CCC58F,204 197 143
Beige,#D1BC8A,209 188 138
Sandgelb,#D2B773,210 183 115
Signalgelb,#F7BA0B,247 186 11
Goldgelb,#E2B007,226 176 7
Honiggelb,#C89F04,200 159 4
Maisgelb,#E1A100,225 161 0
Narzissengelb,#E79C00,231 156 0
Braungelb,#AF8A54,175 138 84
Zitronengelb,#F5E039,245 224 57
Perlweiß,#EAE6CA,234 230 202
Elfenbein,#E1CC9F,225 204 159
Hellelfenbein,#E6D2B5,230 210 181
Schwefelgelb,#F1DD38,241 221 56
Safrangelb,#F6A951,246 169 81
Zinkgelb,#FACA30,250 202 48
Graubeige,#A48F7A,164 143 122
Olivgelb,#A08F65,160 143 101
Rapsgelb,#F6B600,246 182 0
Verkehrsgelb,#F7B500,247 181 0
Gelborange,#DD7907,221 121 7
Rotorange,#BE4E24,190 78 36
Blutorange,#C63927,198 57 39
Pastellorange,#FA842B,250 132 43
Reinorange,#E75B12,231 91 18
Leuchtorange,#FF2301,255 35 1
Leuchthellorange,#FFA421,255 164 33
Hellrotorange,#F3752C,243 117 44
Verkehrsorange,#E15501,225 85 1
Signalorange,#D4652F,212 101 47
Tieforange,#EC7C26,236 124 38
Lachsorange,#DB6A50,219 106 80
Perlorange,#954527,149 69 39
Feuerrot,#AB2524,171 37 36
Signalrot,#A02128,160 33 40
Karminrot,#A1232B,161 35 43
Rubinrot,#8D1D2C,141 29 44
Purpurrot,#701F29,112 31 41
Weinrot,#5E2028,94 32 40
Schwarzrot,#402225,64 34 37
Oxidrot,#703731,112 55 49
Braunrot,#7E292C,126 41 44
Beigerot,#CB8D73,203 141 115
Tomatenrot,#9C322E,156 50 46
Altrosa,#D47479,212 116 121
Hellrosa,#E1A6AD,225 166 173
Korallenrot,#AC4034,172 64 52
Rose,#D3545F,211 84 95
Erdbeerrot,#D14152,209 65 82
Verkehrsrot,#C1121C,193 18 28
Lachsrot,#D56D56,213 109 86
Leuchtrot,#F70000,247 0 0
Leuchthellrot,#FF0000,255 0 0
Himbeerrot,#B42041,180 32 65
Reinrot,#E72512,231 37 18
Perlrot,#AC2B37,172 43 55
Orientrot,#711521,113 21 33
Perlrubinrot,#B24C43,178 76 67
Rotlila,#6D3F5B,109 63 91
Rotviolett,#922B3E,146 43 62
Erikaviolett,#DE4C8A,222 76 138
Bordeauxviolett,#641C34,100 28 52
Blaulila,#6C4675,108 70 117
Verkehrspurpur,#A03472,160 52 114
Purpurviolett,#4A192C,74 25 44
Signalviolett,#924E7D,146 78 125
Pastellviolett,#A18594,161 133 148
Telemagenta,#CF3476,207 52 118
Perlviolett,#8673A1,134 115 161
Perlbrombeer,#6C6874,108 104 116
Violettblau,#354D73,53 77 115
Grünblau,#1F3438,31 52 56
Ultramarinblau,#20214F,32 33 79
Saphirblau,#1D1E33,29 30 51
Schwarzblau,#18171C,24 23 28
Signalblau,#1E2460,30 36 96
Brillantblau,#3E5F8A,62 95 138
Graublau,#26252D,38 37 45
Azurblau,#025669,2 86 105
Enzianblau,#0E294B,14 41 75
Stahlblau,#231A24,35 26 36
Lichtblau,#3B83BD,59 131 189
Kobaltblau,#1E213D,30 33 61
Taubenblau,#606E8C,96 110 140
Himmelblau,#2271B3,34 113 179
Verkehrsblau,#063971,6 57 113
Türkisblau,#3F888F,63 136 143
Capriblau,#1B5583,27 85 131
Ozeanblau,#1D334A,29 51 74
Wasserblau,#256D7B,37 109 123
Nachtblau,#1C1F2A,28 31 42
Fernblau,#49678D,73 103 141
Pastellblau,#5D9B9B,93 155 155
Perlenzian,#2A6478,42 100 120
Perlnachtblau,#102C54,16 44 84
Patinagrün,#316650,49 102 80
Smaragdgrün,#287233,40 114 51
Laubgrün,#2D572C,45 87 44
Olivgrün,#424632,66 70 50
Blaugrün,#1F3A3D,31 58 61
Moosgrün,#2F4538,47 69 56
Graugrün,#3E3B32,62 59 50
Flaschengrün,#343B29,52 59 41
Braungrün,#39352A,57 53 42
Tannengrün,#31372B,49 55 43
Grasgrün,#35682D,53 104 45
Resedagrün,#587246,88 114 70
Schwarzgrün,#343E40,52 62 64
Schilfgrün,#6C7156,108 113 86
Gelboliv,#47402E,71 64 46
Schwarzoliv,#3B3C36,59 60 54
Türkisgrün,#1E5945,30 89 69
Maigrün,#4C9141,76 145 65
Gelbgrün,#57A639,87 166 57
Weißgrün,#BDECB6,189 236 182
Chromoxidgrün,#2E3A23,46 58 35
Blassgrün,#89AC76,137 172 118
Braunoliv,#25221B,37 34 27
Verkehrsgrün,#308446,48 132 70
Farngrün,#3D642D,61 100 45
Opalgrün,#015D52,1 93 82
Lichtgrün,#84C3BE,132 195 190
Kieferngrün,#2C5545,44 85 69
Minzgrün,#20603D,32 96 61
Signalgrün,#317F43,49 127 67
Minttürkis,#497E76,73 126 118
Pastelltürkis,#7FB5B5,127 181 181
Perlgrün,#1C542D,28 84 45
Perlopalgrün,#193737,25 55 55
Reingrün,#008F39,0 143 57
Leuchtgrün,#00BB2D,0 187 45
Fehgrau,#78858B,120 133 139
Silbergrau,#8A9597,138 149 151
Olivgrau,#7E7B52,126 123 82
Moosgrau,#6C7059,108 112 89
Signalgrau,#969992,150 153 146
Mausgrau,#646B63,100 107 99
Beigegrau,#6D6552,109 101 82
Khakigrau,#6A5F31,106 95 49
Grüngrau,#4D5645,77 86 69
Zeltgrau,#4C514A,76 81 74
Eisengrau,#434B4D,67 75 77
Basaltgrau,#4E5754,78 87 84
Braungrau,#464531,70 69 49
Schiefergrau,#434750,67 71 80
Anthrazitgrau,#293133,41 49 51
Schwarzgrau,#23282B,35 40 43
Umbragrau,#332F2C,51 47 44
Betongrau,#686C5E,104 108 94
Graphitgrau,#474A51,71 74 81
Granitegrau,#2F353B,47 53 59
Steingrau,#8B8C7A,139 140 122
Blaugrau,#474B4E,71 75 78
Kieselgrau,#B8B799,184 183 153
Zementgrau,#7D8471,125 132 113
Gelbgrau,#8F8B66,143 139 102
Lichtgrau,#CBD0CC,203 208 204
Platingrau,#7F7679,127 118 121
Staubgrau,#7D7F7D,125 127 125
Achatgrau,#B5B8B1,181 184 177
Quarzgrau,#6C6960,108 105 96
Fenstergrau,#9DA1AA,157 161 170
Verkehrsgrau A,#8D9295,141 146 149
Verkehrsgrau B,#4E5451,78 84 81
Seidengrau,#CAC4B0,202 196 176
Telegrau 1,#909090,144 144 144
Telegrau 2,#82898F,130 137 143
Telegrau 4,#D0D0D0,208 208 208
Perlmausgrau,#898176,137 129 118
Grünbraun,#826C34,130 108 52
Ockerbraun,#955F20,149 95 32
Signalbraun,#6C3B2A,108 59 42
Lehmbraun,#734222,115 66 34
Kupferbraun,#8E402A,142 64 42
Rehbraun,#59351F,89 53 31
Olivbraun,#6F4F28,111 79 40
Nussbraun,#5B3A29,91 58 41
Rotbraun,#592321,89 35 33
Sepiabraun,#382C1E,56 44 30
Kastanienbraun,#633A34,99 58 52
Mahagonibraun,#4C2F27,76 47 39
Schokoladenbraun,#45322E,69 50 46
Graubraun,#403A3A,64 58 58
Schwarzbraun,#212121,33 33 33
Beigebraun,#A65E2F,166 94 47
Terrabraun,#79553D,121 85 61
Perlkupfer,#755C49,117 92 73
Cremeweiß,#FDF4E3,253 244 227
Grauweiß,#E7EBDA,231 235 218
Signalweiß,#F4F4F4,244 244 244
Signalschwarz,#282828,40 40 40
Tiefschwarz,#0A0A0A,10 10 10
Weißaluminium,#A5A5A5,165 165 165
Graualuminium,#8F8F8F,143 143 143
Reinweiß,#FFFFFF,255 255 255
Graphitschwarz,#1C1C1C,28 28 28
Verkehrsweiß,#F6F6F6,246 246 246
Verkehrsschwarz,#1E1E1E,30 30 30
Papyrusweiß,#D7D7D7,215 215 215
Perlweiß,#9C9C9C,156 156 156
Perldunkelgrau,#828282,130 130 130
`.trim();

  // Filter Tokens: alles mit diesen Substrings fliegt raus
  const bannedTokens = ["kupfer", "aluminium", "olive", "oliv"];

  function measuredFamily(h, s, l) {
    // Sonderfälle zuerst
    // Silber sehr streng
    if (s <= 0.10 && l >= 0.62 && h >= 180 && h <= 260) return "silver";
    // Gold streng
    if (h >= 40 && h <= 62 && s >= 0.30 && l >= 0.30 && l <= 0.72) return "gold";
    // Beige Gruppe priorisiert
    if (h >= 28 && h <= 70 && s < 0.28 && l >= 0.33 && l <= 0.85) return "beige";
    // Neutral
    if (l <= 0.06) return "neutral";
    if (s <= 0.10) return "neutral";
    // Braun Kandidat
    if (h >= 10 && h <= 70 && s < 0.30 && l < 0.55 && l > 0.10) return "brown";
    // Grundfarben
    if (h >= 345 || h <= 15) return "red";
    if (h >= 16 && h <= 40) return "orange";
    if (h >= 41 && h <= 70) return "yellow";
    if (h >= 71 && h <= 165) return "green";
    if (h >= 166 && h <= 205) return "cyan";
    if (h >= 206 && h <= 255) return "blue";
    if (h >= 256 && h <= 299) return "violet";
    if (h >= 300 && h <= 344) return "magenta";
    return "other";
  }

  function entryFamily(name, h, s, l) {
    const lower = (name || "").toLowerCase();

    // Namens-basierte Sonderfamilien
    if (lower.indexOf("silber") !== -1) return "silver";
    if (lower.indexOf("gold") !== -1) return "gold";

    // Weiß Töne als beige bzw neutral
    if (lower.indexOf("elfenbein") !== -1) return "beige";
    if (lower.indexOf("beige") !== -1) return "beige";
    if (lower.indexOf("creme") !== -1) return "beige";
    if (lower.indexOf("papyrus") !== -1) return "beige";

    // Neutral über S
    if (l <= 0.06) return "neutral";
    if (s <= 0.10) return "neutral";

    // Braun Kandidat
    if (h >= 10 && h <= 70 && s < 0.30 && l < 0.55 && l > 0.10) return "brown";

    // Hue Familien
    if (h >= 345 || h <= 15) return "red";
    if (h >= 16 && h <= 40) return "orange";
    if (h >= 41 && h <= 70) return "yellow";
    if (h >= 71 && h <= 165) return "green";
    if (h >= 166 && h <= 205) return "cyan";
    if (h >= 206 && h <= 255) return "blue";
    if (h >= 256 && h <= 299) return "violet";
    if (h >= 300 && h <= 344) return "magenta";
    return "other";
  }

  function parsePalette(csvText) {
    const lines = csvText.split(/\r?\n/);
    const out = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(",");
      if (parts.length < 3) continue;

      const name = (parts[0] || "").trim();
      const hex = (parts[1] || "").trim();
      const rgbStr = (parts[2] || "").trim();

      const nLower = name.toLowerCase();

      // Filter raus
      let banned = false;
      for (const t of bannedTokens) {
        if (nLower.indexOf(t) !== -1) {
          banned = true;
          break;
        }
      }
      // Gold Silber bleiben erlaubt
      if (banned && nLower.indexOf("gold") === -1 && nLower.indexOf("silber") === -1) {
        continue;
      }

      const rgbParts = rgbStr.split(" ").filter(Boolean);
      if (rgbParts.length < 3) continue;

      const r = parseInt(rgbParts[0], 10);
      const g = parseInt(rgbParts[1], 10);
      const b = parseInt(rgbParts[2], 10);

      if (![r, g, b].every(v => Number.isFinite(v))) continue;

      const hsl = rgbToHsl(r, g, b);
      const fam = entryFamily(name, hsl.h, hsl.s, hsl.l);

      out.push({ name, hex, r, g, b, fam });
    }

    return out;
  }

  const palette = parsePalette(CSV_PALETTE);

  // Kandidaten pro Familie vorbereiten
  const byFam = {};
  for (const p of palette) {
    if (!byFam[p.fam]) byFam[p.fam] = [];
    byFam[p.fam].push(p);
  }

  function bestFromList(r, g, b, list) {
    let best = null;
    let bestD = Infinity;
    for (const p of list) {
      const d = dist2RGB(r, g, b, p);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function nearestNameWithFamilyGate(r, g, b) {
    const hsl = rgbToHsl(r, g, b);
    const fam = measuredFamily(hsl.h, hsl.s, hsl.l);

    const candidates = byFam[fam] || [];

    // Fallback Reihenfolge, falls eine Familie mal leer ist
    const fallbackOrder = {
      beige: ["beige", "yellow", "neutral", "brown"],
      gold: ["gold", "yellow", "beige"],
      silver: ["silver", "neutral"],
      brown: ["brown", "orange", "yellow"],
      orange: ["orange", "brown", "red", "yellow"],
      yellow: ["yellow", "beige", "orange"],
      red: ["red", "orange", "brown"],
      green: ["green", "cyan"],
      cyan: ["cyan", "blue", "green"],
      blue: ["blue", "cyan", "violet"],
      violet: ["violet", "magenta", "blue"],
      magenta: ["magenta", "violet", "red"],
      neutral: ["neutral", "silver", "beige"],
      other: ["neutral", "beige"]
    };

    let list = candidates;
    if (!list || list.length < 6) {
      const ord = fallbackOrder[fam] || ["neutral", "beige"];
      const merged = [];
      for (const f of ord) {
        const arr = byFam[f];
        if (arr && arr.length) merged.push.apply(merged, arr);
      }
      list = merged.length ? merged : palette;
    }

    const best = bestFromList(r, g, b, list);

    const deName = best ? best.name : "Grau";
    const enName = toEnName(deName);

    return { de: deName, en: enName, fam: fam };
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

    const name = nearestNameWithFamilyGate(r, g, b);

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

    if (els.dropzone) {
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
    }

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
