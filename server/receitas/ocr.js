/**
 * server/receitas/ocr.js
 *
 * Pipeline OCR para receitas médicas.
 *
 * Estratégias em ordem de tentativa:
 * 1. PDF com texto nativo → extrai via pdfjs-dist (sem OCR, perfeito)
 * 2. PDF sem texto / imagem → converte cada página para PNG via sharp + Tesseract.js
 * 3. Imagem direta → Tesseract.js
 *
 * Tesseract: modelo "por" (Português) com fallback para "eng"
 */

"use strict";

const path = require("path");
const { createWorker } = require("tesseract.js");

// ─── pdfjs (Node legacy build) ────────────────────────────────────────────────

/** Carrega pdfjs-dist compatível com Node */
async function getPdfJs() {
  // Usa dynamic import para ESM
  const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return mod;
}

// ─── Normalização de texto ────────────────────────────────────────────────────

function cleanText(raw) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")        // múltiplos espaços → 1
    .replace(/\n{3,}/g, "\n\n")     // 3+ quebras → 2
    .trim();
}

// ─── Etapa 1: extração de texto nativo do PDF ─────────────────────────────────

/**
 * Tenta extrair texto via pdfjs-dist (PDFs com camada de texto).
 * @param {Buffer} pdfBuffer
 * @returns {Promise<string|null>} texto extraído ou null se PDF não tiver texto
 */
async function extractNativeTextFromPdf(pdfBuffer) {
  try {
    const pdfjs = await getPdfJs();

    // Desabilita worker no Node
    pdfjs.GlobalWorkerOptions = pdfjs.GlobalWorkerOptions || {};
    pdfjs.GlobalWorkerOptions.workerSrc = "";

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str ?? "").join(" ");
      pages.push(text);
    }

    const fullText = cleanText(pages.join("\n"));
    // PDF tem texto útil se tiver pelo menos 30 chars reais (não só espaços)
    return fullText.replace(/\s/g, "").length >= 30 ? fullText : null;
  } catch (err) {
    console.warn("[OCR] Falha ao extrair texto nativo do PDF:", err.message);
    return null;
  }
}

// ─── Etapa 2: renderizar PDF → imagens ───────────────────────────────────────

const { execFile } = require("child_process");
const os = require("os");
const fs = require("fs");

/** Verifica se pdftoppm (poppler) está disponível no PATH */
function hasPdftoppm() {
  try {
    require("child_process").execSync("which pdftoppm", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Usa pdftoppm (poppler) para converter PDF em PNGs de alta qualidade.
 * Vantagem: renderização fiel ao Acrobat Reader, sem dependência de canvas.
 * @param {Buffer} pdfBuffer
 * @returns {Promise<Buffer[]>} lista de buffers PNG, um por página
 */
async function pdfToImagesViaPoppler(pdfBuffer) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "novita-ocr-"));
  const pdfPath = path.join(tmpDir, "receita.pdf");
  const outPrefix = path.join(tmpDir, "page");

  try {
    fs.writeFileSync(pdfPath, pdfBuffer);

    await new Promise((resolve, reject) => {
      execFile(
        "pdftoppm",
        [
          "-r", "300",       // 300 DPI → excelente para OCR
          "-png",            // formato PNG
          pdfPath,
          outPrefix,
        ],
        (err) => { if (err) reject(err); else resolve(); }
      );
    });

    const files = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith("page") && f.endsWith(".png"))
      .sort();

    return files.map(f => fs.readFileSync(path.join(tmpDir, f)));
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/**
 * Fallback: usa pdfjs-dist + node-canvas para renderizar PDF.
 * Requer o pacote 'canvas' instalado.
 */
async function pdfToImagesViaCanvas(pdfBuffer) {
  try {
    const { createCanvas } = require("canvas");
    const pdfjs = await getPdfJs();

    pdfjs.GlobalWorkerOptions = pdfjs.GlobalWorkerOptions || {};
    pdfjs.GlobalWorkerOptions.workerSrc = "";

    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;

    const images = [];
    const SCALE = 2.5;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      images.push(canvas.toBuffer("image/png"));
    }

    return images;
  } catch (err) {
    console.warn("[OCR] Canvas não disponível:", err.message);
    return [];
  }
}

