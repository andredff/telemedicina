import type { AssemedConfig, AssemedUrls } from "./types";

// URLs da API Assemed (podem ser sobrescritas por .env)
const URLS = {
  sandbox: {
    apiUrl:
      import.meta.env.VITE_ASSEMED_API_URL_HOMOLOG ||
      "https://dev-api-assemed.azurewebsites.net",
    appUrl:
      import.meta.env.VITE_ASSEMED_APP_URL_HOMOLOG ||
      "https://dev-app-assemed.azurewebsites.net",
  },
  production: {
    apiUrl:
      import.meta.env.VITE_ASSEMED_API_URL_PROD ||
      "https://api.assemedtelemedicina.com",
    appUrl:
      import.meta.env.VITE_ASSEMED_APP_URL_PROD ||
      "https://app.assemedtelemedicina.com",
  },
};

// URL do iframe white label da Novità
export const TELEMEDICINA_IFRAME_URL =
  import.meta.env.VITE_TELEMEDICINA_IFRAME_URL ||
  "https://telemedicina.novitahomecare.com.br/";

// Sala padrão da White Label (quando configurada, prioriza URL `?sala=...`)
const TELEMEDICINA_WL_SALA_ID =
  import.meta.env.VITE_TELEMEDICINA_WL_SALA_ID || "1773";

/**
 * Obtém as credenciais da API Assemed das variáveis de ambiente.
 *
 * ATENÇÃO: VITE_ASSEMED_CLIENT_ID/SECRET ficam no bundle do frontend.
 * Em produção, deixe estas variáveis vazias e roteie a autenticação
 * pelo backend (cielo-server.js) para não expor as credenciais.
 */
export function getAssemedCredentials(): AssemedConfig {
  const clientId     = import.meta.env.VITE_ASSEMED_CLIENT_ID     || "";
  const clientSecret = import.meta.env.VITE_ASSEMED_CLIENT_SECRET || "";

  if (import.meta.env.PROD && (clientId || clientSecret)) {
    console.warn(
      "[Assemed] ATENÇÃO: VITE_ASSEMED_CLIENT_ID/SECRET estão definidas em produção e serão expostas no bundle. " +
      "Considere mover a autenticação Assemed para o backend."
    );
  }

  return {
    clientId,
    clientSecret,
    cnpj: import.meta.env.VITE_ASSEMED_CNPJ_CLIENT || "",
    isSandbox: import.meta.env.VITE_ASSEMED_SANDBOX === "true",
  };
}

/**
 * Obtém as URLs da API baseado no ambiente (sandbox ou produção)
 */
export function getAssemedUrls(isSandbox: boolean): AssemedUrls {
  // Em desenvolvimento, usa proxy para evitar CORS
  const useProxy = import.meta.env.DEV;

  if (useProxy) {
    return {
      apiUrl: "/api/assemed",
      appUrl: isSandbox
        ? "https://dev-app-assemed.azurewebsites.net"
        : "https://app.assemedtelemedicina.com",
    };
  }

  return isSandbox ? URLS.sandbox : URLS.production;
}

/**
 * Monta a URL da sala de espera para teleconsulta white-label Novità
 * Usada para iframe em https://telemedicina.novitahomecare.com.br/
 */
export function getWhiteLabelConsultationUrl(
  accessToken: string,
  tipoConsulta: "imediata" | "agendada" = "imediata"
): string {
  const baseUrl = TELEMEDICINA_IFRAME_URL.trim();
  const baseWithoutQuery = baseUrl.split("?")[0].replace(/\/$/, "");

  // Compatibilidade com WL real da Novità: https://telemedicina... ?sala=XXXX
  const salaInUrlMatch = baseUrl.match(/[?&]sala=([^&#]+)/i);
  const salaInUrl = salaInUrlMatch?.[1]
    ? decodeURIComponent(salaInUrlMatch[1])
    : "";
  const salaId = TELEMEDICINA_WL_SALA_ID.trim() || salaInUrl;

  if (salaId) {
    return `${baseWithoutQuery}?sala=${encodeURIComponent(salaId)}`;
  }

  // Remove o Bearer prefix se existir
  const token = accessToken.replace(/^Bearer\s+/i, "");

  // Fallback legado: rota por token na query string
  if (tipoConsulta === "imediata") {
    return `${baseWithoutQuery}/consulta-imediata?token=${encodeURIComponent(token)}`;
  }
  return `${baseWithoutQuery}/agendar-consulta?token=${encodeURIComponent(token)}`;
}

/**
 * Verifica se as credenciais estão configuradas
 */
export function hasCredentials(): boolean {
  const credentials = getAssemedCredentials();
  return Boolean(credentials.clientId && credentials.clientSecret);
}
