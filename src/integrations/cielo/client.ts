import { getServerUrl } from "./config";
import type {
  CreateSaleRequest,
  CreateRecurrentSaleRequest,
  SaleResponse,
  RecurrenceInterval,
  DeactivateRecurrenceResponse,
} from "./types";

export interface PixSaleResponse {
  success: boolean;
  paymentId: string;
  status: number;
  message: string;
  Payment?: {
    Status: number;
    QrCodeBase64Image?: string;
    QrCodeString?: string;
    PaymentId: string;
  };
}

export interface PixStatusResponse {
  success: boolean;
  paymentId?: string;
  status: number;
  message: string;
}

function isLocalhostUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  } catch {
    return false;
  }
}

class CieloClient {
  private localServerUrl: string;

  constructor() {
    const serverUrl = getServerUrl();
    this.localServerUrl = serverUrl;

    const serverConfigured = !!serverUrl;
    const serverIsLocalhost = isLocalhostUrl(serverUrl);

    if (!serverConfigured) {
      console.warn(
        "[Cielo] Nenhum servidor de pagamento configurado. " +
        "Defina VITE_LOCAL_SERVER_URL com a URL do backend de pagamento."
      );
    } else if (import.meta.env.PROD && serverIsLocalhost) {
      console.warn(
        "[Cielo] Servidor de pagamento aponta para localhost em produção. " +
        "Ajuste VITE_LOCAL_SERVER_URL para a URL pública do backend."
      );
    } else {
      console.info(`[Cielo] Usando proxy de pagamento: ${this.localServerUrl}`);
    }
  }

  private async localRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.localServerUrl) {
      throw new Error("Servidor de pagamento não configurado. Defina VITE_LOCAL_SERVER_URL.");
    }

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

  async createCreditCardSale(
    request: CreateSaleRequest
  ): Promise<SaleResponse> {
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

  // ==========================================
  // PAGAMENTO PIX
  // ==========================================

  async createPixSale(
    orderId: string,
    customer: { name: string; email?: string; cpf?: string },
    amountInCents: number
  ): Promise<PixSaleResponse> {
    return this.localRequest<PixSaleResponse>("/api/cielo/payment", {
      method: "POST",
      body: JSON.stringify({
        orderId,
        customer,
        amountInCents,
        paymentType: "pix",
      }),
    });
  }

  async getPixStatus(paymentId: string): Promise<PixStatusResponse> {
    return this.localRequest<PixStatusResponse>(`/api/cielo/payment/${paymentId}`);
  }

  async captureSale(
    paymentId: string,
    amount?: number
  ): Promise<SaleResponse> {
    return this.localRequest<SaleResponse>(`/api/cielo/payment/${paymentId}/capture`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  }

  async cancelSale(
    paymentId: string,
    amount?: number
  ): Promise<SaleResponse> {
    return this.localRequest<SaleResponse>(`/api/cielo/payment/${paymentId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  }

  async getSale(paymentId: string): Promise<SaleResponse> {
    return this.localRequest<SaleResponse>(`/api/cielo/payment/${paymentId}`);
  }

  async getSaleByOrderId(merchantOrderId: string): Promise<SaleResponse> {
    return this.localRequest<SaleResponse>(`/api/cielo/payment/order/${merchantOrderId}`);
  }

  // ==========================================
  // PAGAMENTO RECORRENTE (Planos)
  // ==========================================

  async createRecurrentSale(
    request: CreateRecurrentSaleRequest
  ): Promise<SaleResponse> {
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

  async getRecurrence(recurrentPaymentId: string): Promise<SaleResponse> {
    return this.localRequest<SaleResponse>(`/api/cielo/recurrence/${recurrentPaymentId}`);
  }

  async updateRecurrenceAmount(
    recurrentPaymentId: string,
    amount: number
  ): Promise<void> {
    await this.localRequest<void>(`/api/cielo/recurrence/${recurrentPaymentId}/amount`, {
      method: "PUT",
      body: JSON.stringify({ amount }),
    });
  }

  async updateRecurrenceNextDate(
    recurrentPaymentId: string,
    nextPaymentDate: string
  ): Promise<void> {
    await this.localRequest<void>(`/api/cielo/recurrence/${recurrentPaymentId}/next-date`, {
      method: "PUT",
      body: JSON.stringify({ nextPaymentDate }),
    });
  }

  async updateRecurrenceInterval(
    recurrentPaymentId: string,
    interval: RecurrenceInterval
  ): Promise<void> {
    await this.localRequest<void>(`/api/cielo/recurrence/${recurrentPaymentId}/interval`, {
      method: "PUT",
      body: JSON.stringify({ interval }),
    });
  }

  async updateRecurrenceEndDate(
    recurrentPaymentId: string,
    endDate: string
  ): Promise<void> {
    await this.localRequest<void>(`/api/cielo/recurrence/${recurrentPaymentId}/end-date`, {
      method: "PUT",
      body: JSON.stringify({ endDate }),
    });
  }

  async deactivateRecurrence(
    recurrentPaymentId: string
  ): Promise<DeactivateRecurrenceResponse> {
    return this.localRequest<DeactivateRecurrenceResponse>(`/api/cielo/recurrence/${recurrentPaymentId}/deactivate`, {
      method: "PUT",
    });
  }

  async reactivateRecurrence(
    recurrentPaymentId: string
  ): Promise<DeactivateRecurrenceResponse> {
    return this.localRequest<DeactivateRecurrenceResponse>(`/api/cielo/recurrence/${recurrentPaymentId}/reactivate`, {
      method: "PUT",
    });
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
