// Cielo API Configuration
//
// Para obter credenciais de SANDBOX:
// 1. Acesse: https://cadastrosandbox.cieloecommerce.cielo.com.br/
// 2. Crie uma conta de testes
// 3. Você receberá MerchantId e MerchantKey por email
//
// Para PRODUÇÃO:
// Entre em contato com a Cielo para obter credenciais de produção

export const CIELO_CONFIG = {
  sandbox: {
    transactionalUrl: "https://apisandbox.cieloecommerce.cielo.com.br",
    queryUrl: "https://apiquerysandbox.cieloecommerce.cielo.com.br",
  },
  production: {
    transactionalUrl: "https://api.cieloecommerce.cielo.com.br",
    queryUrl: "https://apiquery.cieloecommerce.cielo.com.br",
  },
};

// Credenciais são carregadas das variáveis de ambiente
export const getCieloCredentials = () => ({
  merchantId: import.meta.env.VITE_CIELO_MERCHANT_ID || "",
  merchantKey: import.meta.env.VITE_CIELO_MERCHANT_KEY || "",
  isSandbox: import.meta.env.VITE_CIELO_SANDBOX === "true",
});

export const getCieloUrls = (isSandbox: boolean) => {
  return isSandbox ? CIELO_CONFIG.sandbox : CIELO_CONFIG.production;
};

// Cartões de teste para Sandbox
// O último dígito determina o resultado da transação:
// 0, 1, 4 = Autorizado
// 2 = Não autorizado (código 05)
// 3 = Cartão expirado (código 57)
// 5 = Cartão bloqueado (código 78)
// 6 = Timeout (código 99)
// 7 = Cartão cancelado (código 77)
// 8 = Problemas com cartão (código 70)
// 9 = Autorização aleatória
export const TEST_CARDS = {
  visa: {
    success: "4024007153763191", // Termina em 1 = sucesso
    denied: "4024007153763192",  // Termina em 2 = negado
    expired: "4024007153763193", // Termina em 3 = expirado
    blocked: "4024007153763195", // Termina em 5 = bloqueado
  },
  mastercard: {
    success: "5425233430109904", // Termina em 4 = sucesso
    denied: "5425233430109902",
  },
  cvv: "123",
  expirationDate: "12/2030",
} as const;
