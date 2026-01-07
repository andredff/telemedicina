import { getCieloCredentials, getCieloUrls } from "./config";
import { cieloMockClient } from "./mockClient";
import type {
  CreateSaleRequest,
  CreateRecurrentSaleRequest,
  SaleResponse,
  CieloError,
  RecurrenceInterval,
  DeactivateRecurrenceResponse,
} from "./types";

class CieloClient {
  private merchantId: string;
  private merchantKey: string;
  private transactionalUrl: string;
  private queryUrl: string;
  private useMock: boolean;

  constructor() {
    const credentials = getCieloCredentials();
    const urls = getCieloUrls(credentials.isSandbox);

    this.merchantId = credentials.merchantId;
    this.merchantKey = credentials.merchantKey;
    this.transactionalUrl = urls.transactionalUrl;
    this.queryUrl = urls.queryUrl;

    // Usa mock se não houver credenciais configuradas
    this.useMock = !this.merchantId || !this.merchantKey;

    if (this.useMock) {
      console.info(
        "[Cielo] Credenciais não configuradas. Usando modo MOCK para testes locais."
      );
    }
  }

  private getHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      MerchantId: this.merchantId,
      MerchantKey: this.merchantKey,
    };
  }

  private async request<T>(
    url: string,
    options: RequestInit
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errors = data as CieloError[];
      throw new CieloApiError(
        errors.map((e) => e.Message).join(", "),
        errors
      );
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
    return this.request<SaleResponse>(`${this.transactionalUrl}/1/sales/`, {
      method: "POST",
      body: JSON.stringify(request),
    });
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
    const url = amount
      ? `${this.transactionalUrl}/1/sales/${paymentId}/capture?amount=${amount}`
      : `${this.transactionalUrl}/1/sales/${paymentId}/capture`;

    return this.request<SaleResponse>(url, {
      method: "PUT",
    });
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
    const url = amount
      ? `${this.transactionalUrl}/1/sales/${paymentId}/void?amount=${amount}`
      : `${this.transactionalUrl}/1/sales/${paymentId}/void`;

    return this.request<SaleResponse>(url, {
      method: "PUT",
    });
  }

  /**
   * Consulta uma transação pelo PaymentId
   */
  async getSale(paymentId: string): Promise<SaleResponse> {
    if (this.useMock) {
      return cieloMockClient.getSale(paymentId);
    }
    return this.request<SaleResponse>(
      `${this.queryUrl}/1/sales/${paymentId}`,
      {
        method: "GET",
      }
    );
  }

  /**
   * Consulta uma transação pelo MerchantOrderId
   */
  async getSaleByOrderId(merchantOrderId: string): Promise<SaleResponse> {
    if (this.useMock) {
      return cieloMockClient.getSaleByOrderId(merchantOrderId);
    }
    return this.request<SaleResponse>(
      `${this.queryUrl}/1/sales?merchantOrderId=${merchantOrderId}`,
      {
        method: "GET",
      }
    );
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
    return this.request<SaleResponse>(`${this.transactionalUrl}/1/sales/`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * Consulta uma recorrência pelo RecurrentPaymentId
   */
  async getRecurrence(recurrentPaymentId: string): Promise<SaleResponse> {
    if (this.useMock) {
      return cieloMockClient.getRecurrence(recurrentPaymentId);
    }
    return this.request<SaleResponse>(
      `${this.queryUrl}/1/RecurrentPayment/${recurrentPaymentId}`,
      {
        method: "GET",
      }
    );
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
    await this.request(
      `${this.transactionalUrl}/1/RecurrentPayment/${recurrentPaymentId}/Amount`,
      {
        method: "PUT",
        body: JSON.stringify({ Amount: amount }),
      }
    );
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
    await this.request(
      `${this.transactionalUrl}/1/RecurrentPayment/${recurrentPaymentId}/NextPaymentDate`,
      {
        method: "PUT",
        body: JSON.stringify({ NextPaymentDate: nextPaymentDate }),
      }
    );
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
    await this.request(
      `${this.transactionalUrl}/1/RecurrentPayment/${recurrentPaymentId}/Interval`,
      {
        method: "PUT",
        body: JSON.stringify({ Interval: interval }),
      }
    );
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
    await this.request(
      `${this.transactionalUrl}/1/RecurrentPayment/${recurrentPaymentId}/EndDate`,
      {
        method: "PUT",
        body: JSON.stringify({ EndDate: endDate }),
      }
    );
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
    return this.request<DeactivateRecurrenceResponse>(
      `${this.transactionalUrl}/1/RecurrentPayment/${recurrentPaymentId}/Deactivate`,
      {
        method: "PUT",
      }
    );
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
    return this.request<DeactivateRecurrenceResponse>(
      `${this.transactionalUrl}/1/RecurrentPayment/${recurrentPaymentId}/Reactivate`,
      {
        method: "PUT",
      }
    );
  }
}

export class CieloApiError extends Error {
  errors: CieloError[];

  constructor(message: string, errors: CieloError[]) {
    super(message);
    this.name = "CieloApiError";
    this.errors = errors;
  }
}

// Singleton instance
export const cieloClient = new CieloClient();
