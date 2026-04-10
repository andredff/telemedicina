/**
 * prescriptionParserService.ts
 *
 * Extrai texto de um PDF (via URL ou File) usando PDF.js,
 * depois localiza medicamentos no texto comparando contra
 * o catálogo da farmácia (medication_catalog).
 */

import type { MedicationCatalog } from "@/types/inventory";
import { getMedicationCatalog } from "@/services/inventoryService";

// ─── Normalização de texto ──────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
    .replace(/[^a-z0-9\s]/g, " ")   // remove pontuação
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Extração de texto via PDF.js ───────────────────────────────────────────

async function loadPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  // Worker bundled via CDN para evitar config de Vite
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  return pdfjsLib;
}

/**
 * Extrai todo o texto de um PDF a partir de uma URL.
 * Pode falhar por CORS — nesse caso retorna null.
 */
export async function extractTextFromUrl(url: string): Promise<string | null> {
  try {
    const pdfjsLib = await loadPdfJs();
    const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false });
    const pdf = await loadingTask.promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageText = content.items.map((item: any) => item.str ?? "").join(" ");
      pages.push(pageText);
    }
    return pages.join("\n");
  } catch (err) {
    console.warn("[prescriptionParser] Falha ao extrair PDF via URL:", err);
    return null;
  }
}

/**
 * Extrai texto de um File PDF (upload local).
 */
export async function extractTextFromFile(file: File): Promise<string | null> {
  try {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageText = content.items.map((item: any) => item.str ?? "").join(" ");
      pages.push(pageText);
    }
    return pages.join("\n");
  } catch (err) {
    console.warn("[prescriptionParser] Falha ao extrair PDF do arquivo:", err);
    return null;
  }
}

// ─── Tokenização da receita ──────────────────────────────────────────────────

interface PrescriptionTokens {
  /** Texto normalizado completo */
  full: string;
  /** Primeira palavra longa (nome do remédio) */
  nome: string;
  /** Dosagem extraída, ex: "200mg", "500mg", "10ml" */
  dosagem: string | null;
  /** Forma farmacêutica, ex: "comprimido", "capsula", "solucao" */
  forma: string | null;
  /** Quantidade numérica, ex: "20" de "20un" ou "1" de "1 embalagem" */
  quantidade: string | null;
  /** Laboratório / fabricante */
  laboratorio: string | null;
}

const FORMAS_FARMACEUTICAS = [
  "comprimido", "capsula", "solucao", "suspensao", "xarope",
  "pomada", "creme", "gel", "injetavel", "ampola", "supositorio",
  "adesivo", "spray", "gotas", "colirio", "inalacao", "pastilha",
];

const LABORATORIOS_CONHECIDOS = [
  "germed", "ems", "medley", "eurofarma", "biolab", "pfizer", "novartis",
  "bayer", "sanofi", "astrazeneca", "roche", "abbott", "neo quimica",
  "prati donaduzzi", "teuto", "ranbaxy", "sandoz", "teva", "hypermarcas",
];

function tokenizePrescription(normalizedText: string): PrescriptionTokens {
  // Dosagem: número seguido de unidade farmacêutica
  const dosagemMatch = normalizedText.match(/\b(\d+(?:[,.]\d+)?\s*(?:mg|mcg|g|ml|ui|ui\/ml|mg\/ml|%))\b/i);
  const dosagem = dosagemMatch ? dosagemMatch[1].replace(/\s+/g, "") : null;

  // Forma farmacêutica
  const forma = FORMAS_FARMACEUTICAS.find(f => normalizedText.includes(f)) ?? null;

  // Quantidade: número antes de "un", "unidade", "embalagem", "caixa", "comprimido"
  const quantMatch = normalizedText.match(/\b(\d+)\s*(?:un\b|unidade|embalagem|caixa|comprimido|capsula|ampola)/i);
  const quantidade = quantMatch ? quantMatch[1] : null;

  // Laboratório
  const laboratorio = LABORATORIOS_CONHECIDOS.find(l => normalizedText.includes(l)) ?? null;

  // Nome: primeira "palavra longa" que não seja dosagem, forma, quantidade ou lab
  const words = normalizedText.split(/\s+/);
  const nome = words.find(w =>
    w.length >= 4 &&
    !FORMAS_FARMACEUTICAS.includes(w) &&
    !LABORATORIOS_CONHECIDOS.includes(w) &&
    !/^\d/.test(w)
  ) ?? words[0] ?? "";

  return { full: normalizedText, nome, dosagem, forma, quantidade, laboratorio };
}

