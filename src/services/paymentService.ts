import { cieloClient, CieloApiError } from "@/integrations/cielo";
import type {
  CardBrand,
  RecurrenceInterval,
  CreateSaleRequest,
  CreateRecurrentSaleRequest,
  SaleResponse,
  PaymentStatus,
} from "@/integrations/cielo";

// ==========================================
// Tipos do Serviço de Pagamento
// ==========================================

export interface CardData {
  cardNumber: string;
  holder: string;
  expirationDate: string; // MM/YYYY
  securityCode: string;
  brand: CardBrand;
}

export interface CustomerData {
  name: string;
  email?: string;
  cpf?: string;
  birthdate?: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    district: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  recurrentPaymentId?: string;
  authorizationCode?: string;
  status: PaymentStatus;
  message: string;
  proofOfSale?: string;
}

// ==========================================
// Serviço de Pagamento de Medicamentos
// ==========================================

/**
 * Processa pagamento de medicamentos (transação única)
 */
export async function processMedicationPayment(
  orderId: string,
  customer: CustomerData,
  card: CardData,
  amountInCents: number,
  installments: number = 1
): Promise<PaymentResult> {
  const request: CreateSaleRequest = {
    MerchantOrderId: orderId,
    Customer: {
      Name: customer.name,
      Email: customer.email,
      Identity: customer.cpf,
      IdentityType: customer.cpf ? "CPF" : undefined,
      Birthdate: customer.birthdate,
      Address: customer.address
        ? {
            Street: customer.address.street,
            Number: customer.address.number,
            Complement: customer.address.complement,
            District: customer.address.district,
            City: customer.address.city,
            State: customer.address.state,
            ZipCode: customer.address.zipCode,
            Country: "BRA",
          }
        : undefined,
    },
    Payment: {
      Type: "CreditCard",
      Amount: amountInCents,
      Installments: installments,
      Capture: true, // Captura automática
      SoftDescriptor: "NOVITA SAUDE", // Aparece na fatura
      CreditCard: {
        CardNumber: card.cardNumber.replace(/\s/g, ""),
        Holder: card.holder,
        ExpirationDate: card.expirationDate,
        SecurityCode: card.securityCode,
        Brand: card.brand,
      },
    },
  };

  try {
    const response = await cieloClient.createCreditCardSale(request);
    return mapPaymentResponse(response);
  } catch (error) {
    return handlePaymentError(error);
  }
}

// ==========================================
// Serviço de Assinatura de Planos (Recorrência)
// ==========================================

/**
 * Cria uma assinatura recorrente para um plano
 */
export async function createSubscription(
  subscriptionId: string,
  customer: CustomerData,
  card: CardData,
  monthlyAmountInCents: number,
  interval: RecurrenceInterval = "Monthly",
  startDate?: string, // YYYY-MM-DD
  endDate?: string    // YYYY-MM-DD
): Promise<PaymentResult> {
  const request: CreateRecurrentSaleRequest = {
    MerchantOrderId: subscriptionId,
    Customer: {
      Name: customer.name,
      Email: customer.email,
      Identity: customer.cpf,
      IdentityType: customer.cpf ? "CPF" : undefined,
    },
    Payment: {
      Type: "CreditCard",
      Amount: monthlyAmountInCents,
      Installments: 1,
      Capture: true,
      SoftDescriptor: "NOVITA PLANO",
      CreditCard: {
        CardNumber: card.cardNumber.replace(/\s/g, ""),
        Holder: card.holder,
        ExpirationDate: card.expirationDate,
        SecurityCode: card.securityCode,
        Brand: card.brand,
        SaveCard: true, // Tokeniza o cartão para cobranças futuras
      },
      RecurrentPayment: {
        AuthorizeNow: true, // Cobra imediatamente
        Interval: interval,
        StartDate: startDate,
        EndDate: endDate,
      },
    },
  };

  try {
    const response = await cieloClient.createRecurrentSale(request);
    return mapPaymentResponse(response);
  } catch (error) {
    return handlePaymentError(error);
  }
}

/**
 * Cancela uma assinatura
 */
export async function cancelSubscription(
  recurrentPaymentId: string
): Promise<PaymentResult> {
  try {
    const response = await cieloClient.deactivateRecurrence(recurrentPaymentId);
    return {
      success: response.Status === 0,
      status: response.Status as PaymentStatus,
      message: response.Status === 0
        ? "Assinatura cancelada com sucesso"
        : "Não foi possível cancelar a assinatura",
      recurrentPaymentId: response.RecurrentPaymentId,
    };
  } catch (error) {
    return handlePaymentError(error);
  }
}

/**
 * Reativa uma assinatura cancelada
 */
export async function reactivateSubscription(
  recurrentPaymentId: string
): Promise<PaymentResult> {
  try {
    const response = await cieloClient.reactivateRecurrence(recurrentPaymentId);
    return {
      success: true,
      status: response.Status as PaymentStatus,
      message: "Assinatura reativada com sucesso",
      recurrentPaymentId: response.RecurrentPaymentId,
    };
  } catch (error) {
    return handlePaymentError(error);
  }
}

