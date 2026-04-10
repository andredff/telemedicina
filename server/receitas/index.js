/**
 * server/receitas/index.js
 *
 * Router Express para o serviço de análise de receitas médicas.
 *
 * Endpoints:
 *
 * POST /api/receitas/analisar
 *   Fluxo completo: arquivo → OCR → IA → matching com catálogo
 *   Body: multipart/form-data com campo "file" (PDF ou imagem)
 *   Response: { extraidos, encontrados, naoEncontrados, ocr, ia, timing }
 *
 * POST /api/receitas/analisar-texto
 *   Fluxo sem OCR: texto já extraído → IA → matching
 *   Body: JSON { texto: string }
 *   Response: mesma estrutura acima
 *
 * GET /api/receitas/status
 *   Health check: lista provedores de IA configurados e disponíveis
 */

"use strict";

const express = require("express");
const multer  = require("multer");

const { extractText }        = require("./ocr");
const { extractMedications } = require("./ai");
const { matchMedications }   = require("./matcher");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter(_req, file, cb) {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/tiff"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato inválido. Envie PDF ou imagem (PNG, JPG, WEBP, TIFF)."));
    }
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now() { return Date.now(); }

// ─── POST /api/receitas/analisar ─────────────────────────────────────────────

router.post("/analisar", upload.single("file"), async (req, res) => {
  const t0 = now();

  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado. Use o campo 'file' em multipart/form-data." });
    }

    // Supabase injetado pelo servidor pai
    const supabase = req.app.locals.supabase ?? null;

    console.log(`[Receitas] Analisando: ${file.originalname} (${file.mimetype}, ${Math.round(file.size / 1024)}KB)`);

    // ── Etapa 1: OCR ──────────────────────────────────────────────────────
    const t1 = now();
    const ocrResult = await extractText(file.buffer, file.mimetype);
    const ocrMs = now() - t1;

    if (!ocrResult.text || ocrResult.text.trim().length < 10) {
      return res.status(422).json({
        error: "Não foi possível extrair texto do arquivo.",
        detalhe: "O PDF pode estar protegido ou a imagem pode estar ilegível.",
        ocr: { method: ocrResult.method, textLength: ocrResult.text?.length ?? 0 },
      });
    }

    console.log(`[Receitas] OCR (${ocrResult.method}): ${ocrResult.text.length} chars em ${ocrMs}ms`);

    // ── Etapa 2: IA ───────────────────────────────────────────────────────
    const t2 = now();
    const aiResult = await extractMedications(ocrResult.text);
    const aiMs = now() - t2;

    console.log(`[Receitas] IA (${aiResult.provider}): ${aiResult.medicamentos.length} medicamento(s) em ${aiMs}ms`);

    // ── Etapa 3: Matching ─────────────────────────────────────────────────
    const t3 = now();
    const { encontrados, naoEncontrados } = await matchMedications(aiResult.medicamentos, supabase);
    const matchMs = now() - t3;

    console.log(`[Receitas] Match: ${encontrados.length} encontrado(s), ${naoEncontrados.length} não encontrado(s) em ${matchMs}ms`);

    return res.json({
      extraidos:       aiResult.medicamentos,
      encontrados,
      naoEncontrados,
      ocr: {
        method:     ocrResult.method,
        pages:      ocrResult.pages,
        confidence: ocrResult.confidence,
        textLength: ocrResult.text.length,
      },
      ia: {
        provider: aiResult.provider,
        warnings: aiResult.warnings ?? [],
      },
      timing: {
        ocrMs,
        aiMs,
        matchMs,
        totalMs: now() - t0,
      },
    });
  } catch (err) {
    console.error("[Receitas] Erro interno:", err);
    return res.status(500).json({ error: "Erro interno ao processar a receita.", detalhe: err.message });
  }
});

// ─── POST /api/receitas/analisar-texto ───────────────────────────────────────

router.post("/analisar-texto", express.json(), async (req, res) => {
  const t0 = now();

  try {
    const { texto } = req.body;
    if (!texto || typeof texto !== "string" || texto.trim().length < 10) {
      return res.status(400).json({ error: "Campo 'texto' obrigatório e deve ter pelo menos 10 caracteres." });
    }

    const supabase = req.app.locals.supabase ?? null;

    // ── IA ────────────────────────────────────────────────────────────────
    const t1 = now();
    const aiResult = await extractMedications(texto);
    const aiMs = now() - t1;

    // ── Matching ──────────────────────────────────────────────────────────
    const t2 = now();
    const { encontrados, naoEncontrados } = await matchMedications(aiResult.medicamentos, supabase);
    const matchMs = now() - t2;

    return res.json({
      extraidos:     aiResult.medicamentos,
      encontrados,
      naoEncontrados,
      ocr:           { method: "text-input", pages: 1, confidence: 100, textLength: texto.length },
      ia:            { provider: aiResult.provider, warnings: aiResult.warnings ?? [] },
      timing:        { ocrMs: 0, aiMs, matchMs, totalMs: now() - t0 },
    });
  } catch (err) {
    console.error("[Receitas/texto] Erro:", err);
    return res.status(500).json({ error: "Erro ao processar texto.", detalhe: err.message });
  }
});

// ─── GET /api/receitas/status ─────────────────────────────────────────────────

router.get("/status", async (req, res) => {
  const provedores = [];

  if (process.env.GROQ_API_KEY) {
    provedores.push({ nome: "Groq (free tier)", configurado: true, prioridade: 1 });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    provedores.push({ nome: "Claude (Anthropic)", configurado: true, prioridade: 2 });
  }

  // Verifica Ollama
  try {
    const r = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const t = await r.json();
      const modelos = (t.models || []).map(m => m.name);
      provedores.push({ nome: "Ollama (local)", configurado: true, prioridade: 3, modelos });
    }
  } catch {
    provedores.push({ nome: "Ollama (local)", configurado: false, prioridade: 3, motivo: "não rodando" });
  }

  if (process.env.OPENROUTER_API_KEY) {
    provedores.push({ nome: "OpenRouter (free tier)", configurado: true, prioridade: 4 });
  }

  provedores.push({ nome: "Heurístico (fallback)", configurado: true, prioridade: 99 });

  const ativos = provedores.filter(p => p.configurado);

  res.json({
    status: ativos.length > 0 ? "ok" : "degraded",
    provedoresAtivos: ativos.length,
    provedores,
    ocr: {
      tesseract: true,
      pdfNativo: true,
    },
  });
});

module.exports = router;
