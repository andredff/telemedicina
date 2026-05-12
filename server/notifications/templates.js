// ─── Email Templates — Novità health Group ───────────────────────────────────
// Templates HTML responsivos, compatíveis com Gmail, Outlook, Apple Mail.
// Layout baseado em tabelas com CSS inline.

const BRAND = {
  primary:    "#EDAF00", // dourado Novità (identidade visual principal)
  primaryDark:"#CC9B00", // dourado escuro (hover / gradientes)
  accent:     "#10B981", // verde saúde (sucesso, confirmações)
  danger:     "#EF4444", // vermelho (alertas críticos)
  warning:    "#F59E0B", // âmbar (avisos)
  info:       "#3B82F6", // azul (informativo)
  background: "#F5F3EE", // bege claro (fundo do email)
  white:      "#FFFFFF",
  text:       "#1E293B", // quase preto (texto principal)
  muted:      "#64748B", // cinza (texto secundário)
  border:     "#E8E4DA", // bege médio (bordas)
  cardBg:     "#FAFAF7", // off-white (fundo de cards internos)
};

const LOGO_URL = "https://novita.migrai.com.br/novita_logo.png";
const SITE_URL = "https://novita.migrai.com.br";

// ─── Layout base ─────────────────────────────────────────────────────────────
// Estrutura reutilizável: Header (logo) → Body → Footer
function base({ preheader = "", body, footerExtra = "" }) {
  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Novità health Group</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    /* Mobile */
    @media only screen and (max-width:620px) {
      .email-container { width:100% !important; max-width:100% !important; }
      .email-body { padding:24px 16px !important; }
      .email-header { padding:20px 16px !important; }
      .email-footer { padding:16px !important; }
      .cta-btn { padding:14px 24px !important; font-size:15px !important; }
      h1 { font-size:22px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.background};font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${BRAND.text};-webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BRAND.background};">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${BRAND.background};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Email container -->
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:600px;width:100%;background:${BRAND.white};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- ═══ HEADER ═══ -->
          <tr>
            <td class="email-header" style="padding:28px 32px;background:${BRAND.white};text-align:center;border-bottom:1px solid ${BRAND.border};">
              <a href="${SITE_URL}" style="text-decoration:none;display:inline-block;">
                <img src="${LOGO_URL}" alt="Novità Health Group" width="240" height="auto" style="display:block;border:0;outline:none;" />
              </a>
            </td>
          </tr>

          <!-- ═══ BODY ═══ -->
          <tr>
            <td class="email-body" style="padding:36px 32px 28px;">
              ${body}
            </td>
          </tr>

          <!-- ═══ FOOTER ═══ -->
          <tr>
            <td class="email-footer" style="background:${BRAND.cardBg};border-top:1px solid ${BRAND.border};padding:24px 32px;">
              ${footerExtra ? `<div style="margin-bottom:16px;">${footerExtra}</div>` : ""}
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 8px;font-size:13px;color:${BRAND.muted};line-height:1.6;">
                      <a href="${SITE_URL}" style="color:${BRAND.primary};font-weight:600;text-decoration:none;">novita.migrai.com.br</a>
                    </p>
                    <p style="margin:0 0 8px;font-size:12px;color:${BRAND.muted};line-height:1.5;">
                      Precisa de ajuda? &nbsp;
                      <a href="mailto:suporte@novita.com" style="color:${BRAND.primary};text-decoration:none;font-weight:500;">suporte@novita.com</a>
                    </p>
                    <p style="margin:0;font-size:11px;color:#94A3B8;line-height:1.5;">
                      Este e-mail foi enviado automaticamente pela Novità health Group.<br>
                      Por favor, não responda diretamente a esta mensagem.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>
  <!-- /Outer wrapper -->
</body>
</html>`;
}

// ─── Componentes reutilizáveis ────────────────────────────────────────────────

function badge(text, color = BRAND.accent) {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:12px;">
    <tr>
      <td style="background:${color}18;color:${color};font-size:11px;font-weight:700;letter-spacing:0.6px;padding:5px 14px;border-radius:20px;text-transform:uppercase;border:1px solid ${color}30;">${text}</td>
    </tr>
  </table>`;
}

