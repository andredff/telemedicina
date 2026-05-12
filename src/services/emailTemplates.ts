/**
 * Templates HTML de email para notificações de pedido
 * Identidade visual Novità Telemedicina
 */

import type { OrderStatus, OrderNotification } from "./notificationService";

// URL base da aplicação para links nos emails. Em prod aponta para o domínio
// público; em dev cai no Vite (5173). Configurável via VITE_APP_URL.
const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, "")
  || (import.meta.env.PROD ? "https://novita.migrai.com.br" : "http://localhost:5173");
const ORDERS_URL = `${APP_URL}/orders`;

// Assets de imagem hospedados publicamente (Supabase Storage) — clientes de
// email não conseguem carregar imagens de localhost durante o desenvolvimento.
const LOGO_URL = "https://ttzenzogctubbcyxaauo.supabase.co/storage/v1/object/public/brand-assets/novita_logo.png";

// Cores da marca
const BRAND = {
  primary: "#EDAF00",
  secondary: "#CC9B00",
  text: "#4B4B4B",
  textLight: "#717171",
  background: "#F9F9F9",
  white: "#FFFFFF",
  border: "#E5E5E5",
} as const;

// Cores por status
const STATUS_COLORS: Record<OrderStatus, { color: string; bg: string; label: string; icon: string }> = {
  pending: {
    color: "#EDAF00",
    bg: "#FFF8E1",
    label: "Pedido Pago",
    icon: "&#128230;", // 📦
  },
  processing: {
    color: "#3B82F6",
    bg: "#EFF6FF",
    label: "Pedido em Separação",
    icon: "&#9881;&#65039;", // ⚙️
  },
  shipped: {
    color: "#8B5CF6",
    bg: "#F5F3FF",
    label: "Pedido Enviado",
    icon: "&#128666;", // 🚚
  },
  delivered: {
    color: "#22C55E",
    bg: "#F0FDF4",
    label: "Pedido Entregue",
    icon: "&#9989;", // ✅
  },
  cancelled: {
    color: "#EF4444",
    bg: "#FEF2F2",
    label: "Pedido Cancelado",
    icon: "&#10060;", // ❌
  },
};

// Logo Novità Health Group servido a partir de /public
const LOGO_SVG = `
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr>
    <td align="center">
      <img src="${LOGO_URL}" alt="Novità Health Group" width="180" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:180px;" />
    </td>
  </tr>
</table>`;

function baseLayout(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Novit&agrave; Telemedicina</title>
  <!--[if mso]>
  <style>table,td{font-family:Arial,Helvetica,sans-serif!important;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.background};font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <!-- Preheader (texto invisível para preview do email) -->
  <div style="display:none;font-size:1px;color:${BRAND.background};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${preheader}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.background};">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <!-- Container principal -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:${BRAND.white};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid ${BRAND.border};">
              ${LOGO_SVG}
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${BRAND.background};padding:32px 40px;border-top:1px solid ${BRAND.border};">
              <!-- Contato -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.textLight};">
                      &#128222; (61) 3041-3218 &nbsp;&nbsp;|&nbsp;&nbsp; &#9993; contato@novitahomecare.com.br
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.textLight};line-height:18px;">
                      Ed. Bras&iacute;lia R&aacute;dio Center, SRTVN Conj. P, Sala SS 06<br/>
                      Asa Norte, Bras&iacute;lia - DF
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${BRAND.border};">
                      &mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${BRAND.textLight};line-height:16px;">
                      &copy; ${new Date().getFullYear()} Novit&agrave; Home Care Servi&ccedil;os em Sa&uacute;de LTDA<br/>
                      Voc&ecirc; recebeu este email porque realizou um pedido na plataforma Novit&agrave; Telemedicina.
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function statusBadge(status: OrderStatus): string {
  const s = STATUS_COLORS[status];
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;">
    <tr>
      <td style="background-color:${s.bg};border:2px solid ${s.color};border-radius:50px;padding:10px 24px;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${s.color};">
          ${s.icon}&nbsp; ${s.label}
        </span>
      </td>
    </tr>
  </table>`;
}

function ctaButton(text: string, url: string = "#"): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 0;">
    <tr>
      <td style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.secondary});border-radius:8px;">
        <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${BRAND.white};text-decoration:none;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;
}

function itemsTable(items: Array<{ name: string; quantity: number }>): string {
  if (!items || items.length === 0) return "";

  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.text};border-bottom:1px solid ${BRAND.border};">
        ${item.name}
      </td>
      <td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.textLight};border-bottom:1px solid ${BRAND.border};text-align:center;width:60px;">
        ${item.quantity}x
      </td>
    </tr>`
    )
    .join("");

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;">
    <tr style="background-color:${BRAND.background};">
      <td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${BRAND.textLight};text-transform:uppercase;letter-spacing:0.5px;">
        Medicamento
      </td>
      <td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${BRAND.textLight};text-transform:uppercase;letter-spacing:0.5px;text-align:center;width:60px;">
        Qtd
      </td>
    </tr>
    ${rows}
  </table>`;
}

function estimatedDeliveryBox(estimatedDelivery: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;background-color:${STATUS_COLORS.shipped.bg};border:1px solid #DDD6FE;border-radius:12px;">
    <tr>
      <td style="padding:20px 24px;">
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;color:${STATUS_COLORS.shipped.color};text-transform:uppercase;letter-spacing:0.5px;">
          Previs&atilde;o de Entrega
        </span>
        <br/>
        <span style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:${BRAND.text};">
          ${estimatedDelivery}
        </span>
      </td>
    </tr>
  </table>`;
}

