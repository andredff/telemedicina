import type { AssemedConfig, AssemedUrls } from "./types";

// URLs da API Assemed
const URLS = {
  sandbox: {
    apiUrl: "https://dev-api-assemed.azurewebsites.net",
    appUrl: "https://dev-app-assemed.azurewebsites.net",
  },
  production: {
    apiUrl: "https://api.assemedtelemedicina.com",
    appUrl: "https://app.assemedtelemedicina.com",
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
  return isSandbox ? URLS.sandbox : URLS.production;
}

/**
 * Monta a URL da sala de espera para teleconsulta
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