function heading(text) {
  return `<h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:${BRAND.text};line-height:1.3;font-family:'Segoe UI',Roboto,Arial,sans-serif;">${text}</h1>`;
}

function paragraph(text) {
  return `<p style="margin:0 0 20px;font-size:15px;color:${BRAND.muted};line-height:1.7;">${text}</p>`;
}

function cta(text, url, color = BRAND.primary) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 12px;">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" fillcolor="${color}">
            <w:anchorlock/>
            <center style="color:${BRAND.white};font-family:'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:bold;">${text}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${url}" class="cta-btn" style="display:inline-block;background:${color};color:${BRAND.white};font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;text-align:center;min-width:200px;box-shadow:0 2px 8px ${color}40;">${text}</a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

function ctaSecondary(text, url) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:8px 0;">
      <tr>
        <td align="center">
          <a href="${url}" style="display:inline-block;color:${BRAND.primary};font-size:13px;font-weight:600;text-decoration:underline;">${text}</a>
        </td>
      </tr>
    </table>`;
}

function infoCard(rows) {
  const items = rows.map(([label, value], i) => `
    <tr>
      <td style="padding:12px 16px;${i < rows.length - 1 ? `border-bottom:1px solid ${BRAND.border};` : ""}">
        <span style="font-size:11px;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.4px;font-weight:500;">${label}</span>
        <p style="margin:3px 0 0;font-size:15px;font-weight:600;color:${BRAND.text};">${value}</p>
      </td>
    </tr>`).join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:10px;overflow:hidden;margin:20px 0;">
      ${items}
    </table>`;
}

function alertBox(text, color = BRAND.warning) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${color}10;border-left:4px solid ${color};border-radius:0 10px 10px 0;margin:20px 0;">
      <tr>
        <td style="padding:14px 18px;font-size:13px;color:${BRAND.text};line-height:1.6;">
          ${text}
        </td>
      </tr>
    </table>`;
}

function divider() {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0;">
    <tr><td style="border-top:1px solid ${BRAND.border};"></td></tr>
  </table>`;
}

function securityNote(text) {
  return `<p style="font-size:12px;color:${BRAND.muted};text-align:center;margin-top:24px;line-height:1.5;">${text}</p>`;
}

// ─── Template: UsuarioCadastrado (Confirmação de Cadastro) ───────────────────
function usuarioCadastrado({ nome, email }) {
  const body = `
    ${badge("Bem-vindo!", BRAND.accent)}
    ${heading(`Olá, ${nome}! 👋`)}
    ${paragraph(`Sua conta na <strong style="color:${BRAND.text};">Novità health Group</strong> foi criada com sucesso.
      Você já pode acessar teleconsultas, receituários digitais e comprar medicamentos — tudo de onde estiver.`)}

    ${infoCard([
      ["E-mail cadastrado", email],
      ["Próximo passo", "Acesse o dashboard e complete seu perfil"],
    ])}

    ${alertBox(`<strong>Dica:</strong> Complete seu perfil com CPF e data de nascimento para habilitar todas as funcionalidades.`)}

    ${cta("Acessar minha conta", `${SITE_URL}/dashboard`, BRAND.accent)}

    ${securityNote(`Se você não criou esta conta, ignore este e-mail ou
      <a href="mailto:suporte@novita.com" style="color:${BRAND.primary};font-weight:500;">entre em contato</a>.`)}`;

  return {
    subject: "Bem-vindo à Novità health Group! 💛",
    html: base({ preheader: `${nome}, sua conta está pronta!`, body }),
  };
}

