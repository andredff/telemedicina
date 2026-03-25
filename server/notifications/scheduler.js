// ─── Consultation Reminder Scheduler ─────────────────────────────────────────
// Executa a cada 5 minutos e verifica consultas agendadas.
// Quando uma consulta está a ≤30min e >25min do horário, dispara LembreteConsulta.
//
// Pré-requisito: tabela `consultation_reminders` no Supabase (ver migration).
// Uso:
//   const { startScheduler } = require("./scheduler");
//   startScheduler(supabaseClient, dispatcher);

"use strict";

const POLLING_INTERVAL_MS = 5 * 60 * 1000; // a cada 5 minutos
const REMINDER_WINDOW_MIN = { min: 25, max: 30 }; // janela de disparo

let _intervalId = null;
let _running    = false;

/**
 * Inicia o scheduler de lembretes.
 * @param {object} supabase    Cliente Supabase com service role
 * @param {object} dispatcher  Instância do dispatcher
 */
function startScheduler(supabase, dispatcher) {
  if (_intervalId) {
    console.log("[Scheduler] ⚠️  Já está rodando — ignorando startScheduler()");
    return;
  }

  console.log(`[Scheduler] ✓ Iniciado — verificando lembretes a cada ${POLLING_INTERVAL_MS / 60000} min`);

  // Executa imediatamente e depois a cada intervalo
  checkReminders(supabase, dispatcher);
  _intervalId = setInterval(() => checkReminders(supabase, dispatcher), POLLING_INTERVAL_MS);

  // Limpeza ao encerrar o processo
  process.on("SIGTERM", stopScheduler);
  process.on("SIGINT",  stopScheduler);
}

function stopScheduler() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
    console.log("[Scheduler] Parado.");
  }
}

// ─── Verificação de lembretes ─────────────────────────────────────────────────
async function checkReminders(supabase, dispatcher) {
  if (_running) {
    console.log("[Scheduler] ⚠️  Verificação anterior ainda em andamento — pulando");
    return;
  }

  _running = true;

  try {
    const agora     = new Date();
    const em25min   = new Date(agora.getTime() + REMINDER_WINDOW_MIN.min * 60 * 1000);
    const em30min   = new Date(agora.getTime() + REMINDER_WINDOW_MIN.max * 60 * 1000);

    // Busca consultas dentro da janela que ainda não receberam lembrete
    const { data: consultas, error } = await supabase
      .from("consultation_reminders")
      .select("*")
      .eq("reminder_sent", false)
      .gte("scheduled_at", em25min.toISOString())
      .lte("scheduled_at", em30min.toISOString());

    if (error) {
      console.error("[Scheduler] Erro ao buscar consultas:", error.message);
      return;
    }

    if (!consultas || consultas.length === 0) {
      console.log(`[Scheduler] ✓ Verificação concluída — nenhum lembrete pendente`);
      return;
    }

    console.log(`[Scheduler] 📅 ${consultas.length} lembrete(s) a disparar`);

    await Promise.allSettled(
      consultas.map(async (c) => {
        try {
          // Dispara o evento de lembrete
          dispatcher.dispatch("LembreteConsulta", {
            email:       c.user_email,
            nome:        c.user_name,
            especialidade: c.especialidade,
            profissional: c.profissional,
            dataHora:    formatarDataHora(c.scheduled_at),
            consultaId:  c.consultation_id,
          });

          // Marca como enviado para não disparar novamente
          await supabase
            .from("consultation_reminders")
            .update({ reminder_sent: true, reminded_at: new Date().toISOString() })
            .eq("id", c.id);

          console.log(`[Scheduler] ✓ Lembrete despachado — consulta #${c.consultation_id} → ${c.user_email}`);
        } catch (err) {
          console.error(`[Scheduler] ✗ Falha ao processar consulta #${c.consultation_id}: ${err.message}`);
        }
      })
    );

  } catch (err) {
    console.error("[Scheduler] Erro inesperado:", err.message);
  } finally {
    _running = false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatarDataHora(isoString) {
  try {
    return new Date(isoString).toLocaleString("pt-BR", {
      timeZone:    "America/Sao_Paulo",
      day:         "2-digit",
      month:       "2-digit",
      year:        "numeric",
      hour:        "2-digit",
      minute:      "2-digit",
    });
  } catch {
    return isoString;
  }
}

module.exports = { startScheduler, stopScheduler };
