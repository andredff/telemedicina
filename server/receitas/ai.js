/**
 * server/receitas/ai.js
 *
 * Processamento de texto de receita médica com IA.
 *
 * Estratégias em cascata (primeira que funcionar é usada):
 *
 * 1. Groq API  — free tier generoso (llama-3.3-70b / gemma2-9b)
 *               Requer: GROQ_API_KEY no .env.local
 *               Docs: https://console.groq.com/
 *
 * 2. Ollama local — llama3 / mistral rodando localmente (100% gratuito)
 *               Requer: ollama rodando em http://localhost:11434
 *               Instalar: https://ollama.ai
 *
 * 3. OpenRouter free tier — acessa vários modelos gratuitos
 *               Requer: OPENROUTER_API_KEY no .env.local
 *               Docs: https://openrouter.ai (free models disponíveis)
 *
 * 4. Heurístico — parsing por padrões de texto (sem IA, 0 custo)
 *               Sempre disponível como último fallback.
 *
 * Se ANTHROPIC_API_KEY também estiver configurada, usa Claude como opção premium
 * (inserida entre Groq e Ollama na cascata).
 */

"use strict";

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um assistente especializado em interpretar receitas médicas brasileiras.
Analise o texto e extraia todos os medicamentos prescritos.
Para cada medicamento identifique:
- nome: nome do medicamento ou princípio ativo (sem marca/fabricante)
- dosagem: ex: 500mg, 200mg/mL, 10mg (null se não encontrar)
- forma: ex: comprimido, cápsula, solução oral, pomada, suspensão (null se não encontrar)
- quantidade: ex: 1 caixa, 20 comprimidos, uso contínuo (null se não encontrar)
- posologia: ex: 1 comprimido de 8/8h por 7 dias (null se não encontrar)

Regras:
- Ignore CRM, endereço, nome do médico, nome do paciente, instruções gerais
- Não invente dados que não estão no texto
- Se não encontrar algum campo, use null
- Retorne APENAS JSON válido, sem explicações ou markdown

Formato:
{"medicamentos":[{"nome":"","dosagem":null,"forma":null,"quantidade":null,"posologia":null}]}`;

function buildUserMessage(ocrText) {
  return `Extraia os medicamentos desta receita médica.\n\nTexto:\n"""\n${ocrText.slice(0, 4000)}\n"""`;
}

// ─── Parser de resposta IA ────────────────────────────────────────────────────

function parseAiResponse(raw) {
  const cleaned = (raw || "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // Tenta encontrar JSON no texto
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Nenhum JSON encontrado na resposta da IA");

  const parsed = JSON.parse(jsonMatch[0]);
  const meds = parsed.medicamentos ?? parsed.medications ?? parsed ?? [];
  return Array.isArray(meds) ? meds : [];
}

// ─── 1. Groq (free tier) ──────────────────────────────────────────────────────

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",  // melhor qualidade
  "llama3-8b-8192",           // mais rápido
  "gemma2-9b-it",             // alternativo
];

async function extractWithGroq(ocrText) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY não configurada");

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 1024,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserMessage(ocrText) },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq HTTP ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      const meds = parseAiResponse(content);
      console.log(`[AI] Groq (${model}) extraiu ${meds.length} medicamento(s)`);
      return { medicamentos: meds, provider: `groq/${model}` };
    } catch (err) {
      console.warn(`[AI] Groq model ${model} falhou:`, err.message);
    }
  }

  throw new Error("Todos os modelos Groq falharam");
}

// ─── 2. Anthropic Claude (se configurado) ────────────────────────────────────

async function extractWithClaude(ocrText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001", // mais barato/rápido
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(ocrText) }],
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Claude HTTP ${res.status}`);
  const data = await res.json();
  const content = data.content?.[0]?.text ?? "";
  const meds = parseAiResponse(content);
  console.log(`[AI] Claude Haiku extraiu ${meds.length} medicamento(s)`);
  return { medicamentos: meds, provider: "claude-haiku" };
}

// ─── 3. Ollama (local, 100% gratuito) ────────────────────────────────────────

const OLLAMA_MODELS = ["llama3", "llama3.2", "mistral", "phi3", "gemma2"];
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

async function extractWithOllama(ocrText) {
  // Verifica se Ollama está rodando
  let available = false;
  try {
    const ping = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (ping.ok) {
      const tags = await ping.json();
      const installedModels = (tags.models || []).map(m => m.name.split(":")[0]);
      const usableModel = OLLAMA_MODELS.find(m => installedModels.includes(m));
      if (usableModel) {
        available = usableModel;
      }
    }
  } catch {
    // Ollama não está rodando
  }

  if (!available) throw new Error("Ollama não disponível ou nenhum modelo instalado");

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: available,
      stream: false,
      options: { temperature: 0.1 },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserMessage(ocrText) },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  const content = data.message?.content ?? "";
  const meds = parseAiResponse(content);
  console.log(`[AI] Ollama (${available}) extraiu ${meds.length} medicamento(s)`);
  return { medicamentos: meds, provider: `ollama/${available}` };
}

// ─── 4. OpenRouter (free models) ─────────────────────────────────────────────

const OPENROUTER_FREE_MODELS = [
  "meta-llama/llama-3.3-8b-instruct:free",
  "google/gemma-3-12b-it:free",
  "mistralai/mistral-7b-instruct:free",
];