function orderIdLine(orderId: string): string {
  return `
  <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.textLight};margin:0 0 4px;text-align:center;">
    Pedido
  </p>
  <p style="font-family:'Courier New',monospace;font-size:16px;font-weight:700;color:${BRAND.text};margin:0 0 24px;text-align:center;letter-spacing:0.5px;">
    #${orderId.substring(0, 8).toUpperCase()}
  </p>`;
}

// ==========================================
// TEMPLATES POR STATUS
// ==========================================

function pendingBody(data: OrderNotification): string {
  return `
    ${statusBadge("pending")}
    ${orderIdLine(data.orderId)}

    <p style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${BRAND.text};margin:0 0 8px;">
      Ol&aacute;, ${data.customerName}!
    </p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BRAND.textLight};line-height:24px;margin:0 0 16px;">
      Seu pedido foi recebido com sucesso! Estamos processando e em breve voc&ecirc; receber&aacute; mais informa&ccedil;&otilde;es sobre a prepara&ccedil;&atilde;o dos seus medicamentos.
    </p>

    ${itemsTable(data.items || [])}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;background-color:#FFF8E1;border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.secondary};line-height:20px;">
            &#128161; <strong>Pr&oacute;ximo passo:</strong> Nossa equipe ir&aacute; separar seus medicamentos com todo o cuidado. Voc&ecirc; ser&aacute; notificado quando o pedido for enviado.
          </span>
        </td>
      </tr>
    </table>

    ${ctaButton("Acompanhar Pedido", ORDERS_URL)}
  `;
}

function processingBody(data: OrderNotification): string {
  return `
    ${statusBadge("processing")}
    ${orderIdLine(data.orderId)}

    <p style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${BRAND.text};margin:0 0 8px;">
      Ol&aacute;, ${data.customerName}!
    </p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BRAND.textLight};line-height:24px;margin:0 0 16px;">
      &Oacute;timas not&iacute;cias! Seu pedido est&aacute; sendo preparado pela nossa equipe. Estamos separando seus medicamentos com todo o cuidado para garantir a qualidade.
    </p>

    ${itemsTable(data.items || [])}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;background-color:${STATUS_COLORS.processing.bg};border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${STATUS_COLORS.processing.color};line-height:20px;">
            &#128230; <strong>Em breve:</strong> Assim que seu pedido for despachado, nossa equipe entrar&aacute; em contato para combinar a entrega.
          </span>
        </td>
      </tr>
    </table>

    ${ctaButton("Acompanhar Pedido", ORDERS_URL)}
  `;
}

function shippedBody(data: OrderNotification): string {
  return `
    ${statusBadge("shipped")}
    ${orderIdLine(data.orderId)}

    <p style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${BRAND.text};margin:0 0 8px;">
      Ol&aacute;, ${data.customerName}!
    </p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BRAND.textLight};line-height:24px;margin:0 0 16px;">
      Seu pedido foi enviado e est&aacute; a caminho! A entrega ser&aacute; realizada pela equipe Novit&agrave;.
    </p>

    ${data.estimatedDelivery ? estimatedDeliveryBox(data.estimatedDelivery) : ""}

    ${itemsTable(data.items || [])}

    ${ctaButton("Acompanhar Pedido", ORDERS_URL)}
  `;
}

