/**
 * ViaCEP API Integration
 * Free Brazilian postal code lookup service
 * Documentation: https://viacep.com.br/
 */

import { supabase } from "@/integrations/supabase/client";
import { getAuthHeaders } from "@/lib/authHeaders";

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export interface CorreiosAddress {
  street: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

// Shipping types
export interface ShippingOption {
  id: string;
  name: string;
  description: string;
  price: number;
  deadline: number; // days
  carrier: string;
  serviceCode?: string;
  source?: "correios_api" | "admin_config" | "fallback";
  estimatedDelivery?: string | null;
}

export interface ShippingCalculationParams {
  zipCode: string; // Destination CEP
  weight: number; // Weight in kg
  length?: number; // Length in cm
  width?: number; // Width in cm
  height?: number; // Height in cm
  diameter?: number; // Diameter in cm (for rolls)
  value?: number; // Declared value for insurance
}

export interface PackageDimensions {
  weight: number;
  length: number;
  width: number;
  height: number;
}

const VIA_CEP_BASE_URL = "https://viacep.com.br/ws";

function getApiBaseUrl(): string {
  return import.meta.env.DEV
    ? ""
    : (import.meta.env.VITE_LOCAL_SERVER_URL || "");
}

// Average package dimensions for medications (in cm)
const MEDICATION_PACKAGE: PackageDimensions = {
  weight: 0.3, // kg per medication box
  length: 20,
  width: 15,
  height: 10,
};

/**
 * Search for a Brazilian address by CEP
 * @param cep - The postal code (can be with or without hyphen)
 * @returns The address data or null if not found
 */
export async function searchCep(cep: string): Promise<CorreiosAddress | null> {
  // Remove non-numeric characters from CEP
  const cleanCep = cep.replace(/\D/g, "");

  // Validate CEP format (8 digits)
  if (cleanCep.length !== 8) {
    console.error("Invalid CEP format: must have 8 digits");
    return null;
  }

  try {
    const response = await fetch(`${VIA_CEP_BASE_URL}/${cleanCep}/json/`);

    if (!response.ok) {
      console.error("CEP search failed with status:", response.status);
      return null;
    }

    const data: ViaCepResponse = await response.json();

    // ViaCEP returns erro: true when CEP is not found
    if (data.erro) {
      console.error("CEP not found");
      return null;
    }

    return {
      street: data.logradouro || "",
      complement: data.complemento || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || "",
      zipCode: data.cep || cleanCep,
    };
  } catch (error) {
    console.error("Error searching CEP:", error);
    return null;
  }
}

/**
 * Format CEP for display (add hyphen)
 * @param cep - The postal code without hyphen
 * @returns The formatted CEP with hyphen
 */
export function formatCep(cep: string): string {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length === 8) {
    return `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;
  }
  return cep;
}

/**
 * Validate Brazilian CEP format
 * @param cep - The postal code to validate
 * @returns True if valid format (8 digits, optionally with hyphen)
 */
export function isValidCepFormat(cep: string): boolean {
  const cleanCep = cep.replace(/\D/g, "");
  return cleanCep.length === 8;
}

/**
 * Calculate package dimensions based on item count
 * @param itemCount - Number of items in the cart
 * @returns Package dimensions
 */
export function calculatePackageDimensions(itemCount: number): PackageDimensions {
  // Medications typically come in small boxes
  // Add dimensions based on quantity (up to a reasonable limit)
  const baseMultiplier = Math.min(itemCount, 5); // Max 5x base dimensions
  
  return {
    weight: MEDICATION_PACKAGE.weight * itemCount,
    length: MEDICATION_PACKAGE.length * (1 + Math.floor(itemCount / 3) * 0.3),
    width: MEDICATION_PACKAGE.width * (1 + Math.floor(itemCount / 4) * 0.3),
    height: MEDICATION_PACKAGE.height,
  };
}

/**
 * Calculate distance-based shipping factor
 * Uses CEP prefix to estimate distance (simplified calculation)
 * @param originCep - Origin CEP (default: São Paulo 01000-000)
 * @param destinationCep - Destination CEP
 * @returns Distance factor (1 = local, higher = further)
 */
function calculateDistanceFactor(originCep: string, destinationCep: string): number {
  const originPrefix = parseInt(originCep.replace(/\D/g, "").slice(0, 3));
  const destPrefix = parseInt(destinationCep.replace(/\D/g, "").slice(0, 3));
  
  const diff = Math.abs(originPrefix - destPrefix);
  
  // Zone-based pricing
  if (diff <= 10) return 1.0; // Same region
  if (diff <= 50) return 1.2; // Neighboring region
  if (diff <= 150) return 1.4; // Same state/region
  if (diff <= 300) return 1.6; // Far in same region
  return 1.8; // Different region
}

/**
 * Simulate Correios shipping calculation
 * Note: This is a simulation for demonstration. Real implementation requires
 * server-side SIGEP Web API with proper credentials.
 * 
 * @param params - Shipping calculation parameters
 * @param originCep - Origin CEP (default: São Paulo)
 * @returns Array of shipping options with prices and deadlines
 */
export async function calculateShipping(
  params: ShippingCalculationParams,
  originCep: string = "01000000"
): Promise<ShippingOption[]> {
  const { zipCode, weight, length, width, height, value } = params;
  
  if (!isValidCepFormat(zipCode)) {
    console.error("Invalid destination CEP format");
    return [];
  }

  const distanceFactor = calculateDistanceFactor(originCep, zipCode);
  
  // Base rates (simulation based on Correios price table 2024)
  const baseRate = weight <= 0.5 ? 22.90 : weight <= 1 ? 27.90 : 32.90;
  const insuranceRate = value ? Math.min(value * 0.01, 20) : 0; // 1% insurance, max R$20
  
  const distanceSurcharge = (baseRate + insuranceRate) * (distanceFactor - 1);
  const subtotal = baseRate + insuranceRate + distanceSurcharge;

  // Generate shipping options
  const shippingOptions: ShippingOption[] = [
    {
      id: "pac",
      name: "PAC",
      description: "Entrega Econômica",
      price: Math.round(subtotal * 100) / 100,
      deadline: Math.round(5 * distanceFactor),
      carrier: "Correios",
    },
    {
      id: "sedex",
      name: "SEDEX",
      description: "Entrega Expressa",
      price: Math.round(subtotal * 1.8 * 100) / 100,
      deadline: Math.round(2 * distanceFactor),
      carrier: "Correios",
    },
    {
      id: "sedex10",
      name: "SEDEX 10",
      description: "Entrega até 10h",
      price: Math.round(subtotal * 2.5 * 100) / 100,
      deadline: 1,
      carrier: "Correios",
    },
  ];

  // Filter out unrealistic options
  return shippingOptions.filter(option => option.deadline <= 15);
}

/**
 * Get a single shipping quote for the default option
 * @param params - Shipping calculation parameters
 * @returns The cheapest shipping option
 */
export async function getShippingQuote(
  params: ShippingCalculationParams
): Promise<ShippingOption | null> {
  const options = await calculateShipping(params);
  return options.length > 0 ? options[0] : null;
}

/**
 * Calculate shipping for a cart with multiple items
 * @param zipCode - Destination CEP
 * @param itemCount - Number of items in cart
 * @param cartValue - Total cart value
 * @returns Array of shipping options
 */

// Shipping configuration from admin settings
export interface ShippingConfig {
  shippingCost: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  freeShippingThreshold: number;
  enableFreeShipping: boolean;
}

const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  shippingCost: 5.90,
  minDeliveryDays: 1,
  maxDeliveryDays: 2,
  freeShippingThreshold: 100,
  enableFreeShipping: true,
};

/**
 * Fetch shipping configuration from admin settings (site_settings table).
 * Falls back to defaults if not configured.
 */
export async function getShippingConfig(): Promise<ShippingConfig> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'shipping')
      .maybeSingle();

    if (error || !data?.value) {
      return DEFAULT_SHIPPING_CONFIG;
    }

    const value = data.value as Record<string, unknown>;
    return {
      shippingCost: typeof value.shippingCost === 'number' ? value.shippingCost : DEFAULT_SHIPPING_CONFIG.shippingCost,
      minDeliveryDays: typeof value.minDeliveryDays === 'number' ? value.minDeliveryDays : DEFAULT_SHIPPING_CONFIG.minDeliveryDays,
      maxDeliveryDays: typeof value.maxDeliveryDays === 'number' ? value.maxDeliveryDays : DEFAULT_SHIPPING_CONFIG.maxDeliveryDays,
      freeShippingThreshold: typeof value.freeShippingThreshold === 'number' ? value.freeShippingThreshold : DEFAULT_SHIPPING_CONFIG.freeShippingThreshold,
      enableFreeShipping: typeof value.enableFreeShipping === 'boolean' ? value.enableFreeShipping : DEFAULT_SHIPPING_CONFIG.enableFreeShipping,
    };
  } catch {
    return DEFAULT_SHIPPING_CONFIG;
  }
}

// Custom shipping for medication: "Entrega Própria" with dynamic config from admin
export async function calculateCartShipping(
  zipCode: string,
  itemCount: number,
  cartValue: number
): Promise<{ options: ShippingOption[]; config: ShippingConfig }> {
  const config = await getShippingConfig();
  const fallbackOption: ShippingOption = {
    id: 'entrega-propria',
    name: 'Entrega Própria',
    description: 'Entrega realizada pela equipe Novità',
    price: config.shippingCost,
    deadline: config.maxDeliveryDays,
    carrier: 'Novità',
    source: 'admin_config',
  };

  if (!isValidCepFormat(zipCode)) {
    return { options: [fallbackOption], config };
  }

  try {
    const dimensions = calculatePackageDimensions(Math.max(itemCount, 1));
    const authHeaders = await getAuthHeaders();
    const response = await fetch(`${getApiBaseUrl()}/api/correios/shipping-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        destinationCep: zipCode,
        itemCount,
        cartValue,
        ...dimensions,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(result.options) && result.options.length > 0) {
      return {
        options: result.options as ShippingOption[],
        config,
      };
    }
  } catch {
    // Mantém o checkout funcionando com entrega própria quando o backend/API externa não estiver disponível.
  }

  return {
    options: [fallbackOption],
    config,
  };
}

/**
 * Check if shipping is free based on cart value and config
 */
export function applyFreeShipping(
  shippingPrice: number,
  cartValue: number,
  config?: ShippingConfig
): number {
  const cfg = config || DEFAULT_SHIPPING_CONFIG;
  if (!cfg.enableFreeShipping) return shippingPrice;
  return cartValue >= cfg.freeShippingThreshold ? 0 : shippingPrice;
}
