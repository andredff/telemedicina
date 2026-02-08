/**
 * Configuração da integração com Memed
 *
 * Variáveis de ambiente:
 *   VITE_MEMED_API_KEY - Chave de API do Memed
 *   VITE_MEMED_SECRET_TOKEN - Token secreto do Memed
 *   VITE_MEMED_SANDBOX - "true" para usar ambiente sandbox
 */

export const MEMED_CONFIG = {
  sandbox: {
    baseUrl: "https://sandbox.api.memed.com.br/v1",
    scriptUrl: "https://sandbox.memed.com.br/modulos/plataforma.bundle-v2.js",
  },
  production: {
    baseUrl: "https://api.memed.com.br/v1",
    scriptUrl: "https://memed.com.br/modulos/plataforma.bundle-v2.js",
  },
};

export const getMemedCredentials = () => ({
  apiKey: import.meta.env.VITE_MEMED_API_KEY || "",
  secretToken: import.meta.env.VITE_MEMED_SECRET_TOKEN || "",
  isSandbox: import.meta.env.VITE_MEMED_SANDBOX !== "false",
});

export const getMemedUrls = (isSandbox: boolean) => {
  return isSandbox ? MEMED_CONFIG.sandbox : MEMED_CONFIG.production;
};

export const isMemedConfigured = (): boolean => {
  const creds = getMemedCredentials();
  return Boolean(creds.apiKey && creds.secretToken);
};