// ─── Template: SenhaAlterada (Password Changed) ─────────────────────────────
function senhaAlterada({ nome, email, dataHora }) {
  const body = `
    ${badge("Alerta de segurança", BRAND.warning)}
    ${heading("Senha alterada com sucesso 🔐")}
    ${paragraph(`Olá, <strong style="color:${BRAND.text};">${nome}</strong>. A senha da sua conta foi alterada recentemente.`)}

    ${infoCard([
      ["Conta", email],
      ["Data/hora", dataHora || new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
      ["Ação", "Alteração de senha"],
    ])}

    ${alertBox(`<strong>Não foi você?</strong> Se você não solicitou esta alteração, redefina sua senha imediatamente e entre em contato com
      <a href="mailto:suporte@novita.com" style="color:${BRAND.danger};font-weight:600;">suporte@novita.com</a>.`, BRAND.danger)}

    ${cta("Redefinir minha senha", `${SITE_URL}/auth?tab=forgot`, BRAND.danger)}

    ${securityNote("Este é um alerta automático de segurança. Se foi você quem alterou a senha, nenhuma ação é necessária.")}`;

  return {
    subject: "Sua senha foi alterada — Novità",
    html: base({ preheader: "Alteração de senha detectada na sua conta.", body }),
  };
}

// ─── Template: ConsultaAgendada ───────────────────────────────────────────────
function consultaAgendada({ nome, especialidade, profissional, dataHora, consultaId }) {
  const body = `
    ${badge("Consulta confirmada", BRAND.accent)}
    ${heading("Sua consulta está marcada! 🩺")}
    ${paragraph(`Olá, <strong style="color:${BRAND.text};">${nome}</strong>. Sua teleconsulta foi confirmada com sucesso. Confira os detalhes abaixo.`)}

    ${infoCard([
      ["Especialidade", especialidade || "Clínico Geral"],
      ["Profissional", profissional || "A definir"],
      ["Data e hora", dataHora],
      ["Número da consulta", `#${consultaId || "—"}`],
    ])}

    ${alertBox(`<strong>Lembrete automático:</strong> Você receberá um aviso 30 minutos antes da consulta. Fique atento ao e-mail e esteja disponível no horário agendado.`)}

    ${cta("Ver minha consulta", `${SITE_URL}/teleconsultas`, BRAND.accent)}

    ${securityNote(`Precisa remarcar? Acesse o painel ou fale com nosso suporte com pelo menos 2 horas de antecedência.`)}`;

  return {
    subject: `Consulta confirmada — ${especialidade || "Telemedicina"} 🩺`,
    html: base({ preheader: `Sua consulta está marcada para ${dataHora}.`, body }),
  };
}

// ─── Template: LembreteConsulta ───────────────────────────────────────────────
function lembreteConsulta({ nome, especialidade, profissional, dataHora, consultaId }) {
  const body = `
    ${badge("Faltam 30 minutos", BRAND.primary)}
    ${heading("Sua consulta começa em breve ⏰")}
    ${paragraph(`Olá, <strong style="color:${BRAND.text};">${nome}</strong>! Este é um lembrete: sua teleconsulta começa em
      <strong style="color:${BRAND.text};">aproximadamente 30 minutos</strong>.`)}

    ${infoCard([
      ["Especialidade", especialidade || "Clínico Geral"],
      ["Profissional", profissional || "A definir"],
      ["Horário", dataHora],
      ["Consulta", `#${consultaId || "—"}`],
    ])}

    ${alertBox(`<strong>Antes de entrar, verifique:</strong><br>
      &bull; Câmera e microfone funcionando<br>
      &bull; Conexão estável com a internet<br>
      &bull; Ambiente tranquilo e bem iluminado<br>
      &bull; Documentos e sintomas em mãos`)}

    ${cta("Entrar na sala de espera", `${SITE_URL}/teleconsultas`, BRAND.primary)}

    ${securityNote("Cuide-se. Estamos aqui por você. 💛")}`;

  return {
    subject: "⏰ Sua consulta começa em 30 minutos — Novità",
    html: base({ preheader: `Lembrete: consulta de ${especialidade} em 30 minutos.`, body }),
  };
}

// ─── Template: NotificacaoPedido (Order Status Update) ───────────────────────
function notificacaoPedido({ nome, pedidoId, status, mensagem }) {
  const statusConfig = {
    pending:    { label: "Pedido recebido",    color: BRAND.info,    icon: "📦" },
    processing: { label: "Em preparação",      color: BRAND.primary, icon: "⚙️" },
    shipped:    { label: "Pedido enviado",      color: BRAND.accent,  icon: "🚚" },
    delivered:  { label: "Pedido entregue",     color: BRAND.accent,  icon: "✅" },
    cancelled:  { label: "Pedido cancelado",    color: BRAND.danger,  icon: "❌" },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const shortId = String(pedidoId).substring(0, 8).toUpperCase();

  const rows = [
    ["Pedido", `#${shortId}`],
    ["Status", config.label],
  ];

  const body = `
    ${badge(config.label, config.color)}
    ${heading(`${config.icon} Atualização do pedido #${shortId}`)}
    ${paragraph(`Olá, <strong style="color:${BRAND.text};">${nome || "Cliente"}</strong>. ${mensagem || "Seu pedido foi atualizado."}`)}

    ${infoCard(rows)}

    ${status === "shipped"
      ? alertBox(`<strong>Entrega Própria:</strong> A entrega será realizada pela equipe Novità. Em breve entraremos em contato.`)
      : ""
    }

    ${cta("Ver meus pedidos", `${SITE_URL}/orders`, config.color)}`;

  return {
    subject: `${config.icon} Pedido #${shortId} — ${config.label}`,
    html: base({ preheader: `${config.label} — Pedido #${shortId}`, body }),
  };
}

