// ─── Email Templates — Novità Telemedicina ───────────────────────────────────
// Templates HTML responsivos para cada tipo de evento de notificação.

const BRAND = {
  primary:    "#2563EB", // azul Novità
  accent:     "#10B981", // verde saúde
  danger:     "#EF4444",
  warning:    "#F59E0B",
  background: "#F1F5F9",
  white:      "#FFFFFF",
  text:       "#1E293B",
  muted:      "#64748B",
  border:     "#E2E8F0",
};

// ─── Layout base ─────────────────────────────────────────────────────────────
function base({ preheader = "", headerIcon = "💙", headerColor = BRAND.primary, body }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:${BRAND.background};font-family:Inter,Arial,sans-serif;color:${BRAND.text};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:600px;width:100%;background:${BRAND.white};border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:${headerColor};padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:800;color:${BRAND.white};letter-spacing:-0.5px;">Novità</span>
                    <span style="font-size:12px;color:rgba(255,255,255,0.65);margin-left:6px;font-weight:400;">Telemedicina</span>
                  </td>
                  <td align="right" style="font-size:28px;">${headerIcon}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;border-top:1px solid ${BRAND.border};padding:18px 32px;">
              <p style="margin:0;font-size:12px;color:${BRAND.muted};text-align:center;line-height:1.6;">
                Novità Telemedicina &nbsp;·&nbsp;
                <a href="mailto:suporte@novita.com.br" style="color:${BRAND.primary};text-decoration:none;">suporte@novita.com.br</a><br>
                <span style="font-size:11px;opacity:0.7;">E-mail automático — não responda diretamente a esta mensagem.</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Componentes reutilizáveis ────────────────────────────────────────────────
function badge(text, color = BRAND.accent) {
  return `<span style="display:inline-block;background:${color}20;color:${color};font-size:11px;font-weight:700;letter-spacing:0.5px;padding:4px 10px;border-radius:20px;text-transform:uppercase;">${text}</span>`;
}

function cta(text, url, color = BRAND.primary) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 8px;">
      <tr>
        <td align="center">
          <a href="${url}" style="display:inline-block;background:${color};color:${BRAND.white};font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">${text}</a>
        </td>
      </tr>
    </table>`;
}

function infoCard(rows) {
  const items = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid ${BRAND.border};">
        <span style="font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.4px;">${label}</span>
        <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:${BRAND.text};">${value}</p>
      </td>
    </tr>`).join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;margin:20px 0;">
      ${items}
    </table>`;
}

function alertBox(text, color = BRAND.warning) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${color}15;border-left:4px solid ${color};border-radius:0 8px 8px 0;margin:16px 0;">
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:${BRAND.text};line-height:1.5;">
          ${text}
        </td>
      </tr>
    </table>`;
}

// ─── Template: UsuarioCadastrado ──────────────────────────────────────────────
function usuarioCadastrado({ nome, email }) {
  const body = `
    ${badge("Bem-vindo!", BRAND.accent)}
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:800;color:${BRAND.text};">
      Olá, ${nome}! 👋
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.muted};line-height:1.6;">
      Sua conta na <strong>Novità Telemedicina</strong> foi criada com sucesso.
      Você já pode acessar teleconsultas, receituários e muito mais — tudo de onde estiver.
    </p>

    ${infoCard([
      ["E-mail cadastrado", email],
      ["Próximo passo",     "Acesse o dashboard e complete seu perfil"],
    ])}

    ${alertBox("💡 Dica: Complete seu perfil com CPF e data de nascimento para habilitar todas as funcionalidades.")}

    ${cta("Acessar minha conta →", "https://novita.migrai.com.br/dashboard")}

    <p style="font-size:12px;color:${BRAND.muted};text-align:center;margin-top:20px;">
      Se você não criou esta conta, ignore este e-mail ou
      <a href="mailto:suporte@novita.com.br" style="color:${BRAND.primary};">entre em contato</a>.
    </p>`;

  return {
    subject: "Bem-vindo à Novità Telemedicina 💙",
    html: base({ preheader: `${nome}, sua conta está pronta!`, headerIcon: "🎉", body }),
  };
}

