/**
 * Mock Client para Cielo API
 * Simula comportamento da API para testes locais sem credenciais
 */

import type {
  CreateSaleRequest,
  CreateRecurrentSaleRequest,
  SaleResponse,
  DeactivateRecurrenceResponse,
  RecurrenceInterval,
  PaymentStatus,
} from "./types";

// Simula delay de rede
const simulateNetworkDelay = () =>
  new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 700));

// Gera UUID
const generateUUID = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

// Gera código de autorização
const generateAuthCode = () =>
  Math.random().toString().slice(2, 8);

// Gera número de comprovante
const generateProofOfSale = () =>
  Math.random().toString().slice(2, 8);

/**
 * Determina o resultado da transação baseado no último dígito do cartão
 * Simula o comportamento real do sandbox da Cielo
 */
function getTransactionResult(cardNumber: string): {
  status: PaymentStatus;
  returnCode: string;
  returnMessage: string;
} {
  const lastDigit = cardNumber.replace(/\s/g, "").slice(-1);

  switch (lastDigit) {
    case "0":
    case "1":
    case "4":
      return {
        status: 2, // PaymentConfirmed
        returnCode: "00",
        returnMessage: "Transação autorizada",
      };
    case "2":
      return {
        status: 3, // Denied
        returnCode: "05",
        returnMessage: "Não autorizado",
      };
    case "3":
      return {
        status: 3,
        returnCode: "57",
        returnMessage: "Cartão expirado",
      };
    case "5":
      return {
        status: 3,
        returnCode: "78",
        returnMessage: "Cartão bloqueado",
      };
    case "6":
      return {
        status: 3,
        returnCode: "99",
        returnMessage: "Timeout na operação",
      };
    case "7":
      return {
        status: 3,
        returnCode: "77",
        returnMessage: "Cartão cancelado",
      };
    case "8":
      return {
        status: 3,
        returnCode: "70",
        returnMessage: "Problemas com o cartão",
      };
    case "9":
      // Aleatório
      return Math.random() > 0.5
        ? {
            status: 2,
            returnCode: "00",
            returnMessage: "Transação autorizada",
          }
        : {
            status: 3,
            returnCode: "05",
            returnMessage: "Não autorizado",
          };
    default:
      return {
        status: 2,
        returnCode: "00",
        returnMessage: "Transação autorizada",
      };
  }
}

// Armazenamento em memória para simular persistência
const mockDatabase = {
  sales: new Map<string, SaleResponse>(),
  recurrences: new Map<string, { active: boolean; amount: number; interval: RecurrenceInterval; nextDate: string }>(),
};

class CieloMockClient {
  async createCreditCardSale(request: CreateSaleRequest): Promise<SaleResponse> {
    await simulateNetworkDelay();

    const cardNumber = request.Payment.CreditCard?.CardNumber || "";
    const result = getTransactionResult(cardNumber);
    const paymentId = generateUUID();

    const response: SaleResponse = {
      MerchantOrderId: request.MerchantOrderId,
      Customer: request.Customer,
      Payment: {
        ServiceTaxAmount: 0,
        Installments: request.Payment.Installments,
        Interest: "ByMerchant",
        Capture: request.Payment.Capture ?? true,
        Authenticate: false,
        CreditCard: {
          CardNumber: cardNumber.slice(0, 6) + "******" + cardNumber.slice(-4),
          Holder: request.Payment.CreditCard?.Holder || "",
          ExpirationDate: request.Payment.CreditCard?.ExpirationDate || "",
          Brand: request.Payment.CreditCard?.Brand || "Visa",
        },
        ProofOfSale: generateProofOfSale(),
        Tid: generateUUID(),
        AuthorizationCode: result.status === 2 ? generateAuthCode() : "",
        PaymentId: paymentId,
        Type: "CreditCard",
        Amount: request.Payment.Amount,
        ReceivedDate: new Date().toISOString(),
        Currency: "BRL",
        Country: "BRA",
        ReturnCode: result.returnCode,
        ReturnMessage: result.returnMessage,
        Status: result.status,
        Links: [
          {
            Method: "GET",
            Rel: "self",
            Href: `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales/${paymentId}`,
          },
        ],
      },
    };

    mockDatabase.sales.set(paymentId, response);
    return response;
  }