// ─── Score por critério ──────────────────────────────────────────────────────

const SCORE_THRESHOLD = 50; // score mínimo para considerar match válido

function scoreMatch(
  tokens: PrescriptionTokens,
  med: MedicationCatalog
): { score: number; matchedTerm: string } {
  let score = 0;
  let matchedTerm = "";

  const medName = normalize(med.name);
  const medActive = med.active_ingredient ? normalize(med.active_ingredient) : null;
  const medDosagem = med.dosage ? normalize(med.dosage) : null;
  const medForma = med.form ? normalize(med.form) : null;

  // Nome do remédio — peso 50
  if (medName.includes(tokens.nome) || tokens.full.includes(medName.split(" ")[0])) {
    score += 50;
    matchedTerm = tokens.nome;
  } else if (medActive && (medActive.includes(tokens.nome) || tokens.full.includes(medActive.split(" ")[0]))) {
    // Princípio ativo bate com nome da receita — peso 40
    score += 40;
    matchedTerm = medActive.split(" ")[0];
  }

  // Só pontua os outros critérios se já bateu o nome
  if (score === 0) return { score: 0, matchedTerm: "" };

  // Dosagem — peso 25
  if (tokens.dosagem && medDosagem) {
    const dNorm = tokens.dosagem.replace(/\s+/g, "");
    if (medDosagem.replace(/\s+/g, "").includes(dNorm) || dNorm.includes(medDosagem.replace(/\s+/g, ""))) {
      score += 25;
    }
  }

  // Forma farmacêutica — peso 10
  if (tokens.forma && medForma && medForma.includes(tokens.forma)) {
    score += 10;
  }

  // Fabricante/laboratório — peso 5
  if (tokens.laboratorio && med.manufacturer) {
    const mfr = normalize(med.manufacturer);
    if (mfr.includes(tokens.laboratorio) || tokens.laboratorio.includes(mfr.split(" ")[0])) {
      score += 5;
    }
  }

  return { score, matchedTerm };
}

// ─── Matching contra o catálogo ─────────────────────────────────────────────

export interface MatchedMedication {
  medication: MedicationCatalog;
  /** Termo que gerou o match */
  matchedTerm: string;
  /** Score numérico (0–100) */
  score: number;
  /** Confiança derivada do score */
  confidence: "high" | "medium" | "low";
}

function scoreToConfidence(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= SCORE_THRESHOLD) return "medium";
  return "low";
}

/**
 * Recebe o texto extraído do PDF e retorna medicamentos do catálogo
 * que foram encontrados no texto, ordenados por score decrescente.
 */
export async function matchMedicationsInText(
  rawText: string
): Promise<MatchedMedication[]> {
  const catalog = await getMedicationCatalog({ inStockOnly: false });
  if (catalog.length === 0) return [];

  const normalizedText = normalize(rawText);
  // Tokeniza o texto da receita inteiro como um bloco único
  const tokens = tokenizePrescription(normalizedText);

  const candidates: (MatchedMedication & { _score: number })[] = [];
  const seenIds = new Set<string>();

  for (const med of catalog) {
    if (seenIds.has(med.id)) continue;

    const { score, matchedTerm } = scoreMatch(tokens, med);
    if (score >= SCORE_THRESHOLD) {
      candidates.push({
        medication: med,
        matchedTerm,
        score,
        confidence: scoreToConfidence(score),
        _score: score,
      });
      seenIds.add(med.id);
    }
  }

  // Ordena por score decrescente, depois por nome
  candidates.sort((a, b) =>
    b._score !== a._score
      ? b._score - a._score
      : a.medication.name.localeCompare(b.medication.name)
  );

  return candidates.map(({ _score: _s, ...rest }) => rest);
}

// ─── Utilitário: texto manual (fallback quando CORS bloqueia PDF) ───────────

/**
 * Recebe texto digitado/colado pelo usuário e faz o mesmo matching.
 */
export async function matchMedicationsInManualText(
  text: string
): Promise<MatchedMedication[]> {
  return matchMedicationsInText(text);
}