// ─── Template: SenhaAlterada ──────────────────────────────────────────────────
function senhaAlterada({ nome, email, dataHora }) {
  const body = `
    ${badge("Segurança", BRAND.warning)}
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:800;color:${BRAND.text};">
      Senha alterada com sucesso 🔐
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.muted};line-height:1.6;">
      Olá, <strong>${nome}</strong>. A senha da sua conta foi alterada recentemente.
    </p>

    ${infoCard([
      ["Conta",    email],
      ["Data/hora", dataHora || new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
      ["Ação",     "Alteração de senha"],
    ])}

    ${alertBox(`⚠️ <strong>Não foi você?</strong> Se não solicitou esta alteração, entre em contato imediatamente com
      <a href="mailto:suporte@novita.com.br" style="color:${BRAND.warning};font-weight:700;">suporte@novita.com.br</a>
      ou redefina sua senha agora.`, BRAND.danger)}

    ${cta("Redefinir minha senha →", "https://novita.migrai.com.br/auth?reset=true", BRAND.danger)}`;

  return {
    subject: "Sua senha foi alterada — Novità",
    html: base({ preheader: "Alteração de senha detectada na sua conta.", headerIcon: "🔐", headerColor: BRAND.warning, body }),
  };
}

// ─── Template: ConsultaAgendada ───────────────────────────────────────────────
function consultaAgendada({ nome, especialidade, profissional, dataHora, consultaId }) {
  const body = `
    ${badge("Consulta confirmada", BRAND.accent)}
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:800;color:${BRAND.text};">
      Consulta agendada! 🩺
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.muted};line-height:1.6;">
      Olá, <strong>${nome}</strong>. Sua consulta foi confirmada. Veja os detalhes abaixo.
    </p>

    ${infoCard([
      ["Especialidade",  especialidade || "Clínico Geral"],
      ["Profissional",   profissional  || "A definir"],
      ["Data e hora",    dataHora],
      ["Número",         `#${consultaId || "—"}`],
    ])}

    ${alertBox(`📱 <strong>Lembrete automático:</strong> Você receberá um aviso 30 minutos antes da consulta.
      Fique atento ao e-mail e esteja disponível no horário agendado.`)}

    ${cta("Ver minha consulta →", "https://novita.migrai.com.br/teleconsultas")}

    <p style="font-size:13px;color:${BRAND.muted};margin-top:16px;line-height:1.6;">
      Precisa remarcar? Acesse o painel ou fale com nosso suporte com pelo menos 2 horas de antecedência.
    </p>`;

  return {
    subject: `Consulta confirmada — ${especialidade || "Telemedicina"} 🩺`,
    html: base({ preheader: `Sua consulta está marcada para ${dataHora}.`, headerIcon: "🩺", headerColor: BRAND.accent, body }),
  };
}

// ─── Template: LembreteConsulta ───────────────────────────────────────────────
function lembreteConsulta({ nome, especialidade, profissional, dataHora, consultaId }) {
  const body = `
    ${badge("Faltam 30 minutos", BRAND.primary)}
    <h1 style="margin:16px 0 8px;font-size:24px;font-weight:800;color:${BRAND.text};">
      Sua consulta começa em breve ⏰
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.muted};line-height:1.6;">
      Olá, <strong>${nome}</strong>! Este é um lembrete: sua teleconsulta começa em
      <strong>aproximadamente 30 minutos</strong>.
    </p>

    ${infoCard([
      ["Especialidade", especialidade || "Clínico Geral"],
      ["Profissional",  profissional  || "A definir"],
      ["Horário",       dataHora],
      ["Consulta",      `#${consultaId || "—"}`],
    ])}

    ${alertBox(`✅ <strong>Antes de entrar, verifique:</strong><br>
      • Câmera e microfone funcionando<br>
      • Conexão estável com a internet<br>
      • Ambiente tranquilo e bem iluminado<br>
      • Documentos e sintomas em mãos`)}

    ${cta("Entrar na sala de espera →", "https://novita.migrai.com.br/teleconsultas")}

    <p style="font-size:13px;color:${BRAND.muted};margin-top:16px;text-align:center;">
      Cuide-se. Estamos aqui por você. 💙
    </p>`;

  return {
    subject: `⏰ Sua consulta começa em 30 minutos — Novità`,
    html: base({ preheader: `Lembrete: consulta de ${especialidade} em 30 minutos.`, headerIcon: "⏰", body }),
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  usuarioCadastrado,
  senhaAlterada,
  consultaAgendada,
  lembreteConsulta,
};