// ─── Template: PagamentoMedicamentoConfirmado ────────────────────────────────
function pagamentoMedicamentoConfirmado({
  nome,
  pedidoId,
  paymentId,
  paymentMethod,
  installments,
  subtotal,
  total,
  items,
  enderecoEntrega,
}) {
  const shortId = String(pedidoId || "").substring(0, 8).toUpperCase();
  const metodo = (paymentMethod || "credit_card").toLowerCase() === "pix"
    ? "PIX"
    : "Cartão de crédito";
  const formatBRL = (v) =>
    typeof v === "number"
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : v;

  const rows = [
    ["Pedido", `#${shortId}`],
    ["Forma de pagamento", metodo],
  ];
  if (installments && Number(installments) > 1) {
    rows.push(["Parcelas", `${installments}x`]);
  }
  if (typeof subtotal === "number") rows.push(["Subtotal", formatBRL(subtotal)]);
  rows.push(["Total pago", formatBRL(total)]);
  if (paymentId) rows.push(["ID do pagamento", String(paymentId).substring(0, 16) + "..."]);

  const itemsList = Array.isArray(items) && items.length > 0
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;">
        <tr style="background-color:${BRAND.cardBg};">
          <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;">Medicamento</td>
          <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${BRAND.muted};text-transform:uppercase;letter-spacing:0.5px;text-align:center;width:60px;">Qtd</td>
        </tr>
        ${items.map((it) => `
          <tr>
            <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.text};border-top:1px solid ${BRAND.border};">${it.name || ""}</td>
            <td style="padding:10px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.muted};border-top:1px solid ${BRAND.border};text-align:center;">${it.quantity || 1}x</td>
          </tr>
        `).join("")}
      </table>`
    : "";

  const enderecoBlock = enderecoEntrega
    ? alertBox(`<strong>Endereço de entrega:</strong><br/>${enderecoEntrega}`, BRAND.info)
    : "";

  const body = `
    ${badge("Pagamento Confirmado", BRAND.accent)}
    ${heading(`✅ Pagamento confirmado — Pedido #${shortId}`)}
    ${paragraph(`Olá, <strong style="color:${BRAND.text};">${nome || "Cliente"}</strong>. Recebemos o pagamento do seu pedido de medicamentos com sucesso!`)}

    ${infoCard(rows)}

    ${itemsList}

    ${enderecoBlock}

    ${alertBox(`<strong>Próximos passos:</strong> nossa equipe vai conferir a receita e separar seus medicamentos. A entrega é realizada pela equipe Novità — você será notificado quando o pedido sair para entrega.`, BRAND.primary)}

    ${cta("Acompanhar pedido", `${SITE_URL}/orders`, BRAND.accent)}`;

  return {
    subject: `✅ Pagamento confirmado — Pedido #${shortId}`,
    html: base({ preheader: `Recebemos seu pagamento do pedido #${shortId}.`, body }),
  };
}

