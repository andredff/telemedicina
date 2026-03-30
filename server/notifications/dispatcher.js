// ─── Event Dispatcher ─────────────────────────────────────────────────────────
// Camada de domínio: recebe eventos tipados e os enfileira para envio.
// O dispatcher não sabe como o email é enviado — só conhece os tipos de evento.
//
// Uso:
//   const dispatcher = require("./dispatcher");
//   dispatcher.init(resendApiKey);
//   dispatcher.dispatch("UsuarioCadastrado", { nome: "Ana", email: "ana@..." });

"use strict";

const { EmailQueue } = require("./queue");

// ─── Eventos válidos ──────────────────────────────────────────────────────────
const EVENTOS_VALIDOS = new Set([
  "UsuarioCadastrado",
  "SenhaAlterada",
  "ConsultaAgendada",
  "LembreteConsulta",
  "NotificacaoPedido",
]);

// ─── Validadores de payload ───────────────────────────────────────────────────
const VALIDADORES = {
  UsuarioCadastrado: (d) => {
    if (!d.email) throw new Error("UsuarioCadastrado: campo 'email' obrigatório");
    if (!d.nome)  throw new Error("UsuarioCadastrado: campo 'nome' obrigatório");
  },
  SenhaAlterada: (d) => {
    if (!d.email) throw new Error("SenhaAlterada: campo 'email' obrigatório");
    if (!d.nome)  throw new Error("SenhaAlterada: campo 'nome' obrigatório");
  },
  ConsultaAgendada: (d) => {
    if (!d.email)   throw new Error("ConsultaAgendada: campo 'email' obrigatório");
    if (!d.nome)    throw new Error("ConsultaAgendada: campo 'nome' obrigatório");
    if (!d.dataHora) throw new Error("ConsultaAgendada: campo 'dataHora' obrigatório");
  },
  LembreteConsulta: (d) => {
    if (!d.email)   throw new Error("LembreteConsulta: campo 'email' obrigatório");
    if (!d.nome)    throw new Error("LembreteConsulta: campo 'nome' obrigatório");
    if (!d.dataHora) throw new Error("LembreteConsulta: campo 'dataHora' obrigatório");
  },
  NotificacaoPedido: (d) => {
    if (!d.nome)      throw new Error("NotificacaoPedido: campo 'nome' obrigatório");
    if (!d.pedidoId)  throw new Error("NotificacaoPedido: campo 'pedidoId' obrigatório");
    if (!d.status)    throw new Error("NotificacaoPedido: campo 'status' obrigatório");
    if (!d.email)     throw new Error("NotificacaoPedido: campo 'email' obrigatório");
  },
};

// ─── Singleton da fila ────────────────────────────────────────────────────────
let _queue = null;

/**
 * Inicializa o dispatcher com a chave Resend.
 * Deve ser chamado uma vez na inicialização do servidor.
 * @param {string}  resendApiKey
 * @param {boolean} [mockMode=false]  true = apenas loga, não envia
 */
function init(resendApiKey, mockMode = false) {
  const senderFn = buildSenderFn(resendApiKey, mockMode);
  _queue = new EmailQueue(senderFn);

  const mode = mockMode || !resendApiKey ? "MOCK" : "RESEND";
  console.log(`[Dispatcher] ✓ Inicializado — modo ${mode}`);

  return _queue;
}

/**
 * Despacha um evento de domínio para a fila.
 * @param {"UsuarioCadastrado"|"SenhaAlterada"|"ConsultaAgendada"|"LembreteConsulta"} tipo
 * @param {object} data
 * @returns {string} jobId
 */
function dispatch(tipo, data) {
  if (!_queue) throw new Error("[Dispatcher] Não inicializado. Chame dispatcher.init() primeiro.");
  if (!EVENTOS_VALIDOS.has(tipo)) throw new Error(`[Dispatcher] Evento desconhecido: ${tipo}`);

  // Valida payload
  VALIDADORES[tipo](data);

  // Normaliza e-mail
  if (data.email) data.email = data.email.toLowerCase().trim();

  console.log(`[Dispatcher] 🔔 Evento: ${tipo}`, {
    dest:      data.email,
    timestamp: new Date().toISOString(),
  });

  return _queue.add(tipo, data);
}

/** Retorna estatísticas da fila */
function queueStatus() {
  if (!_queue) return { error: "Dispatcher não inicializado" };
  return _queue.status();
}

/** Retorna a instância da fila (para integração com scheduler) */
function getQueue() {
  return _queue;
}

module.exports = { init, dispatch, queueStatus, getQueue };

// ─── Função de envio (Resend SDK) ─────────────────────────────────────────────
function buildSenderFn(resendApiKey, mockMode) {
  // Modo mock: só loga, não envia
  if (mockMode || !resendApiKey) {
    return async (to, subject, html) => {
      console.log("─".repeat(60));
      console.log(`📧 [EMAIL MOCK]`);
      console.log(`   Para:     ${to}`);
      console.log(`   Assunto:  ${subject}`);
      console.log(`   HTML:     ${html.slice(0, 120).replace(/\n/g, " ")}...`);
      console.log("─".repeat(60));
    };
  }

  // Modo real: envia via Resend REST API
  const RESEND_FROM = process.env.RESEND_FROM || process.env.VITE_RESEND_FROM || "Novità Telemedicina <noreply@novitahomecare.com.br>";

  return async (to, subject, html) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to:   [to],
        subject,
        html,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(`Resend API error ${response.status}: ${JSON.stringify(body)}`);
    }

    console.log(`[Resend] ✓ id=${body.id} → ${to}`);
  };
}