/**
 * Atualiza o valor da assinatura (para upgrade/downgrade de plano)
 */
export async function updateSubscriptionAmount(
  recurrentPaymentId: string,
  newAmountInCents: number
): Promise<PaymentResult> {
  try {
    await cieloClient.updateRecurrenceAmount(recurrentPaymentId, newAmountInCents);
    return {
      success: true,
      status: 20, // Scheduled
      message: "Valor da assinatura atualizado com sucesso",
      recurrentPaymentId,
    };
  } catch (error) {
    return handlePaymentError(error);
  }
}

/**
 * Atualiza o intervalo da assinatura
 */
export async function updateSubscriptionInterval(
  recurrentPaymentId: string,
  interval: RecurrenceInterval
): Promise<PaymentResult> {
  try {
    await cieloClient.updateRecurrenceInterval(recurrentPaymentId, interval);
    return {
      success: true,
      status: 20,
      message: "Intervalo da assinatura atualizado com sucesso",
      recurrentPaymentId,
    };
  } catch (error) {
    return handlePaymentError(error);
  }
}

// ==========================================
// Consultas
// ==========================================

/**
 * Consulta status de um pagamento
 */
export async function getPaymentStatus(paymentId: string): Promise<PaymentResult> {
  try {
    const response = await cieloClient.getSale(paymentId);
    return mapPaymentResponse(response);
  } catch (error) {
    return handlePaymentError(error);
  }
}

/**
 * Consulta status de uma recorrência
 */
export async function getSubscriptionStatus(
  recurrentPaymentId: string
): Promise<PaymentResult> {
  try {
    const response = await cieloClient.getRecurrence(recurrentPaymentId);
    return mapPaymentResponse(response);
  } catch (error) {
    return handlePaymentError(error);
  }
}

// ==========================================
// Helpers
// ==========================================

function mapPaymentResponse(response: SaleResponse): PaymentResult {
  const payment = response.Payment;
  const isSuccess = payment.Status === 1 || payment.Status === 2;

  return {
    success: isSuccess,
    paymentId: payment.PaymentId,
    recurrentPaymentId: payment.RecurrentPayment?.RecurrentPaymentId,
    authorizationCode: payment.AuthorizationCode,
    status: payment.Status,
    message: payment.ReturnMessage || getStatusMessage(payment.Status),
    proofOfSale: payment.ProofOfSale,
  };
}

function getStatusMessage(status: PaymentStatus): string {
  const messages: Record<PaymentStatus, string> = {
    0: "Transação não finalizada",
    1: "Transação autorizada",
    2: "Pagamento confirmado",
    3: "Transação negada",
    10: "Transação cancelada",
    11: "Transação estornada",
    12: "Transação pendente",
    13: "Transação abortada",
    20: "Transação agendada",
  };
  return messages[status] || "Status desconhecido";
}

function handlePaymentError(error: unknown): PaymentResult {
  if (error instanceof CieloApiError) {
    return {
      success: false,
      status: 3,
      message: error.message || "Erro ao processar pagamento",
    };
  }

  return {
    success: false,
    status: 3,
    message: error instanceof Error ? error.message : "Erro desconhecido",
  };
}

// ==========================================
// Utilitários
// ==========================================

/**
 * Converte valor em reais para centavos
 */
export function toCents(valueInReais: number): number {
  return Math.round(valueInReais * 100);
}

/**
 * Converte centavos para reais
 */
export function toReais(valueInCents: number): number {
  return valueInCents / 100;
}

/**
 * Detecta a bandeira do cartão pelo número
 */
export function detectCardBrand(cardNumber: string): CardBrand | null {
  const number = cardNumber.replace(/\s/g, "");

  if (/^4/.test(number)) return "Visa";
  if (/^5[1-5]/.test(number)) return "Master";
  if (/^3[47]/.test(number)) return "Amex";
  if (/^6(?:011|5)/.test(number)) return "Discover";
  if (/^(?:2131|1800|35)/.test(number)) return "JCB";
  if (/^3(?:0[0-5]|[68])/.test(number)) return "Diners";
  if (/^636368|636369|636297|504175|438935|40117[8-9]|45763[1-2]|50(4175|6699|67[0-6][0-9]|677[0-8]|9[0-8][0-9]{2}|99[0-8][0-9]|999[0-9])/.test(number)) return "Elo";
  if (/^(606282|3841)/.test(number)) return "Hipercard";

  return null;
}

/**
 * Formata número do cartão para exibição (mascarado)
 */
export function maskCardNumber(cardNumber: string): string {
  const number = cardNumber.replace(/\s/g, "");
  if (number.length < 10) return cardNumber;

  const first = number.slice(0, 6);
  const last = number.slice(-4);
  return `${first}******${last}`;
}
