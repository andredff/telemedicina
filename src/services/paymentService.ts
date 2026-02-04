import { cieloClient, CieloApiError } from "@/integrations/cielo";
import type {
  CardBrand,
  RecurrenceInterval,
  CreateSaleRequest,
  CreateRecurrentSaleRequest,
  SaleResponse,
  PaymentStatus,
} from "@/integrations/cielo";

export type { CardBrand };

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
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  pixExpiresAt?: string;
}

export interface PixPaymentRecord {
  status: PaymentStatus;
  amountInCents: number;
  orderId: string;
  pixQrCode: string;
  pixQrCodeUrl: string;
  pixExpiresAt: string;
}

// ==========================================
// Serviço de Pagamento de Medicamentos
// ==========================================

const pixPayments = new Map<string, PixPaymentRecord>();
const PIX_EXPIRATION_MINUTES = 30;

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

/**
 * Processa pagamento de medicamentos via PIX (stub/mock)
 */
export async function processMedicationPixPayment(
  orderId: string,
  customer: CustomerData,
  amountInCents: number
): Promise<PaymentResult> {
  const paymentId = `PIX-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000).toISOString();
  const pixPayload = buildPixPayload({ orderId, customer, amountInCents, expiresAt });
  const pixQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pixPayload)}`;

  pixPayments.set(paymentId, {
    status: 12,
    amountInCents,
    orderId,
    pixQrCode: pixPayload,
    pixQrCodeUrl,
    pixExpiresAt: expiresAt,
  });

  return {
    success: false,
    paymentId,
    status: 12,
    message: "PIX gerado. Aguardando pagamento.",
    pixQrCode: pixPayload,
    pixQrCodeUrl,
    pixExpiresAt: expiresAt,
  };
}

/**
 * Consulta status de um pagamento PIX (stub/mock)
 */
export async function getPixPaymentStatus(paymentId: string): Promise<PaymentResult> {
  const record = pixPayments.get(paymentId);

  if (!record) {
    return {
      success: false,
      status: 3,
      message: "Pagamento PIX não encontrado",
    };
  }

  const isExpired = new Date(record.pixExpiresAt).getTime() < Date.now();
  if (isExpired && record.status === 12) {
    record.status = 3;
  }

  return {
    success: record.status === 2,
    paymentId,
    status: record.status,
    message: record.status === 12
      ? "Pagamento PIX pendente"
      : record.status === 2
        ? "Pagamento PIX confirmado"
        : "Pagamento PIX expirado",
    pixQrCode: record.pixQrCode,
    pixQrCodeUrl: record.pixQrCodeUrl,
    pixExpiresAt: record.pixExpiresAt,
  };
}

/**
 * Confirma pagamento PIX (stub/mock)
 */
export async function confirmPixPayment(paymentId: string): Promise<PaymentResult> {
  const record = pixPayments.get(paymentId);

  if (!record) {
    return {
      success: false,
      status: 3,
      message: "Pagamento PIX não encontrado",
    };
  }

  const isExpired = new Date(record.pixExpiresAt).getTime() < Date.now();
  if (isExpired) {
    record.status = 3;
  } else {
    record.status = 2;
  }

  return {
    success: record.status === 2,
    paymentId,
    status: record.status,
    message: record.status === 2
      ? "Pagamento PIX confirmado"
      : "PIX expirado, gere um novo código",
    pixQrCode: record.pixQrCode,
    pixQrCodeUrl: record.pixQrCodeUrl,
    pixExpiresAt: record.pixExpiresAt,
  };
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

function buildPixPayload(params: {
  orderId: string;
  customer: CustomerData;
  amountInCents: number;
  expiresAt: string;
}): string {
  const amount = (params.amountInCents / 100).toFixed(2);
  const name = params.customer.name || "Cliente";
  return `NOVITA|ORDER:${params.orderId}|AMOUNT:${amount}|NAME:${name}|EXPIRES:${params.expiresAt}`;
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
