/**
 * server/receitas/matcher.js
 *
 * Faz matching dos medicamentos extraídos pela IA contra o catálogo
 * interno da Supabase (tabela medication_catalog).
 *
 * Algoritmo:
 * 1. Carrega o catálogo da Supabase (cache de 5 minutos)
 * 2. Para cada medicamento extraído, busca:
 *    a. Match exato no nome normalizado (confidence: high)
 *    b. Match por prefixo/substring do princípio ativo (confidence: high)
 *    c. Match por qualquer token do nome com ≥ 4 chars (confidence: medium)
 *    d. Match por distância de edição simples (confidence: low)
 * 3. Retorna encontrados + não encontrados
 *
 * Normalização: lowercase + remove acentos + remove pontuação
 */

"use strict";

// ─── Normalização ─────────────────────────────────────────────────────────────

function normalize(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // remove acentos
    .replace(/[^a-z0-9\s]/g, " ")     // remove pontuação
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokeniza e filtra tokens relevantes (≥ 4 chars, não são stopwords) */
const STOPWORDS = new Set([
  "para", "com", "sem", "uso", "oral", "sol", "solucao", "comp",
  "comprimido", "comprimidos", "capsula", "capsulas", "pomada",
  "creme", "gel", "xarope", "gotas", "spray", "ampola", "frasco",
  "injetavel", "suspensao", "continuo", "medica", "receita",
]);

function tokens(text) {
  return normalize(text)
    .split(" ")
    .filter(t => t.length >= 4 && !STOPWORDS.has(t));
}

// ─── Distância de Levenshtein simplificada ────────────────────────────────────

function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

/** Similaridade 0-1 baseada em Levenshtein */
function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ─── Cache do catálogo ────────────────────────────────────────────────────────

let catalogCache = null;
let catalogCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Carrega o catálogo de medicamentos da Supabase.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function getCatalog(supabase) {
  const now = Date.now();
  if (catalogCache && now - catalogCacheTime < CACHE_TTL_MS) {
    return catalogCache;
  }

  if (!supabase) {
    console.warn("[Matcher] Supabase não configurado — catálogo vazio");
    return [];
  }

  const { data, error } = await supabase
    .from("medication_catalog")
    .select("id, name, active_ingredient, dosage, category, price, stock, pharmacy_id")
    .order("name");

  if (error) {
    console.error("[Matcher] Erro ao carregar catálogo:", error.message);
    return catalogCache ?? [];
  }

  // Pré-computa tokens normalizados para matching rápido
  catalogCache = (data ?? []).map(med => ({
    ...med,
    _normName: normalize(med.name),
    _normActive: normalize(med.active_ingredient || ""),
    _tokensName: tokens(med.name),
    _tokensActive: tokens(med.active_ingredient || ""),
  }));
  catalogCacheTime = now;

  console.log(`[Matcher] Catálogo carregado: ${catalogCache.length} medicamentos`);
  return catalogCache;
}

/** Invalida o cache (chamar após atualizações no catálogo) */
function invalidateCache() {
  catalogCache = null;
}

// ─── Match de um medicamento ──────────────────────────────────────────────────

/**
 * Encontra o melhor match no catálogo para um medicamento extraído.
 *
 * @param {{nome: string, dosagem: string|null, principio_ativo: string|null}} aiMed
 * @param {Array} catalog
 * @returns {{ med: object, confidence: 'high'|'medium'|'low', score: number } | null}
 */
function findBestMatch(aiMed, catalog) {
  const normNome = normalize(aiMed.nome || "");
  const normActive = normalize(aiMed.principio_ativo || aiMed.nome || "");
  const tokNome = tokens(aiMed.nome || "");
  const tokActive = tokens(aiMed.principio_ativo || aiMed.nome || "");

  let best = null;
  let bestScore = 0;

  for (const cat of catalog) {
    let score = 0;
    let confidence = "low";

    // ── Teste 1: match exato de nome normalizado
    if (cat._normName === normNome) {
      score = 1.0;
      confidence = "high";
    }
    // ── Teste 2: nome do catálogo começa com nome extraído (ou vice-versa)
    else if (
      cat._normName.startsWith(normNome.split(" ")[0]) ||
      normNome.startsWith(cat._normName.split(" ")[0])
    ) {
      score = 0.9;
      confidence = "high";
    }
    // ── Teste 3: match por princípio ativo
    else if (normActive && cat._normActive && (
      cat._normActive.includes(normActive.split(" ")[0]) ||
      normActive.includes(cat._normActive.split(" ")[0])
    )) {
      score = 0.85;
      confidence = "high";
    }
    // ── Teste 4: token overlap (qualquer token significativo em comum)
    else {
      const allCatTokens = [...cat._tokensName, ...cat._tokensActive];
      const allAiTokens = [...tokNome, ...tokActive];

      const sharedTokens = allAiTokens.filter(t =>
        allCatTokens.some(ct => ct.startsWith(t) || t.startsWith(ct))
      );

      if (sharedTokens.length > 0) {
        score = 0.6 + sharedTokens.length * 0.05;
        confidence = "medium";
      }
      // ── Teste 5: similaridade Levenshtein no primeiro token do nome
      else {
        const firstAiToken = tokNome[0] || normNome.split(" ")[0];
        const firstCatToken = cat._tokensName[0] || cat._normName.split(" ")[0];
        if (firstAiToken && firstCatToken && firstAiToken.length >= 5) {
          const sim = similarity(firstAiToken, firstCatToken);
          if (sim >= 0.8) {
            score = sim * 0.55;
            confidence = "low";
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = { med: cat, confidence, score };
    }
  }

  // Threshold mínimo para aceitar um match
  return bestScore >= 0.5 ? best : null;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Cruza lista de medicamentos extraídos com o catálogo.
 *
 * @param {Array<{nome, dosagem, forma, quantidade, posologia}>} aiMeds medicamentos da IA
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{
 *   encontrados: Array,
 *   naoEncontrados: Array
 * }>}
 */
async function matchMedications(aiMeds, supabase) {
  const catalog = await getCatalog(supabase);
  const encontrados = [];
  const naoEncontrados = [];
  const seenCatalogIds = new Set();

  for (const aiMed of aiMeds) {
    if (!aiMed.nome || aiMed.nome.trim().length < 3) continue;

    const match = findBestMatch(aiMed, catalog);

    if (match && !seenCatalogIds.has(match.med.id)) {
      seenCatalogIds.add(match.med.id);
      encontrados.push({
        // Dados da IA (prescrição)
        prescrito: {
          nome: aiMed.nome,
          dosagem: aiMed.dosagem || null,
          forma: aiMed.forma || null,
          quantidade: aiMed.quantidade || null,
          posologia: aiMed.posologia || null,
        },
        // Dados do catálogo (produto disponível)
        medicamentoId: match.med.id,
        nome: match.med.name,
        principioAtivo: match.med.active_ingredient || null,
        dosagem: match.med.dosage || null,
        preco: match.med.price,
        estoque: match.med.stock,
        farmaciaId: match.med.pharmacy_id || null,
        // Metadata do match
        confidence: match.confidence,
        score: Math.round(match.score * 100),
      });
    } else {
      naoEncontrados.push({
        nome: aiMed.nome,
        dosagem: aiMed.dosagem || null,
        forma: aiMed.forma || null,
        quantidade: aiMed.quantidade || null,
        posologia: aiMed.posologia || null,
        motivo: catalog.length === 0 ? "catálogo vazio" : "não encontrado no catálogo",
      });
    }
  }

  // Ordena: alta confiança primeiro, depois por nome
  encontrados.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    if (a.confidence !== b.confidence) return order[a.confidence] - order[b.confidence];
    return a.nome.localeCompare(b.nome);
  });

  return { encontrados, naoEncontrados };
}

module.exports = { matchMedications, invalidateCache };
