/**
 * Client da integração com Memed (Prescrição Digital)
 *
 * Requer credenciais configuradas: VITE_MEMED_API_KEY e VITE_MEMED_SECRET_TOKEN.
 */

import { isMemedConfigured, getMemedCredentials, getMemedUrls } from "./config";
import type {
  MemedSearchParams,
  MemedSearchResult,
  MemedPrescription,
} from "./types";
import { logger } from "@/lib/logger";

class MemedClient {
  constructor() {
    if (!isMemedConfigured()) {
      logger.warn("[Memed] Credenciais não configuradas. As chamadas à API falharão.");
    } else {
      logger.info("[Memed] Client inicializado com credenciais reais.");
    }
  }

  /**
   * Busca receita por token, ID ou CPF do paciente
   */
  async searchPrescription(params: MemedSearchParams): Promise<MemedSearchResult> {
    try {
      const creds = getMemedCredentials();
      const urls = getMemedUrls(creds.isSandbox);

      let endpoint = `${urls.baseUrl}/prescriptions`;
      const headers = {
        "Authorization": `Bearer ${creds.apiKey}`,
        "Content-Type": "application/json",
      };

      if (params.token) {
        endpoint += `/token/${params.token}`;
      } else if (params.prescriptionId) {
        endpoint += `/${params.prescriptionId}`;
      } else if (params.patientCpf) {
        endpoint += `?patient_cpf=${params.patientCpf.replace(/\D/g, "")}`;
      }

      const response = await fetch(endpoint, { headers });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            prescription: null,
            message: "Receita não encontrada.",
          };
        }
        throw new Error(`Memed API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        prescription: data.prescription || data,
      };
    } catch (error) {
      logger.error("[Memed] Erro ao buscar receita:", error);
      return {
        success: false,
        prescription: null,
        message: error instanceof Error ? error.message : "Erro ao buscar receita",
      };
    }
  }

  /**
   * Busca todas as receitas de um paciente
   */
  async getPatientPrescriptions(cpf: string): Promise<MemedPrescription[]> {
    try {
      const result = await this.searchPrescription({ patientCpf: cpf });
      return result.prescription ? [result.prescription] : [];
    } catch (error) {
      logger.error("[Memed] Erro ao buscar receitas do paciente:", error);
      return [];
    }
  }

  /**
   * Busca receita por ID
   */
  async getPrescriptionById(id: string): Promise<MemedSearchResult> {
    return this.searchPrescription({ prescriptionId: id });
  }

  /**
   * Busca receita por token
   */
  async getPrescriptionByToken(token: string): Promise<MemedSearchResult> {
    return this.searchPrescription({ token });
  }
}

export const memedClient = new MemedClient();
