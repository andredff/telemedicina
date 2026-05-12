/**
 * ViaCEP integration + entrega própria (sem integração com Correios).
 */

import { supabase } from "@/integrations/supabase/client";

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

export interface ShippingOption {
  id: string;
  name: string;
  description: string;
  price: number;
  deadline: number;
  carrier: string;
  estimatedDelivery?: string | null;
}

export interface ShippingConfig {
  shippingCost: number;
  minDeliveryDays: number;
  maxDeliveryDays: number;
  freeShippingThreshold: number;
  enableFreeShipping: boolean;
}

const VIA_CEP_BASE_URL = "https://viacep.com.br/ws";

const DEFAULT_SHIPPING_CONFIG: ShippingConfig = {
  shippingCost: 0,
  minDeliveryDays: 1,
  maxDeliveryDays: 2,
  freeShippingThreshold: 0,
  enableFreeShipping: true,
};

export async function searchCep(cep: string): Promise<CorreiosAddress | null> {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) return null;

  try {
    const response = await fetch(`${VIA_CEP_BASE_URL}/${cleanCep}/json/`);
    if (!response.ok) return null;
    const data: ViaCepResponse = await response.json();
    if (data.erro) return null;

    return {
      street: data.logradouro || "",
      complement: data.complemento || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || "",
      zipCode: data.cep || cleanCep,
    };
  } catch {
    return null;
  }
}

export function formatCep(cep: string): string {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length === 8) {
    return `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;
  }
  return cep;
}

export function isValidCepFormat(cep: string): boolean {
  const cleanCep = cep.replace(/\D/g, "");
  return cleanCep.length === 8;
}

export async function getShippingConfig(): Promise<ShippingConfig> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'shipping')
      .maybeSingle();

    if (error || !data?.value) return DEFAULT_SHIPPING_CONFIG;

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

export async function calculateCartShipping(
  _zipCode: string,
  _itemCount: number,
  _cartValue: number
): Promise<{ options: ShippingOption[]; config: ShippingConfig }> {
  const config = await getShippingConfig();
  const option: ShippingOption = {
    id: 'entrega-propria',
    name: 'Entrega Própria',
    description: 'Entrega realizada pela equipe Novità — grátis',
    price: 0,
    deadline: config.maxDeliveryDays,
    carrier: 'Novità',
  };
  return { options: [option], config };
}

export function applyFreeShipping(
  _shippingPrice: number,
  _cartValue: number,
  _config?: ShippingConfig
): number {
  return 0;
}
