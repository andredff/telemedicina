// Dispara os 5 tipos de email via Mailpit (SMTP mock).
// Uso: node server/test-emails-mailpit.js
// Não requer RESEND_API_KEY — usa SMTP local (Mailpit ou similar)

"use strict";

const dispatcher = require("./notifications/dispatcher");

const DEST = process.argv[2] || "test@example.com";
const FROM = "Novità Telemedicina <onboarding@resend.dev>";

(async () => {
  console.log("═════════════════════════════════════════════════════════");
  console.log("  Teste de disparo via Mailpit — Novità Telemedicina");
  console.log("═════════════════════════════════════════════════════════");
  console.log(`  Destino: ${DEST}`);
  console.log("  Modo: MOCK (Mailpit SMTP local)");
  console.log("═════════════════════════════════════════════════════════\n");

  // Inicializa em modo MOCK (sem RESEND_API_KEY)
  dispatcher.init(null, true, FROM);

  const agora = new Date();
  const daqui30min = new Date(agora.getTime() + 30 * 60 * 1000);
  const daqui2h = new Date(agora.getTime() + 2 * 60 * 60 * 1000);

  const formatarDataHora = (d) =>
    d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const FIXTURES = [
    {
      tipo: "UsuarioCadastrado",
      data: { nome: "André Tester", email: DEST },
    },
    {
      tipo: "SenhaAlterada",
      data: {
        nome: "André Tester",
        email: DEST,
        dataHora: formatarDataHora(agora),
      },
    },
    {
      tipo: "ConsultaAgendada",
      data: {
        nome: "André Tester",
        email: DEST,
        especialidade: "Clínico Geral",
        profissional: "Dr. Carlos Silva",
        dataHora: formatarDataHora(daqui2h),
        consultaId: "99999",
      },
    },
    {
      tipo: "LembreteConsulta",
      data: {
        nome: "André Tester",
        email: DEST,
        especialidade: "Cardiologia",
        profissional: "Dra. Ana Oliveira",
        dataHora: formatarDataHora(daqui30min),
        consultaId: "99998",
      },
    },
    {
      tipo: "NotificacaoPedido",
      data: {
        nome: "André Tester",
        email: DEST,
        pedidoId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        status: "shipped",
        mensagem: "Seu pedido saiu para entrega e chegará em breve!",
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

  // Aguarda fila drenar
  const timeout = Date.now() + 60000;
  while (Date.now() < timeout) {
    const status = dispatcher.queueStatus();
    const total = FIXTURES.length;
    if (status.pending === 0 && status.sent + status.failed === total) {
      console.log("\n═════════════════════════════════════════════════════════");
      console.log("  Resultado final");
      console.log("═════════════════════════════════════════════════════════");
      console.log(`  Enviados:     ${status.sent}`);
      console.log(`  Falharam:     ${status.failed}`);
      console.log("═════════════════════════════════════════════════════════");
      process.exit(status.failed > 0 ? 1 : 0);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error("\n✗ Timeout: fila não drenou em 60s");
  process.exit(2);
})();