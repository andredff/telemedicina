/**
 * Mock client para Memed - usado quando credenciais não estão configuradas.
 * Simula a API do Memed com dados realistas para desenvolvimento e testes.
 */

import type {
  MemedPrescription,
  MemedSearchParams,
  MemedSearchResult,
} from "./types";

const MOCK_DELAY_MS = 500;

const mockPrescriptions: MemedPrescription[] = [
  {
    id: "RX-2024-001",
    token: "TKN-A1B2C3",
    patient: {
      id: "pat-001",
      name: "Maria Silva Santos",
      cpf: "123.456.789-00",
      email: "maria@email.com",
      phone: "(61) 99999-1234",
    },
    doctor: {
      id: "doc-001",
      name: "Dr. João Carlos Oliveira",
      crm: "CRM/SP 123456",
      specialty: "Clínico Geral",
    },
    medications: [
      {
        id: "med-001",
        name: "Losartana Potássica 50mg",
        dosage: "50mg",
        quantity: 30,
        frequency: "1 comprimido, 1x ao dia",
        duration: "30 dias",
        active_ingredient: "Losartana Potássica",
        manufacturer: "EMS",
        ean: "7896004730516",
      },
      {
        id: "med-002",
        name: "Metformina 850mg",
        dosage: "850mg",
        quantity: 60,
        frequency: "1 comprimido, 2x ao dia",
        duration: "30 dias",
        active_ingredient: "Cloridrato de Metformina",
        manufacturer: "Merck",
        ean: "7896004730523",
      },
      {
        id: "med-003",
        name: "Atorvastatina 20mg",
        dosage: "20mg",
        quantity: 30,
        frequency: "1 comprimido, 1x ao dia (à noite)",
        duration: "30 dias",
        active_ingredient: "Atorvastatina Cálcica",
        manufacturer: "Pfizer",
        ean: "7896004730530",
      },
    ],
    status: "active",
    created_at: "2024-01-15T10:00:00Z",
    expires_at: "2024-07-15T23:59:59Z",
  },
  {
    id: "RX-2024-002",
    token: "TKN-D4E5F6",
    patient: {
      id: "pat-001",
      name: "Maria Silva Santos",
      cpf: "123.456.789-00",
      email: "maria@email.com",
    },
    doctor: {
      id: "doc-002",
      name: "Dra. Ana Paula Martins",
      crm: "CRM/SP 789012",
      specialty: "Gastroenterologia",
    },
    medications: [
      {
        id: "med-004",
        name: "Omeprazol 20mg",
        dosage: "20mg",
        quantity: 14,
        frequency: "1 cápsula, 1x ao dia (em jejum)",
        duration: "14 dias",
        active_ingredient: "Omeprazol",
        manufacturer: "Medley",
        ean: "7896004730547",
      },
      {
        id: "med-005",
        name: "Dipirona Sódica 500mg",
        dosage: "500mg",
        quantity: 20,
        frequency: "1 comprimido, a cada 6 horas (se necessário)",
        duration: "7 dias",
        active_ingredient: "Dipirona Sódica",
        manufacturer: "Sanofi",
        ean: "7896004730554",
      },
    ],
    status: "active",
    created_at: "2024-01-10T14:30:00Z",
    expires_at: "2024-07-10T23:59:59Z",
  },
  {
    id: "RX-2024-003",
    token: "TKN-G7H8I9",
    patient: {
      id: "pat-001",
      name: "Maria Silva Santos",
      cpf: "123.456.789-00",
    },
    doctor: {
      id: "doc-003",
      name: "Dr. Roberto Costa Lima",
      crm: "CRM/SP 345678",
      specialty: "Infectologia",
    },
    medications: [
      {
        id: "med-006",
        name: "Amoxicilina 500mg",
        dosage: "500mg",
        quantity: 21,
        frequency: "1 cápsula, 3x ao dia",
        duration: "7 dias",
        active_ingredient: "Amoxicilina",
        manufacturer: "Eurofarma",
        ean: "7896004730561",
      },
      {
        id: "med-007",
        name: "Paracetamol 750mg",
        dosage: "750mg",
        quantity: 20,
        frequency: "1 comprimido, a cada 6 horas",
        duration: "5 dias",
        active_ingredient: "Paracetamol",
        manufacturer: "Medley",
        ean: "7896004730578",
      },
    ],
    status: "expired",
    created_at: "2024-01-05T09:15:00Z",
    expires_at: "2024-04-05T23:59:59Z",
  },
];

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const memedMockClient = {
  /**
   * Busca receita por token, ID ou CPF do paciente
   */
  async searchPrescription(params: MemedSearchParams): Promise<MemedSearchResult> {
    await delay(MOCK_DELAY_MS);

    let found: MemedPrescription | undefined;

    if (params.token) {
      found = mockPrescriptions.find(
        (p) => p.token.toLowerCase() === params.token!.toLowerCase()
      );
    }

    if (!found && params.prescriptionId) {
      found = mockPrescriptions.find(
        (p) => p.id.toLowerCase() === params.prescriptionId!.toLowerCase()
      );
    }

    if (!found && params.patientCpf) {
      const cpfClean = params.patientCpf.replace(/\D/g, "");
      found = mockPrescriptions.find(
        (p) => p.patient.cpf.replace(/\D/g, "") === cpfClean
      );
    }

    if (found) {
      return {
        success: true,
        prescription: found,
      };
    }

    return {
      success: false,
      prescription: null,
      message: "Receita não encontrada. Verifique o código informado.",
    };
  },

  /**
   * Busca todas as receitas de um paciente por CPF
   */
  async getPatientPrescriptions(cpf: string): Promise<MemedPrescription[]> {
    await delay(MOCK_DELAY_MS);
    const cpfClean = cpf.replace(/\D/g, "");
    return mockPrescriptions.filter(
      (p) => p.patient.cpf.replace(/\D/g, "") === cpfClean
    );
  },

  /**
   * Busca receita por ID
   */
  async getPrescriptionById(id: string): Promise<MemedSearchResult> {
    return this.searchPrescription({ prescriptionId: id });
  },

  /**
   * Busca receita por token
   */
  async getPrescriptionByToken(token: string): Promise<MemedSearchResult> {
    return this.searchPrescription({ token });
  },
};
