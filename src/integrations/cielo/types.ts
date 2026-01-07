// Cielo E-commerce API Types

export type CardBrand =
  | "Visa"
  | "Master"
  | "Amex"
  | "Elo"
  | "Hipercard"
  | "Diners"
  | "Discover"
  | "JCB";

export type PaymentStatus =
  | 0  // NotFinished
  | 1  // Authorized
  | 2  // PaymentConfirmed
  | 3  // Denied
  | 10 // Voided
  | 11 // Refunded
  | 12 // Pending
  | 13 // Aborted
  | 20; // Scheduled

export type RecurrenceInterval =
  | "Monthly"
  | "Bimonthly"
  | "Quarterly"
  | "SemiAnnual"
  | "Annual";

export interface CieloConfig {
  merchantId: string;
  merchantKey: string;
  isSandbox: boolean;
}

export interface Customer {
  Name: string;
  Email?: string;
  Identity?: string; // CPF/CNPJ
  IdentityType?: "CPF" | "CNPJ";
  Birthdate?: string;
  Address?: Address;
  DeliveryAddress?: Address;
}

export interface Address {
  Street: string;
  Number: string;
  Complement?: string;
  District: string;
  City: string;
  State: string;
  ZipCode: string;
  Country?: string;
}

export interface CreditCard {
  CardNumber: string;
  Holder: string;
  ExpirationDate: string; // MM/YYYY
  SecurityCode: string;
  Brand: CardBrand;
  SaveCard?: boolean;
  CardToken?: string;
}

export interface RecurrentPayment {
  AuthorizeNow: boolean;
  StartDate?: string; // YYYY-MM-DD
  EndDate?: string;   // YYYY-MM-DD
  Interval: RecurrenceInterval;
}

export interface Payment {
  Type: "CreditCard" | "DebitCard" | "Pix" | "Boleto";
  Amount: number; // Em centavos (R$ 15,70 = 1570)
  Installments: number;
  Capture?: boolean;
  SoftDescriptor?: string; // Texto na fatura do cartão (max 13 chars)
  CreditCard?: CreditCard;
  Recurrent?: boolean; // Para recorrência própria
  RecurrentPayment?: RecurrentPayment; // Para recorrência programada
}

// Request Types
export interface CreateSaleRequest {
  MerchantOrderId: string;
  Customer: Customer;
  Payment: Payment;
}

export interface CreateRecurrentSaleRequest {
  MerchantOrderId: string;
  Customer: Customer;
  Payment: Payment & {
    RecurrentPayment: RecurrentPayment;
  };
}

// Response Types
export interface CreditCardResponse {
  CardNumber: string; // Masked
  Holder: string;
  ExpirationDate: string;
  Brand: CardBrand;
  CardToken?: string;
}

export interface PaymentResponse {
  ServiceTaxAmount: number;
  Installments: number;
  Interest: string;
  Capture: boolean;
  Authenticate: boolean;
  CreditCard: CreditCardResponse;
  ProofOfSale: string;
  Tid: string;
  AuthorizationCode: string;
  PaymentId: string;
  Type: string;
  Amount: number;
  ReceivedDate: string;
  Currency: string;
  Country: string;
  ReturnCode: string;
  ReturnMessage: string;
  Status: PaymentStatus;
  RecurrentPayment?: RecurrentPaymentResponse;
  Links: Link[];
}

export interface RecurrentPaymentResponse {
  RecurrentPaymentId: string;
  NextRecurrency: string;
  StartDate: string;
  EndDate: string;
  Interval: RecurrenceInterval;
  Link: Link;
  AuthorizeNow: boolean;
}

export interface SaleResponse {
  MerchantOrderId: string;
  Customer: Customer;
  Payment: PaymentResponse;
}

export interface Link {
  Method: "GET" | "PUT" | "POST";
  Rel: string;
  Href: string;
}

export interface CieloError {
  Code: string;
  Message: string;
}

// Recurrence Management Types
export interface UpdateRecurrenceAmountRequest {
  Amount: number;
}

export interface UpdateRecurrenceDateRequest {
  NextPaymentDate: string; // YYYY-MM-DD
}

export interface UpdateRecurrenceIntervalRequest {
  Interval: RecurrenceInterval;
}

export interface DeactivateRecurrenceResponse {
  RecurrentPaymentId: string;
  Status: number;
}