async function extractWithOpenRouter(ocrText) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY não configurada");

  for (const model of OPENROUTER_FREE_MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://novitahomecare.com.br",
          "X-Title": "Novità Telemedicina",
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 1024,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserMessage(ocrText) },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      const meds = parseAiResponse(content);
      console.log(`[AI] OpenRouter (${model}) extraiu ${meds.length} medicamento(s)`);
      return { medicamentos: meds, provider: `openrouter/${model}` };
    } catch (err) {
      console.warn(`[AI] OpenRouter model ${model} falhou:`, err.message);
    }
  }

  throw new Error("Todos os modelos OpenRouter falharam");
}

// ─── 5. Heurístico (fallback sem IA) ─────────────────────────────────────────

/**
 * Padrões comuns em receitas médicas brasileiras.
 * Extrai linhas que parecem prescrições de medicamentos.
 */
const MEDICAMENTO_PATTERNS = [
  // "Dipirona 500mg comprimido"
  /^([A-ZÀ-ÖØ-öø-ÿa-z][a-zà-öø-ÿ]+(?:\s+[a-zà-öø-ÿ]+)*)\s+(\d+(?:[,\.]\d+)?\s*(?:mg|mcg|g|mL|UI|UI\/mL|mg\/mL|%))(?:\s+(comprimido|cápsula|solução|suspensão|pomada|creme|gel|injetável|xarope|gotas|spray|inalação))?/i,
  // "1- Dipirona sódica sol. oral 500mg/mL"
  /\d+[.\-)]\s*([A-ZÀ-ÖØ-öø-ÿ][a-zà-öø-ÿ]+(?:\s+[a-zà-öø-ÿ]+)*)\s+(?:sol\.|solução|comp\.|comprimido|cáps\.|cápsula)?/i,
];

const DOSAGEM_RE = /(\d+(?:[,\.]\d+)?\s*(?:mg|mcg|g|mL|UI|mg\/mL|%))/i;
const FORMA_RE = /\b(comprimido|cápsula|cápsulas|comprimidos|solução\s*oral|suspensão|pomada|creme|gel|injetável|xarope|gotas|spray|inalação|ampola)\b/i;
const QTD_RE = /\b(\d+\s*(?:comprimido|cápsula|ampola|frasco|bisnaga|embalagem|cartela|caixa|blister|sachê|unidade|mL|mg)s?|uso\s+contínuo|conforme\s+prescri[çc][ãa]o)\b/i;

function heuristicExtract(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 3);
  const meds = [];
  const seen = new Set();

  for (const line of lines) {
    // Ignora linhas que são claramente metadados
    if (/^(data|CRM|CRF|CRMV|endereço|fone|tel|e-?mail|assinatura|carimbo|validade|nome|paciente|médico|doctor)/i.test(line)) continue;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line)) continue;

    for (const pattern of MEDICAMENTO_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const nome = (match[1] || "").trim();
        if (nome.length < 4 || seen.has(nome.toLowerCase())) continue;

        const dosMatch = line.match(DOSAGEM_RE);
        const formaMatch = line.match(FORMA_RE);
        const qtdMatch = line.match(QTD_RE);

        seen.add(nome.toLowerCase());
        meds.push({
          nome,
          dosagem: dosMatch ? dosMatch[1] : null,
          forma: formaMatch ? formaMatch[1].toLowerCase() : null,
          quantidade: qtdMatch ? qtdMatch[1] : null,
          posologia: null,
        });
        break;
      }
    }
  }

  console.log(`[AI] Heurístico extraiu ${meds.length} medicamento(s)`);
  return { medicamentos: meds, provider: "heuristic" };
}

// ─── Cascata principal ────────────────────────────────────────────────────────

/**
 * Tenta extrair medicamentos do texto usando a cascata de provedores.
 *
 * @param {string} ocrText texto bruto da receita
 * @returns {Promise<{medicamentos: Array, provider: string, warnings: string[]}>}
 */
async function extractMedications(ocrText) {
  const warnings = [];

  if (!ocrText || ocrText.trim().length < 10) {
    return { medicamentos: [], provider: "none", warnings: ["Texto insuficiente para análise"] };
  }

  // Define cascata baseada nas variáveis de ambiente disponíveis
  const cascade = [];

  if (process.env.GROQ_API_KEY) {
    cascade.push({ name: "Groq", fn: () => extractWithGroq(ocrText) });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    cascade.push({ name: "Claude", fn: () => extractWithClaude(ocrText) });
  }
  // Ollama tentado sempre (verifica disponibilidade internamente)
  cascade.push({ name: "Ollama", fn: () => extractWithOllama(ocrText) });
  if (process.env.OPENROUTER_API_KEY) {
    cascade.push({ name: "OpenRouter", fn: () => extractWithOpenRouter(ocrText) });
  }
  // Heurístico sempre por último
  cascade.push({ name: "Heurístico", fn: () => Promise.resolve(heuristicExtract(ocrText)) });

  for (const { name, fn } of cascade) {
    try {
      console.log(`[AI] Tentando provedor: ${name}...`);
      const result = await fn();
      if (result.medicamentos.length > 0) {
        return { ...result, warnings };
      }
      warnings.push(`${name}: nenhum medicamento encontrado`);
    } catch (err) {
      console.warn(`[AI] Provedor ${name} falhou:`, err.message);
      warnings.push(`${name}: ${err.message}`);
    }
  }

  return { medicamentos: [], provider: "none", warnings };
}

module.exports = { extractMedications };
