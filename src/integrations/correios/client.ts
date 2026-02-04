/**
 * ViaCEP API Integration
 * Free Brazilian postal code lookup service
 * Documentation: https://viacep.com.br/
 */

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

const VIA_CEP_BASE_URL = "https://viacep.com.br/ws";

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