  async createRecurrentSale(request: CreateRecurrentSaleRequest): Promise<SaleResponse> {
    await simulateNetworkDelay();

    const cardNumber = request.Payment.CreditCard?.CardNumber || "";
    const result = getTransactionResult(cardNumber);
    const paymentId = generateUUID();
    const recurrentPaymentId = generateUUID();

    // Calcula próxima data de cobrança
    const interval = request.Payment.RecurrentPayment.Interval;
    const nextDate = new Date();
    switch (interval) {
      case "Monthly":
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case "Bimonthly":
        nextDate.setMonth(nextDate.getMonth() + 2);
        break;
      case "Quarterly":
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case "SemiAnnual":
        nextDate.setMonth(nextDate.getMonth() + 6);
        break;
      case "Annual":
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    const response: SaleResponse = {
      MerchantOrderId: request.MerchantOrderId,
      Customer: request.Customer,
      Payment: {
        ServiceTaxAmount: 0,
        Installments: 1,
        Interest: "ByMerchant",
        Capture: true,
        Authenticate: false,
        CreditCard: {
          CardNumber: cardNumber.slice(0, 6) + "******" + cardNumber.slice(-4),
          Holder: request.Payment.CreditCard?.Holder || "",
          ExpirationDate: request.Payment.CreditCard?.ExpirationDate || "",
          Brand: request.Payment.CreditCard?.Brand || "Visa",
          CardToken: request.Payment.CreditCard?.SaveCard ? generateUUID() : undefined,
        },
        ProofOfSale: generateProofOfSale(),
        Tid: generateUUID(),
        AuthorizationCode: result.status === 2 ? generateAuthCode() : "",
        PaymentId: paymentId,
        Type: "CreditCard",
        Amount: request.Payment.Amount,
        ReceivedDate: new Date().toISOString(),
        Currency: "BRL",
        Country: "BRA",
        ReturnCode: result.returnCode,
        ReturnMessage: result.returnMessage,
        Status: result.status,
        RecurrentPayment: {
          RecurrentPaymentId: recurrentPaymentId,
          NextRecurrency: nextDate.toISOString().split("T")[0],
          StartDate: request.Payment.RecurrentPayment.StartDate || new Date().toISOString().split("T")[0],
          EndDate: request.Payment.RecurrentPayment.EndDate || "",
          Interval: interval,
          AuthorizeNow: request.Payment.RecurrentPayment.AuthorizeNow,
          Link: {
            Method: "GET",
            Rel: "recurrentPayment",
            Href: `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/RecurrentPayment/${recurrentPaymentId}`,
          },
        },
        Links: [
          {
            Method: "GET",
            Rel: "self",
            Href: `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales/${paymentId}`,
          },
        ],
      },
    };

    mockDatabase.sales.set(paymentId, response);
    mockDatabase.recurrences.set(recurrentPaymentId, {
      active: result.status === 2,
      amount: request.Payment.Amount,
      interval: interval,
      nextDate: nextDate.toISOString().split("T")[0],
    });

    return response;
  }

  async captureSale(paymentId: string, amount?: number): Promise<SaleResponse> {
    await simulateNetworkDelay();

    const sale = mockDatabase.sales.get(paymentId);
    if (!sale) {
      throw new Error("Transação não encontrada");
    }

    sale.Payment.Status = 2;
    sale.Payment.Amount = amount || sale.Payment.Amount;
    return sale;
  }

  async cancelSale(paymentId: string, amount?: number): Promise<SaleResponse> {
    await simulateNetworkDelay();

    const sale = mockDatabase.sales.get(paymentId);
    if (!sale) {
      throw new Error("Transação não encontrada");
    }

    sale.Payment.Status = 10; // Voided
    return sale;
  }

  async getSale(paymentId: string): Promise<SaleResponse> {
    await simulateNetworkDelay();

    const sale = mockDatabase.sales.get(paymentId);
    if (!sale) {
      throw new Error("Transação não encontrada");
    }

    return sale;
  }

  async getSaleByOrderId(merchantOrderId: string): Promise<SaleResponse> {
    await simulateNetworkDelay();

    for (const sale of mockDatabase.sales.values()) {
      if (sale.MerchantOrderId === merchantOrderId) {
        return sale;
      }
    }

    throw new Error("Transação não encontrada");
  }

  async getRecurrence(recurrentPaymentId: string): Promise<SaleResponse> {
    await simulateNetworkDelay();

    for (const sale of mockDatabase.sales.values()) {
      if (sale.Payment.RecurrentPayment?.RecurrentPaymentId === recurrentPaymentId) {
        return sale;
      }
    }

    throw new Error("Recorrência não encontrada");
  }

  async updateRecurrenceAmount(recurrentPaymentId: string, amount: number): Promise<void> {
    await simulateNetworkDelay();

    const recurrence = mockDatabase.recurrences.get(recurrentPaymentId);
    if (!recurrence) {
      throw new Error("Recorrência não encontrada");
    }

    recurrence.amount = amount;
  }

  async updateRecurrenceNextDate(recurrentPaymentId: string, nextPaymentDate: string): Promise<void> {
    await simulateNetworkDelay();

    const recurrence = mockDatabase.recurrences.get(recurrentPaymentId);
    if (!recurrence) {
      throw new Error("Recorrência não encontrada");
    }

    recurrence.nextDate = nextPaymentDate;
  }

  async updateRecurrenceInterval(recurrentPaymentId: string, interval: RecurrenceInterval): Promise<void> {
    await simulateNetworkDelay();

    const recurrence = mockDatabase.recurrences.get(recurrentPaymentId);
    if (!recurrence) {
      throw new Error("Recorrência não encontrada");
    }

    recurrence.interval = interval;
  }

  async updateRecurrenceEndDate(recurrentPaymentId: string, endDate: string): Promise<void> {
    await simulateNetworkDelay();
    // Mock implementation - just validates the recurrence exists
    const recurrence = mockDatabase.recurrences.get(recurrentPaymentId);
    if (!recurrence) {
      throw new Error("Recorrência não encontrada");
    }
  }

  async deactivateRecurrence(recurrentPaymentId: string): Promise<DeactivateRecurrenceResponse> {
    await simulateNetworkDelay();

    const recurrence = mockDatabase.recurrences.get(recurrentPaymentId);
    if (!recurrence) {
      throw new Error("Recorrência não encontrada");
    }

    recurrence.active = false;

    return {
      RecurrentPaymentId: recurrentPaymentId,
      Status: 0,
    };
  }

  async reactivateRecurrence(recurrentPaymentId: string): Promise<DeactivateRecurrenceResponse> {
    await simulateNetworkDelay();

    const recurrence = mockDatabase.recurrences.get(recurrentPaymentId);
    if (!recurrence) {
      throw new Error("Recorrência não encontrada");
    }

    recurrence.active = true;

    return {
      RecurrentPaymentId: recurrentPaymentId,
      Status: 1,
    };
  }
}

export const cieloMockClient = new CieloMockClient();
