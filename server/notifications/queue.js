// ─── Email Queue + Worker ─────────────────────────────────────────────────────
// Fila em memória com processamento assíncrono, retry exponencial e logging.
// Sem dependência de Redis — adequado para MVP e ambientes sem infra extra.
//
// Para produção com volume alto: substituir pela classe BullQueue (comentada
// ao final do arquivo) que usa Redis + Bull.

"use strict";

const templates = require("./templates");

// ─── Configuração ─────────────────────────────────────────────────────────────
const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS  = 1000; // 1s → 2s → 4s (exponencial)

// ─── EmailQueue ───────────────────────────────────────────────────────────────
class EmailQueue {
  /**
   * @param {Function} senderFn  async (to, subject, html) => void
   *   Função responsável pelo envio real (Resend, mock, etc.)
   */
  constructor(senderFn) {
    this._sender     = senderFn;
    this._queue      = [];          // jobs aguardando
    this._processing = false;
    this.stats = { enqueued: 0, sent: 0, failed: 0, retried: 0 };
  }

  // ─── API pública ──────────────────────────────────────────────────────────

  /**
   * Adiciona um evento à fila.
   * @param {"UsuarioCadastrado"|"SenhaAlterada"|"ConsultaAgendada"|"LembreteConsulta"} tipo
   * @param {object} data  Dados do evento (nome, email, etc.)
   * @returns {string}  ID do job gerado
   */
  add(tipo, data) {
    const job = {
      id:          `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tipo,
      data,
      attempts:    0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      createdAt:   new Date().toISOString(),
    };

    this._queue.push(job);
    this.stats.enqueued++;

    console.log(`[Queue] ✚ Enqueued ${job.id} | tipo=${tipo} | dest=${data.email || "?"}`);

    this._scheduleProcess();
    return job.id;
  }

  /** Retorna métricas da fila */
  status() {
    return {
      pending:  this._queue.length,
      ...this.stats,
    };
  }

  // ─── Processamento interno ────────────────────────────────────────────────

  _scheduleProcess() {
    if (!this._processing) {
      setImmediate(() => this._processNext());
    }
  }

  async _processNext() {
    if (this._processing || this._queue.length === 0) return;

    this._processing = true;
    const job = this._queue.shift();

    try {
      await this._runWithRetry(job);
    } catch (err) {
      // Não deve chegar aqui (tratado em _runWithRetry), mas garante robustez
      console.error(`[Worker] Erro inesperado no job ${job.id}:`, err.message);
    } finally {
      this._processing = false;
      if (this._queue.length > 0) {
        // Processa próximo job sem bloquear o event loop
        setImmediate(() => this._processNext());
      }
    }
  }

  async _runWithRetry(job) {
    for (let attempt = 1; attempt <= job.maxAttempts; attempt++) {
      job.attempts = attempt;

      console.log(`[Worker] ▶ ${job.id} (${job.tipo}) — tentativa ${attempt}/${job.maxAttempts}`);

      try {
        // Renderiza template
        const { subject, html } = this._render(job.tipo, job.data);

        // Envia via função injetada
        await this._sender(job.data.email, subject, html);

        this.stats.sent++;
        console.log(`[Worker] ✓ ${job.id} enviado → ${job.data.email}`);
        return; // Sucesso — sai do loop

      } catch (err) {
        console.warn(`[Worker] ✗ ${job.id} tentativa ${attempt} falhou: ${err.message}`);

        if (attempt < job.maxAttempts) {
          this.stats.retried++;
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[Worker] ⏳ Aguardando ${delay}ms antes de retry...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // Todas as tentativas falharam
    this.stats.failed++;
    console.error(`[Worker] ❌ ${job.id} falhou após ${job.maxAttempts} tentativas — tipo=${job.tipo} dest=${job.data.email}`);
  }

  // ─── Renderização de templates ────────────────────────────────────────────

  _render(tipo, data) {
    switch (tipo) {
      case "UsuarioCadastrado":
        return templates.usuarioCadastrado(data);
      case "SenhaAlterada":
        return templates.senhaAlterada(data);
      case "ConsultaAgendada":
        return templates.consultaAgendada(data);
      case "LembreteConsulta":
        return templates.lembreteConsulta(data);
      case "NotificacaoPedido":
        return templates.notificacaoPedido(data);
      default:
        throw new Error(`Tipo de evento desconhecido: ${tipo}`);
    }
  }
}

module.exports = { EmailQueue };

// ─── Nota: BullQueue para produção ───────────────────────────────────────────
// Para escalar com Redis + Bull, instale:
//   npm install bull ioredis
// E substitua o singleton `emailQueue` no dispatcher.js por:
//
// const Bull   = require("bull");
// const queue  = new Bull("email", { redis: { host: "localhost", port: 6379 } });
// queue.process(async (job) => {
//   const { tipo, data } = job.data;
//   const { subject, html } = renderTemplate(tipo, data);
//   await enviarEmail(data.email, subject, html);
// });
