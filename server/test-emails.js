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
    },
  },
  {
    tipo: "PagamentoMedicamentoConfirmado",
    data: {
      nome:           "André Tester",
      email:          DEST,
      pedidoId:       "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      paymentId:      "PAY_2026_05_12_abcdef1234567890",
      paymentMethod:  "credit_card",
      installments:   3,
      subtotal:       189.70,
      total:          189.70,
      items: [
        { name: "Losartana 50mg (caixa com 30 comprimidos)", quantity: 2 },
        { name: "Atorvastatina 20mg (caixa com 30 comprimidos)", quantity: 1 },
        { name: "AAS 100mg (caixa com 30 comprimidos)", quantity: 1 },
      ],
      enderecoEntrega: "SQN 408 Bloco D, Apto 305 - Asa Norte, Brasília - DF, 70856-040",
    },
  },
  {
    tipo: "AssinaturaPlanoAtivada",
    data: {
      nome:               "André Tester",
      email:              DEST,
      planoNome:          "Bronze",
      planoTipo:          "bronze",
      billingCycle:       "monthly",
      price:              29.90,
      recurrentPaymentId: "REC_BRONZE_abcdef1234567890",
      features: [
        'Consultas ilimitadas com clínico geral, sem agendamento',
        'Atendimento 24h por dia, 7 dias por semana',
        'Receitas e atestados médicos digitais',
        'Descontos em medicamentos e exames',
        'Programa "Medicamento em Casa"',
      ],
      proximoCobranca: new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR"),
    },
  },
  {
    tipo: "AssinaturaPlanoAtivada",
    data: {
      nome:               "André Tester",
      email:              DEST,
      planoNome:          "Prata",
      planoTipo:          "prata",
      billingCycle:       "monthly",
      price:              49.90,
      recurrentPaymentId: "REC_PRATA_abcdef1234567890",
      features: [
        'Consultas ilimitadas com clínico geral, sem agendamento',
        'Atendimento 24h por dia, 7 dias por semana',
        'Receitas e atestados médicos digitais',
        'Descontos em medicamentos e exames',
        'Programa "Medicamento em Casa"',
        '1 consulta com médico especialista por ano',
      ],
      proximoCobranca: new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR"),
    },
  },
  {
    tipo: "AssinaturaPlanoAtivada",
    data: {
      nome:               "André Tester",
      email:              DEST,
      planoNome:          "Ouro",
      planoTipo:          "ouro",
      billingCycle:       "yearly",
      price:              754.92,
      monthlyEquivalent:  62.91,
      recurrentPaymentId: "REC_OURO_abcdef1234567890",
      features: [
        'Consultas ilimitadas com clínico geral, sem agendamento',
        'Atendimento 24h por dia, 7 dias por semana',
        'Receitas e atestados médicos digitais',
        'Descontos em medicamentos e exames',
        'Programa "Medicamento em Casa"',
        '1 consulta com médico especialista por ano',
        '1 check-up anual (mulher, homem ou criança)',
      ],
      proximoCobranca: new Date(agora.getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR"),
    },
  },
  {
    tipo: "AssinaturaPlanoAtivada",
    data: {
      nome:               "André Tester",
      email:              DEST,
      planoNome:          "Diamante",
      planoTipo:          "diamante",
      billingCycle:       "yearly",
      price:              970.92,
      monthlyEquivalent:  80.91,
      recurrentPaymentId: "REC_DIAMANTE_abcdef1234567890",
      features: [
        'Consultas ilimitadas com clínico geral, sem agendamento',
        'Atendimento 24h por dia, 7 dias por semana',
        'Receitas e atestados médicos digitais',
        'Descontos em medicamentos e exames',
        'Programa "Medicamento em Casa"',
        '2 consultas com médico especialista por ano',
        '1 check-up anual (mulher, homem ou criança)',
      ],
      proximoCobranca: new Date(agora.getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR"),
    },
  },
  {
    tipo: "AssinaturaPlanoAtivada",
    data: {
      nome:               "André Tester",
      email:              DEST,
      planoNome:          "Coletivo Ouro",
      planoTipo:          "ouro-coletivo",
      billingCycle:       "monthly",
      price:              199.90,
      recurrentPaymentId: "REC_COLETIVO_abcdef1234567890",
      features: [
        'Todos os benefícios do plano Ouro para o titular',
        'Até 4 dependentes incluídos',
        'Atendimento 24h por dia para toda a família',
        '1 check-up anual por dependente',
      ],
      proximoCobranca: new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR"),
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
  while (Date.now() - inicio < 120000) {
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
  console.error("\n✗ Timeout: fila não drenou em 120s");
  console.error("   Status atual:", dispatcher.queueStatus());
  process.exit(2);
})();
