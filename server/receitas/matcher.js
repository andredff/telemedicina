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

// ─── Normalização de dosagem ──────────────────────────────────────────────────

/**
 * Extrai e normaliza a dosagem de uma string.
 * Suporta: "500mg", "500mg/mL", "500mg/ml", "1g", "20mg/mL", "10ml"
 * Sempre retorna a parte numerador normalizada para comparação.
 * Ex: "500mg/mL" → "500mg", "1g" → "1000mg", "500 mg" → "500mg"
 */
function normalizeDosagem(text) {
  if (!text) return null;
  const t = text.toLowerCase().replace(/\s+/g, "");

  // Converte g/mL ou g puro → mg
  const gMatch = t.match(/^(\d+(?:[.,]\d+)?)g(?:\/.*)?$/);
  if (gMatch) {
    const mg = parseFloat(gMatch[1].replace(",", ".")) * 1000;
    return `${mg}mg`;
  }

  // mg/mL, mg/ml, mg puro, mcg, ml, ui, % — pega o numerador
  const mgMatch = t.match(/^(\d+(?:[.,]\d+)?)(mg|mcg|ml|ui|%)(?:\/.*)?$/);
  if (mgMatch) return `${parseFloat(mgMatch[1].replace(",", "."))}${mgMatch[2]}`;

  return null;
}

/**
 * Extrai a primeira dosagem encontrada no nome normalizado.
 * Ex: "dipirona sodica 500mg ml solucao" → "500mg"
 *     "dipirona 1g comprimido"           → "1000mg"
 */
function extractDosagemFromName(normName) {
  // Captura padrão "número unidade" ou "número unidade/unidade"
  const m = normName.match(/(\d+(?:[.,]?\d+)?)\s*(mg|mcg|g|ml|ui|%)(?:\/\w+)?/);
  if (!m) return null;
  return normalizeDosagem(m[1] + m[2]);
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

  // Dosagem prescrita: tenta campo dedicado primeiro, depois extrai do nome
  // (remove dosagem do nome antes de extrair para não confundir o matching)
  const normNomeSemDosagem = normNome.replace(/\d+(?:[.,]?\d+)?\s*(?:mg|mcg|g|ml|ui|%)(?:\/\w+)?/g, "").trim();
  const dosagemPrescrita =
    normalizeDosagem(aiMed.dosagem) ||
    extractDosagemFromName(normNome);

  console.log(`[Matcher] "${aiMed.nome}" | dosagem bruta="${aiMed.dosagem}" → normalizada="${dosagemPrescrita}" | nomeSemDosagem="${normNomeSemDosagem}"`);

  // Coleta todos os candidatos que batem no nome, separando por dosagem
  const candidatosDosagemCerta = [];
  const candidatosDosagemNula  = []; // catálogo sem dosagem definida
  const candidatosDosagemErrada = [];

  for (const cat of catalog) {
    let nameScore = 0;
    let confidence = "low";

    // ── Teste 1: match exato de nome normalizado
    if (cat._normName === normNome || cat._normName === normNomeSemDosagem) {
      nameScore = 1.0;
      confidence = "high";
    }
    // ── Teste 2: primeiro token do nome bate (ex: "dipirona" em ambos)
    else if (
      cat._normName.startsWith(normNomeSemDosagem.split(" ")[0]) ||
      normNomeSemDosagem.startsWith(cat._normName.split(" ")[0])
    ) {
      nameScore = 0.9;
      confidence = "high";
    }
    // ── Teste 3: match por princípio ativo
    else if (normActive && cat._normActive && (
      cat._normActive.includes(normActive.split(" ")[0]) ||
      normActive.includes(cat._normActive.split(" ")[0])
    )) {
      nameScore = 0.85;
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
        nameScore = 0.6 + sharedTokens.length * 0.05;
        confidence = "medium";
      }
      // ── Teste 5: similaridade Levenshtein no primeiro token do nome
      else {
        const firstAiToken = tokNome[0] || normNomeSemDosagem.split(" ")[0];
        const firstCatToken = cat._tokensName[0] || cat._normName.split(" ")[0];
        if (firstAiToken && firstCatToken && firstAiToken.length >= 5) {
          const sim = similarity(firstAiToken, firstCatToken);
          if (sim >= 0.8) {
            nameScore = sim * 0.55;
            confidence = "low";
          }
        }
      }
    }

    if (nameScore === 0) continue;

    // ── Classifica o candidato por dosagem
    if (dosagemPrescrita) {
      const dosagemCat =
        normalizeDosagem(cat.dosage) ||
        extractDosagemFromName(cat._normName);

      if (!dosagemCat) {
        // Catálogo não tem dosagem — aceita mas com menor prioridade
        candidatosDosagemNula.push({ med: cat, confidence, score: nameScore });
      } else if (dosagemCat === dosagemPrescrita) {
        // Dosagem exata → bônus
        candidatosDosagemCerta.push({ med: cat, confidence, score: nameScore + 0.1 });
      } else {
        // Nome bateu mas dosagem errada
        candidatosDosagemErrada.push({ med: cat, confidence, nameScore, dosagemCat: cat.dosage || dosagemCat });
      }
    } else {
      // Sem dosagem prescrita → qualquer candidato de nome serve
      candidatosDosagemCerta.push({ med: cat, confidence, score: nameScore });
    }
  }

  // Ordena cada lista por score decrescente
  const sortByScore = (a, b) => b.score - a.score;

  // Prioridade: dosagem certa > sem dosagem no catálogo > dosagem errada
  console.log(`[Matcher] "${aiMed.nome}" → certa=${candidatosDosagemCerta.map(c=>`${c.med.name}(${c.med.dosage})`)} nula=${candidatosDosagemNula.map(c=>c.med.name)} errada=${candidatosDosagemErrada.map(c=>`${c.med.name}(${c.dosagemCat})`)}`);

  if (candidatosDosagemCerta.length > 0) {
    const best = candidatosDosagemCerta.sort(sortByScore)[0];
    if (best.score >= 0.5) return { match: best, dosagemMismatch: null };
  }

  if (candidatosDosagemNula.length > 0) {
    const best = candidatosDosagemNula.sort(sortByScore)[0];
    if (best.score >= 0.5) return { match: best, dosagemMismatch: null };
  }

  // Nenhum match válido na dosagem certa — informa o mismatch
  if (candidatosDosagemErrada.length > 0) {
    const best = candidatosDosagemErrada.sort((a, b) => b.nameScore - a.nameScore)[0];
    return { match: null, dosagemMismatch: { med: best.med, nameScore: best.nameScore, dosagemCat: best.dosagemCat } };
  }

  return { match: null, dosagemMismatch: null };
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

    const { match, dosagemMismatch } = findBestMatch(aiMed, catalog);

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
        motivo: catalog.length === 0
          ? "catálogo vazio"
          : dosagemMismatch
            ? "dosagem-diferente"
            : "não encontrado no catálogo",
        // Presente só quando motivo = "dosagem-diferente"
        dosagemDisponivel: dosagemMismatch?.dosagemCat ?? null,
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
