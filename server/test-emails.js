// Dispara os 5 tipos de email via Resend.
// Uso: node server/test-emails.js [destinatario]
//
// Obs: com o domínio de testes `onboarding@resend.dev`, o Resend só aceita
// o e-mail do dono da conta (novitahealth@gmail.com). Qualquer outro destino
// vai falhar com 403.

"use strict";

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: false });

const dispatcher = require("./notifications/dispatcher");

const DEST = process.argv[2] || "novitahealth@gmail.com";
const RESEND_KEY  = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM
  || process.env.VITE_RESEND_FROM
  || "Novità Telemedicina <onboarding@resend.dev>";

if (!RESEND_KEY) {
  console.error("✗ RESEND_API_KEY não encontrado em .env.local");
  process.exit(1);
}

console.log("═════════════════════════════════════════════════════════");
console.log("  Teste de disparo de emails — Novità Telemedicina");
console.log("═════════════════════════════════════════════════════════");
console.log(`  Destino:       ${DEST}`);
console.log(`  Remetente:     ${RESEND_FROM}`);
console.log(`  Resend key:    ${RESEND_KEY.substring(0, 10)}...`);
console.log("═════════════════════════════════════════════════════════\n");

dispatcher.init(RESEND_KEY, false, RESEND_FROM);

const agora      = new Date();
const daqui30min = new Date(agora.getTime() + 30 * 60 * 1000);
const daqui2h   = new Date(agora.getTime() + 2 * 60 * 60 * 1000);

const formatarDataHora = (d) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

const FIXTURES = [
  {
    tipo: "UsuarioCadastrado",
    data: {
      nome:  "André Tester",
      email: DEST,
    },
  },
  {
    tipo: "SenhaAlterada",
    data: {
      nome:     "André Tester",
      email:    DEST,
      dataHora: formatarDataHora(agora),
    },
  },
  {
    tipo: "ConsultaAgendada",
    data: {
      nome:          "André Tester",
      email:         DEST,
      especialidade: "Clínico Geral",
      profissional:  "Dr. Carlos Silva",
      dataHora:      formatarDataHora(daqui2h),
      consultaId:    "99999",
    },
  },
  {
    tipo: "LembreteConsulta",
    data: {
      nome:          "André Tester",
      email:         DEST,
      especialidade: "Cardiologia",
      profissional:  "Dra. Ana Oliveira",
      dataHora:      formatarDataHora(daqui30min),
      consultaId:    "99998",
    },
  },
  {
    tipo: "NotificacaoPedido",
    data: {
      nome:         "André Tester",
      email:        DEST,
      pedidoId:     "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      status:       "shipped",
      mensagem:     "Seu pedido saiu para entrega e chegará em breve!",
      trackingCode: "BR123456789",
    },
  },
];

for (const { tipo, data } of FIXTURES) {
  try {
    const jobId = dispatcher.dispatch(tipo, data);
    console.log(`✚ Enfileirado ${tipo} — job=${jobId}`);
  } catch (err) {
    console.error(`✗ Erro ao despachar ${tipo}:`, err.message);
  }
}

// Aguarda fila drenar (polling) — timeout de 60s
(async () => {
  const inicio = Date.now();
  while (Date.now() - inicio < 60000) {
    const status = dispatcher.queueStatus();
    if (status.pending === 0 && status.sent + status.failed === FIXTURES.length) {
      console.log("\n═════════════════════════════════════════════════════════");
      console.log("  Resultado final");
      console.log("═════════════════════════════════════════════════════════");
      console.log(`  Enviados:     ${status.sent}`);
      console.log(`  Falharam:     ${status.failed}`);
      console.log(`  Retentativas: ${status.retried}`);
      console.log("═════════════════════════════════════════════════════════");
      process.exit(status.failed > 0 ? 1 : 0);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error("\n✗ Timeout: fila não drenou em 60s");
  console.error("   Status atual:", dispatcher.queueStatus());
  process.exit(2);
})();
