import { getAuthHeaders } from "@/lib/authHeaders";

export type TrackingStatus =
  | "invalid"
  | "pending_tracking"
  | "posted"
  | "in_transit"
  | "out_for_delivery"
  | "awaiting_pickup"
  | "delivered"
  | "exception"
  | "unavailable";

export interface TrackingEvent {
  code: string | null;
  type: string | null;
  description: string;
  createdAt: string | null;
  location: string | null;
  destination: string | null;
}

export interface OrderTrackingData {
  tracking_code?: string | null;
  tracking_carrier?: string | null;
  tracking_status?: TrackingStatus | string | null;
  tracking_status_label?: string | null;
  tracking_last_event_at?: string | null;
  tracking_last_checked_at?: string | null;
  tracking_estimated_delivery?: string | null;
  tracking_url?: string | null;
  tracking_events?: TrackingEvent[] | null;
  status?: string;
}

export interface TrackingUpdateResponse {
  success: boolean;
  configured: boolean;
  message: string;
  tracking: {
    carrier: "correios";
    trackingCode: string;
    trackingStatus: TrackingStatus;
    trackingStatusLabel: string;
    trackingLastEventAt: string | null;
    trackingEstimatedDelivery: string | null;
    trackingEvents: TrackingEvent[];
    trackingUrl: string;
    source: string;
  };
  order: OrderTrackingData;
}

const CHECK_DIGIT_WEIGHTS = [8, 6, 4, 2, 3, 5, 9, 7];

function getApiBaseUrl(): string {
  return import.meta.env.DEV
    ? ""
    : (import.meta.env.VITE_LOCAL_SERVER_URL || "");
}

export function normalizeCorreiosTrackingCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 13);
}

function calculateS10CheckDigit(serial: string): string {
  const sum = serial
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * CHECK_DIGIT_WEIGHTS[index], 0);
  const mod = sum % 11;
  const check = 11 - mod;
  if (check === 10) return "0";
  if (check === 11) return "5";
  return String(check);
}

export function validateCorreiosTrackingCode(value: string): {
  valid: boolean;
  code: string;
  message: string;
} {
  const code = normalizeCorreiosTrackingCode(value);

  if (!/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code)) {
    return {
      valid: false,
      code,
      message: "Use o formato AA123456785BR.",
    };
  }

  const expectedDigit = calculateS10CheckDigit(code.slice(2, 10));
  if (expectedDigit !== code[10]) {
    return {
      valid: false,
      code,
      message: "Dígito verificador inválido. Confira o código dos Correios.",
    };
  }

  return { valid: true, code, message: "Código Correios válido." };
}

export function getCorreiosTrackingUrl(code: string): string {
  return `https://rastreamento.correios.com.br/app/index.php?objetos=${encodeURIComponent(code)}`;
}

async function requestTrackingEndpoint(
  path: string,
  body?: Record<string, unknown>
): Promise<TrackingUpdateResponse> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result?.message || result?.error || "Falha ao atualizar rastreio");
  }

  return result as TrackingUpdateResponse;
}

export async function saveOrderTracking(
  orderId: string,
  trackingCode: string
): Promise<TrackingUpdateResponse> {
  return requestTrackingEndpoint(`/api/orders/${orderId}/tracking`, { trackingCode });
}

export async function refreshOrderTracking(orderId: string): Promise<TrackingUpdateResponse> {
  return requestTrackingEndpoint(`/api/orders/${orderId}/tracking/refresh`);
}