function deliveredBody(data: OrderNotification): string {
  return `
    ${statusBadge("delivered")}
    ${orderIdLine(data.orderId)}

    <p style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${BRAND.text};margin:0 0 8px;">
      Ol&aacute;, ${data.customerName}!
    </p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BRAND.textLight};line-height:24px;margin:0 0 16px;">
      Seu pedido foi entregue com sucesso! Esperamos que esteja satisfeito com seus medicamentos.
    </p>

    ${itemsTable(data.items || [])}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;background-color:${STATUS_COLORS.delivered.bg};border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#16A34A;line-height:20px;">
            &#128154; <strong>Obrigado por escolher a Novit&agrave;!</strong> Se tiver alguma d&uacute;vida sobre seus medicamentos, entre em contato com nosso suporte.
          </span>
        </td>
      </tr>
    </table>

    ${ctaButton("Acompanhar Pedido", ORDERS_URL)}
  `;
}

function cancelledBody(data: OrderNotification): string {
  return `
    ${statusBadge("cancelled")}
    ${orderIdLine(data.orderId)}

    <p style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:${BRAND.text};margin:0 0 8px;">
      Ol&aacute;, ${data.customerName}
    </p>
    <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BRAND.textLight};line-height:24px;margin:0 0 16px;">
      Seu pedido foi cancelado. Se voc&ecirc; n&atilde;o solicitou este cancelamento ou tem alguma d&uacute;vida, entre em contato com nosso suporte.
    </p>

    ${itemsTable(data.items || [])}

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;background-color:${STATUS_COLORS.cancelled.bg};border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${STATUS_COLORS.cancelled.color};line-height:20px;">
            &#128222; Precisa de ajuda? Ligue para <strong>(61) 3041-3218</strong> ou envie um email para <strong>contato@novitahomecare.com.br</strong>
          </span>
        </td>
      </tr>
    </table>

    ${ctaButton("Fazer Novo Pedido")}
  `;
}

// ==========================================
// SUBJECTS E EXPORTAÇÃO
// ==========================================

const EMAIL_SUBJECTS: Record<OrderStatus, string> = {
  pending: "Pedido Pago - Novità Telemedicina",
  processing: "Pedido em Separação - Novità Telemedicina",
  shipped: "Pedido Enviado - Novità Telemedicina",
  delivered: "Pedido Entregue - Novità Telemedicina",
  cancelled: "Pedido Cancelado - Novità Telemedicina",
};

const PREHEADERS: Record<OrderStatus, (data: OrderNotification) => string> = {
  pending: (d) => `Seu pedido #${d.orderId.substring(0, 8)} foi confirmado e está pago!`,
  processing: (d) => `Seu pedido #${d.orderId.substring(0, 8)} está sendo separado.`,
  shipped: (d) => `Seu pedido #${d.orderId.substring(0, 8)} foi enviado!`,
  delivered: (d) => `Seu pedido #${d.orderId.substring(0, 8)} foi entregue com sucesso!`,
  cancelled: (d) => `Seu pedido #${d.orderId.substring(0, 8)} foi cancelado.`,
};

const BODY_RENDERERS: Record<OrderStatus, (data: OrderNotification) => string> = {
  pending: pendingBody,
  processing: processingBody,
  shipped: shippedBody,
  delivered: deliveredBody,
  cancelled: cancelledBody,
};

// Frases UX amigáveis por status (exibidas no corpo do email e nos logs)
const MENSAGENS_POR_STATUS: Record<OrderStatus, string> = {
  pending:    "Recebemos seu pedido e já estamos verificando os detalhes.",
  processing: "Estamos preparando seu pedido com cuidado.",
  shipped:    "Seu pedido já está a caminho 🚚",
  delivered:  "Seu pedido foi entregue com sucesso 🎉",
  cancelled:  "Seu pedido foi cancelado. Se precisar, estamos aqui.",
};

/**
 * Retorna mensagem UX amigável para o status do pedido
 */
export function getMensagemOpcional(status: OrderStatus): string {
  return MENSAGENS_POR_STATUS[status] || "";
}

/**
 * Gera o subject do email baseado no status
 */
export function getEmailSubject(status: OrderStatus): string {
  return EMAIL_SUBJECTS[status] || "Atualização do Pedido - Novità Telemedicina";
}

/**
 * Gera o HTML completo do email baseado no status e dados do pedido
 */
export function renderEmailTemplate(data: OrderNotification): string {
  const bodyRenderer = BODY_RENDERERS[data.status];
  const preheaderFn = PREHEADERS[data.status];

  if (!bodyRenderer || !preheaderFn) {
    return baseLayout(
      `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BRAND.text};">Atualização do seu pedido #${data.orderId}</p>`,
      `Atualização do pedido #${data.orderId}`
    );
  }

  return baseLayout(bodyRenderer(data), preheaderFn(data));
}
