import { getServerUrl } from "./config";
import { cieloMockClient } from "./mockClient";
import type {
  CreateSaleRequest,
  CreateRecurrentSaleRequest,
  SaleResponse,
  RecurrenceInterval,
  DeactivateRecurrenceResponse,
} from "./types";

function isLocalhostUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  } catch {
    // Non-URL strings (e.g. relative paths) are treated as non-localhost.
    return false;
  }
}

class CieloClient {
  private useMock: boolean;
  private useLocalServer: boolean;
  private localServerUrl: string;

  constructor() {
    const serverUrl = getServerUrl();

    this.localServerUrl = serverUrl;

    const serverConfigured = !!serverUrl;
    const serverIsLocalhost = isLocalhostUrl(serverUrl);
    const canUseServer = serverConfigured && (import.meta.env.DEV || !serverIsLocalhost);
    this.useLocalServer = canUseServer;

    // Browser cannot call Cielo API directly (CORS).
    // Without a proxy server, always fall back to mock.
    const forceMock = import.meta.env.VITE_CIELO_FORCE_MOCK === "true";
    this.useMock = forceMock || !this.useLocalServer;

    if (this.useMock) {
      console.info("[Cielo] Usando modo MOCK (pagamento simulado).");
      if (!forceMock && serverConfigured && serverIsLocalhost && import.meta.env.PROD) {
        // In production builds, "localhost" is never reachable from end-user browsers.
        console.warn("[Cielo] Servidor de pagamento aponta para localhost em produção. Ajuste VITE_LOCAL_SERVER_URL ou use um backend/edge function.");
      }
    } else if (this.useLocalServer) {
      console.info(`[Cielo] Usando proxy de pagamento: ${this.localServerUrl}`);
    }
  }

