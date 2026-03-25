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

// ─── Matching contra o catálogo ─────────────────────────────────────────────

export interface MatchedMedication {
  medication: MedicationCatalog;
  /** Termo que gerou o match */
  matchedTerm: string;
  /** Confiança aproximada: "high" | "medium" */
  confidence: "high" | "medium";
}

/**
 * Recebe o texto extraído do PDF e retorna medicamentos do catálogo
 * que foram encontrados no texto.
 */
export async function matchMedicationsInText(
  rawText: string
): Promise<MatchedMedication[]> {
  const catalog = await getMedicationCatalog({ inStockOnly: false });
  if (catalog.length === 0) return [];

  const normalizedText = normalize(rawText);
  const matched: MatchedMedication[] = [];
  const seenIds = new Set<string>();

  for (const med of catalog) {
    if (seenIds.has(med.id)) continue;

    // Termos de busca: nome e princípio ativo (primeira palavra = mais relevante)
    const terms: { term: string; confidence: "high" | "medium" }[] = [];

    const nameParts = normalize(med.name).split(" ");
    // Primeira palavra do nome (ex: "dipirona" em "Dipirona 500mg")
    if (nameParts[0] && nameParts[0].length >= 4) {
      terms.push({ term: nameParts[0], confidence: "high" });
    }
    // Nome completo sem dosagem (até 2 palavras)
    const shortName = nameParts.slice(0, 2).join(" ");
    if (shortName.length >= 6 && shortName !== nameParts[0]) {
      terms.push({ term: shortName, confidence: "high" });
    }

    // Princípio ativo
    if (med.active_ingredient) {
      const activeParts = normalize(med.active_ingredient).split(" ");
      if (activeParts[0] && activeParts[0].length >= 5) {
        terms.push({ term: activeParts[0], confidence: "medium" });
      }
    }

    for (const { term, confidence } of terms) {
      if (normalizedText.includes(term)) {
        matched.push({ medication: med, matchedTerm: term, confidence });
        seenIds.add(med.id);
        break;
      }
    }
  }

  // Ordena: alta confiança primeiro, depois por nome
  matched.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "high" ? -1 : 1;
    }
    return a.medication.name.localeCompare(b.medication.name);
  });

  return matched;
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