// ─── Template: AssinaturaPlanoAtivada ─────────────────────────────────────────
function assinaturaPlanoAtivada({
  nome,
  planoNome,
  planoTipo,
  billingCycle,
  price,
  monthlyEquivalent,
  recurrentPaymentId,
  features,
  proximoCobranca,
}) {
  const ciclo = billingCycle === "yearly" ? "Anual" : "Mensal";
  const formatBRL = (v) =>
    typeof v === "number"
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : v;

  // Cor/emoji por tipo de plano
  const PLAN_THEME = {
    bronze:   { color: "#CD7F32", emoji: "🥉", title: "Bronze" },
    prata:    { color: "#A8A9AD", emoji: "🥈", title: "Prata" },
    ouro:     { color: "#EDAF00", emoji: "🥇", title: "Ouro" },
    platina:  { color: "#7F8C8D", emoji: "💠", title: "Platina" },
    diamante: { color: "#5DADE2", emoji: "💎", title: "Diamante" },
    coletivo: { color: "#10B981", emoji: "👨‍👩‍👧", title: "Coletivo" },
  };
  const baseKey = String(planoTipo || "")
    .toLowerCase()
    .replace("-coletivo", "")
    .replace("coletivo-", "")
    .trim();
  const theme = PLAN_THEME[baseKey] || PLAN_THEME[String(planoTipo || "").toLowerCase()] || {
    color: BRAND.primary,
    emoji: "✨",
    title: planoNome || "Plano",
  };

  const rows = [
    ["Plano", `${theme.emoji} ${planoNome || theme.title}`],
    ["Ciclo de cobrança", ciclo],
    ["Valor", `${formatBRL(price)} / ${billingCycle === "yearly" ? "ano" : "mês"}`],
  ];
  if (billingCycle === "yearly" && typeof monthlyEquivalent === "number") {
    rows.push(["Equivalente mensal", `${formatBRL(monthlyEquivalent)} / mês`]);
  }
  if (proximoCobranca) rows.push(["Próxima cobrança", proximoCobranca]);
  if (recurrentPaymentId) {
    rows.push(["ID da assinatura", String(recurrentPaymentId).substring(0, 16) + "..."]);
  }

  const featuresList = Array.isArray(features) && features.length > 0
    ? `
      <div style="margin:20px 0;padding:20px;background-color:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:12px;">
        <p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${theme.color};text-transform:uppercase;letter-spacing:0.5px;">
          O que está incluso
        </p>
        <ul style="margin:0;padding-left:20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.text};line-height:22px;">
          ${features.map((f) => `<li style="margin-bottom:6px;">${f}</li>`).join("")}
        </ul>
      </div>`
    : "";

  const body = `
    ${badge(`Plano ${theme.title} ativado`, theme.color)}
    ${heading(`${theme.emoji} Bem-vindo ao plano ${theme.title}!`)}
    ${paragraph(`Olá, <strong style="color:${BRAND.text};">${nome || "Cliente"}</strong>. Sua assinatura do <strong>plano ${theme.title}</strong> foi ativada com sucesso. A partir de agora você já pode aproveitar todos os benefícios.`)}

    ${infoCard(rows)}

    ${featuresList}

    ${alertBox(`<strong>Cobrança recorrente:</strong> a renovação é automática a cada ${billingCycle === "yearly" ? "ano" : "mês"}. Você pode cancelar a qualquer momento pelo seu painel.`, BRAND.info)}

    ${cta("Acessar meu plano", `${SITE_URL}/my-plan`, theme.color)}`;

  return {
    subject: `${theme.emoji} Plano ${theme.title} ativado — Novità Telemedicina`,
    html: base({ preheader: `Sua assinatura do plano ${theme.title} está ativa.`, body }),
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // Componentes (para uso externo se necessário)
  BRAND,
  base,
  badge,
  heading,
  paragraph,
  cta,
  ctaSecondary,
  infoCard,
  alertBox,
  divider,

  // Templates completos
  usuarioCadastrado,
  senhaAlterada,
  consultaAgendada,
  lembreteConsulta,
  notificacaoPedido,
  pagamentoMedicamentoConfirmado,
  assinaturaPlanoAtivada,
};
