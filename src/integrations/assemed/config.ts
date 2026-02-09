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

/**
 * Obtém as credenciais da API Assemed das variáveis de ambiente
 */
export function getAssemedCredentials(): AssemedConfig {
  return {
    clientId: import.meta.env.VITE_ASSEMED_CLIENT_ID || "",
    clientSecret: import.meta.env.VITE_ASSEMED_CLIENT_SECRET || "",
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
  const baseUrl = TELEMEDICINA_IFRAME_URL.replace(/\/$/, "");
  
  // Remove o Bearer prefix se existir
  const token = accessToken.replace(/^Bearer\s+/i, "");
  
  // A URL white-label aceita o token via query param
  if (tipoConsulta === "imediata") {
    return `${baseUrl}/consulta-imediata?token=${encodeURIComponent(token)}`;
  }
  return `${baseUrl}/agendar-consulta?token=${encodeURIComponent(token)}`;
}

/**
 * Monta a URL da sala de espera para teleconsulta (Assemed)
 */
export function getWaitingRoomUrl(
  atendimentoId: number,
  pacienteToken: string,
  isSandbox: boolean = true
): string {
  const urls = getAssemedUrls(isSandbox);
  return `${urls.appUrl}/sala-espera-externa/${atendimentoId}?token=${encodeURIComponent(pacienteToken)}`;
}

/**
 * Verifica se as credenciais estão configuradas
 */
export function hasCredentials(): boolean {
  const credentials = getAssemedCredentials();
  return Boolean(credentials.clientId && credentials.clientSecret);
}