/**
 * Converte cada página do PDF em PNG.
 * Usa pdftoppm (poppler) se disponível, senão canvas.
 */
async function pdfPagesToImages(pdfBuffer) {
  if (hasPdftoppm()) {
    try {
      console.log("[OCR] Usando pdftoppm (300 DPI) para renderizar PDF");
      return await pdfToImagesViaPoppler(pdfBuffer);
    } catch (err) {
      console.warn("[OCR] pdftoppm falhou, tentando canvas:", err.message);
    }
  }
  return pdfToImagesViaCanvas(pdfBuffer);
}

// ─── Etapa 3: OCR via Tesseract.js ───────────────────────────────────────────

let tesseractWorker = null;

async function getTesseractWorker() {
  if (tesseractWorker) return tesseractWorker;

  // Tenta português primeiro, fallback para eng
  const worker = await createWorker("por+eng", 1, {
    logger: () => {}, // silencia logs de progresso
    langPath: path.join(__dirname, "..", "tessdata"),
    gzip: false,
  });

  tesseractWorker = worker;
  return worker;
}

/**
 * OCR de um buffer de imagem.
 * @param {Buffer} imageBuffer PNG/JPG/WEBP
 * @returns {Promise<string>}
 */
async function ocrImage(imageBuffer) {
  const worker = await getTesseractWorker();
  const { data } = await worker.recognize(imageBuffer);
  return cleanText(data.text || "");
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Extrai texto de um buffer PDF ou imagem.
 *
 * Retorna:
 * {
 *   text: string,          // texto extraído
 *   method: string,        // "native-pdf" | "ocr-pdf" | "ocr-image"
 *   pages: number,         // número de páginas processadas
 *   confidence: number     // 0-100 (estimado)
 * }
 *
 * @param {Buffer} fileBuffer
 * @param {string} mimetype  ex: "application/pdf" | "image/png"
 */
async function extractText(fileBuffer, mimetype) {
  const isPdf = mimetype === "application/pdf";

  // ── PDF ──────────────────────────────────────────────────────────────────
  if (isPdf) {
    // 1. Tenta texto nativo (rápido, preciso)
    console.log("[OCR] Tentando extração de texto nativo do PDF...");
    const nativeText = await extractNativeTextFromPdf(fileBuffer);

    if (nativeText) {
      console.log("[OCR] Texto nativo extraído:", nativeText.length, "chars");
      return { text: nativeText, method: "native-pdf", pages: 1, confidence: 95 };
    }

    // 2. PDF sem texto → renderiza e faz OCR
    console.log("[OCR] PDF sem texto nativo, tentando renderização + OCR...");
    const images = await pdfPagesToImages(fileBuffer);

    if (images.length > 0) {
      const texts = await Promise.all(images.map(img => ocrImage(img)));
      const fullText = cleanText(texts.join("\n\n"));
      console.log("[OCR] OCR de PDF concluído:", fullText.length, "chars,", images.length, "página(s)");
      return { text: fullText, method: "ocr-pdf", pages: images.length, confidence: 75 };
    }

    // 3. Canvas não disponível — retorna texto vazio
    console.warn("[OCR] Não foi possível renderizar o PDF. Instale 'canvas' para suporte completo.");
    return { text: "", method: "ocr-pdf-failed", pages: 0, confidence: 0 };
  }

  // ── Imagem ────────────────────────────────────────────────────────────────
  console.log("[OCR] OCR de imagem...");
  const text = await ocrImage(fileBuffer);
  console.log("[OCR] OCR de imagem concluído:", text.length, "chars");
  return { text, method: "ocr-image", pages: 1, confidence: 80 };
}

/**
 * Libera o worker Tesseract (chamar no shutdown do servidor).
 */
async function terminateOcr() {
  if (tesseractWorker) {
    await tesseractWorker.terminate();
    tesseractWorker = null;
  }
}

module.exports = { extractText, terminateOcr };