  private async localRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.localServerUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data as T;
  }

  // ==========================================
  // PAGAMENTO SIMPLES (Medicamentos)
  // ==========================================

  /**
   * Cria uma transação simples de cartão de crédito
   * Usado para pagamento de medicamentos
   */
  async createCreditCardSale(
    request: CreateSaleRequest
  ): Promise<SaleResponse> {
    if (this.useMock) {
      return cieloMockClient.createCreditCardSale(request);
    }

    if (this.useLocalServer) {
      return this.localRequest<SaleResponse>("/api/cielo/payment", {
        method: "POST",
        body: JSON.stringify({
          orderId: request.MerchantOrderId,
          customer: {
            name: request.Customer.Name,
            email: request.Customer.Email,
            cpf: request.Customer.Identity,
            birthdate: request.Customer.Birthdate,
            address: request.Customer.Address,
          },
          card: {
            cardNumber: request.Payment.CreditCard?.CardNumber,
            holder: request.Payment.CreditCard?.Holder,
            expirationDate: request.Payment.CreditCard?.ExpirationDate,
            securityCode: request.Payment.CreditCard?.SecurityCode,
            brand: request.Payment.CreditCard?.Brand,
          },
          amountInCents: request.Payment.Amount,
          installments: request.Payment.Installments,
          paymentType: "credit_card",
        }),
      });
    }

    throw new Error("Cielo proxy server not configured");
  }

  /**
   * Captura uma transação pré-autorizada
   */
  async captureSale(
    paymentId: string,
    amount?: number
  ): Promise<SaleResponse> {
    if (this.useMock) {
      return cieloMockClient.captureSale(paymentId, amount);
    }

    if (this.useLocalServer) {
      return this.localRequest<SaleResponse>(`/api/cielo/payment/${paymentId}/capture`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    }

    throw new Error("Cielo proxy server not configured");
  }

  /**
   * Cancela uma transação
   */
  async cancelSale(
    paymentId: string,
    amount?: number
  ): Promise<SaleResponse> {
    if (this.useMock) {
      return cieloMockClient.cancelSale(paymentId, amount);
    }

    if (this.useLocalServer) {
      return this.localRequest<SaleResponse>(`/api/cielo/payment/${paymentId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
    }

    throw new Error("Cielo proxy server not configured");
  }

  /**
   * Consulta uma transação pelo PaymentId
   */
  async getSale(paymentId: string): Promise<SaleResponse> {
    if (this.useMock) {
      return cieloMockClient.getSale(paymentId);
    }

    if (this.useLocalServer) {
      return this.localRequest<SaleResponse>(`/api/cielo/payment/${paymentId}`);
    }

    throw new Error("Cielo proxy server not configured");
  }

  /**
   * Consulta uma transação pelo MerchantOrderId
   */
  async getSaleByOrderId(merchantOrderId: string): Promise<SaleResponse> {
    if (this.useMock) {
      return cieloMockClient.getSaleByOrderId(merchantOrderId);
    }
    // Not used in the current UI. Implement on the proxy server if needed.
    throw new Error("getSaleByOrderId is not available without a proxy server implementation");
  }

  // ==========================================
  // PAGAMENTO RECORRENTE (Planos)
  // ==========================================

  /**
   * Cria uma transação recorrente programada
   * Usado para assinatura de planos
   */
  async createRecurrentSale(
    request: CreateRecurrentSaleRequest
  ): Promise<SaleResponse> {
    if (this.useMock) {
      return cieloMockClient.createRecurrentSale(request);
    }

    if (this.useLocalServer) {
      return this.localRequest<SaleResponse>("/api/cielo/payment", {
        method: "POST",
        body: JSON.stringify({
          orderId: request.MerchantOrderId,
          customer: {
            name: request.Customer.Name,
            email: request.Customer.Email,
            cpf: request.Customer.Identity,
            birthdate: request.Customer.Birthdate,
          },
          card: {
            cardNumber: request.Payment.CreditCard?.CardNumber,
            holder: request.Payment.CreditCard?.Holder,
            expirationDate: request.Payment.CreditCard?.ExpirationDate,
            securityCode: request.Payment.CreditCard?.SecurityCode,
            brand: request.Payment.CreditCard?.Brand,
          },
          amountInCents: request.Payment.Amount,
          installments: 1,
          paymentType: "recurrent",
          interval: request.Payment.RecurrentPayment?.Interval,
          startDate: request.Payment.RecurrentPayment?.StartDate,
          endDate: request.Payment.RecurrentPayment?.EndDate,
        }),
      });
    }

    throw new Error("Cielo proxy server not configured");
  }

  /**
   * Consulta uma recorrência pelo RecurrentPaymentId
   */
  async getRecurrence(recurrentPaymentId: string): Promise<SaleResponse> {
    if (this.useMock) {
      return cieloMockClient.getRecurrence(recurrentPaymentId);
    }
    // Not used in the current UI. Implement on the proxy server if needed.
    throw new Error("getRecurrence is not available without a proxy server implementation");
  }

  /**
   * Altera o valor da recorrência
   */
  async updateRecurrenceAmount(
    recurrentPaymentId: string,
    amount: number
  ): Promise<void> {
    if (this.useMock) {
      return cieloMockClient.updateRecurrenceAmount(recurrentPaymentId, amount);
    }
    // Not used in the current UI. Implement on the proxy server if needed.
    throw new Error("updateRecurrenceAmount is not available without a proxy server implementation");
  }

  /**
   * Altera a data do próximo pagamento
   */
  async updateRecurrenceNextDate(
    recurrentPaymentId: string,
    nextPaymentDate: string // YYYY-MM-DD
  ): Promise<void> {
    if (this.useMock) {
      return cieloMockClient.updateRecurrenceNextDate(recurrentPaymentId, nextPaymentDate);
    }
    // Not used in the current UI. Implement on the proxy server if needed.
    throw new Error("updateRecurrenceNextDate is not available without a proxy server implementation");
  }

  /**
   * Altera o intervalo da recorrência
   */
  async updateRecurrenceInterval(
    recurrentPaymentId: string,
    interval: RecurrenceInterval
  ): Promise<void> {
    if (this.useMock) {
      return cieloMockClient.updateRecurrenceInterval(recurrentPaymentId, interval);
    }
    // Not used in the current UI. Implement on the proxy server if needed.
    throw new Error("updateRecurrenceInterval is not available without a proxy server implementation");
  }

  /**
   * Altera a data final da recorrência
   */
  async updateRecurrenceEndDate(
    recurrentPaymentId: string,
    endDate: string // YYYY-MM-DD
  ): Promise<void> {
    if (this.useMock) {
      return cieloMockClient.updateRecurrenceEndDate(recurrentPaymentId, endDate);
    }
    // Not used in the current UI. Implement on the proxy server if needed.
    throw new Error("updateRecurrenceEndDate is not available without a proxy server implementation");
  }

  /**
   * Desativa uma recorrência (cancela assinatura)
   */
  async deactivateRecurrence(
    recurrentPaymentId: string
  ): Promise<DeactivateRecurrenceResponse> {
    if (this.useMock) {
      return cieloMockClient.deactivateRecurrence(recurrentPaymentId);
    }
    // Not used in the current UI. Implement on the proxy server if needed.
    throw new Error("deactivateRecurrence is not available without a proxy server implementation");
  }

  /**
   * Reativa uma recorrência
   */
  async reactivateRecurrence(
    recurrentPaymentId: string
  ): Promise<DeactivateRecurrenceResponse> {
    if (this.useMock) {
      return cieloMockClient.reactivateRecurrence(recurrentPaymentId);
    }
    // Not used in the current UI. Implement on the proxy server if needed.
    throw new Error("reactivateRecurrence is not available without a proxy server implementation");
  }
}

export class CieloApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CieloApiError";
  }
}

// Singleton instance
export const cieloClient = new CieloClient();
