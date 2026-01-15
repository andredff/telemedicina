import { getAssemedCredentials, getAssemedUrls } from "./config";
import { assemedMockClient } from "./mockClient";
import type {
  RegisterPatientRequest,
  RegisterPatientResponse,
  LoginRequest,
  LoginResponse,
  GetSpecialtiesRequest,
  GetSpecialtiesResponse,
  CreateConsultationRequest,
  CreateConsultationResponse,
  GetConsultationsRequest,
  GetConsultationsResponse,
  ConsultationSimplified,
  GetPrescriptionsResponse,
  Consultation,
  AssemedError,
  DecodedToken,
} from "./types";

class AssemedClient {
  private clientId: string;
  private clientSecret: string;
  private cnpj: string;
  private apiUrl: string;
  private useMock: boolean;
  private accessToken: string | null = null;

  constructor() {
    const credentials = getAssemedCredentials();
    const urls = getAssemedUrls(credentials.isSandbox);

    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
    this.cnpj = credentials.cnpj;
    this.apiUrl = urls.apiUrl;

    // Usa mock se não houver credenciais configuradas
    this.useMock = !this.clientId || !this.clientSecret;

    if (this.useMock) {
      console.info(
        "[Assemed] Credenciais não configuradas. Usando modo MOCK para testes locais."
      );
    }
  }

  /**
   * Define o token de acesso para requisições autenticadas
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Obtém o token de acesso atual
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Decodifica o token JWT para extrair informações do paciente
   */
  decodeToken(token: string): DecodedToken | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return {
        usuarioId: payload.usuarioId,
        pacienteId: payload.pacienteId,
        nome: payload.nome,
        email: payload.email,
        perfil: payload.perfil,
        cliente: payload.cliente,
        exp: payload.exp,
      };
    } catch {
      console.error("[Assemed] Erro ao decodificar token");
      return null;
    }
  }

  /**
   * Verifica se o token está expirado
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded) return true;
    return decoded.exp * 1000 < Date.now();
  }

  private getHeaders(authenticated: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (authenticated && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit,
    authenticated: boolean = false
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(authenticated),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as AssemedError;
      throw new AssemedApiError(
        error.message || "Erro na API Assemed",
        error.code || "UNKNOWN_ERROR",
        response.status
      );
    }

    return data as T;
  }

  // ==========================================
  // CADASTRO DE PACIENTE
  // ==========================================

  /**
   * Cadastra um novo paciente na plataforma
   */
  async registerPatient(
    data: Omit<RegisterPatientRequest, "identificacao" | "cnpj">
  ): Promise<RegisterPatientResponse> {
    if (this.useMock) {
      return assemedMockClient.registerPatient({
        ...data,
        identificacao: {
          clientId: this.clientId,
          clientSecret: this.clientSecret,
        },
        cnpj: this.cnpj,
      });
    }

    const request: RegisterPatientRequest = {
      identificacao: {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      },
      cnpj: this.cnpj,
      ...data,
    };

    return this.request<RegisterPatientResponse>(
      "/api/Pacientes/cadastro-externo",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
  }

  // ==========================================
  // AUTENTICAÇÃO
  // ==========================================

  /**
   * Realiza login do paciente e obtém token de acesso
   */
  async login(cpf: string): Promise<LoginResponse> {
    if (this.useMock) {
      const response = await assemedMockClient.login({
        cpfPaciente: cpf,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      });
      this.accessToken = response.accessToken;
      return response;
    }

    const request: LoginRequest = {
      cpfPaciente: cpf,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    };

    const response = await this.request<LoginResponse>(
      "/api/Auth/login-externo",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );

    this.accessToken = response.accessToken;
    return response;
  }

  // ==========================================
  // ESPECIALIDADES
  // ==========================================

  /**
   * Obtém lista de especialidades disponíveis
   */
  async getSpecialties(
    pageSize: number = 100,
    pageIndex: number = 0
  ): Promise<GetSpecialtiesResponse> {
    if (this.useMock) {
      return assemedMockClient.getSpecialties();
    }

    const request: GetSpecialtiesRequest = { pageSize, pageIndex };

    return this.request<GetSpecialtiesResponse>(
      "/api/Especialidades/obterTodas",
      {
        method: "POST",
        body: JSON.stringify(request),
      },
      true
    );
  }

  // ==========================================
  // ATENDIMENTOS/CONSULTAS
  // ==========================================

  /**
   * Cria um novo atendimento/consulta
   */
  async createConsultation(
    data: Omit<CreateConsultationRequest, "tipoAtendimento">
  ): Promise<CreateConsultationResponse> {
    if (this.useMock) {
      return assemedMockClient.createConsultation({
        ...data,
        tipoAtendimento: 1, // Sempre primeira consulta
      });
    }

    const request: CreateConsultationRequest = {
      ...data,
      tipoAtendimento: 1, // Sempre primeira consulta
    };

    return this.request<CreateConsultationResponse>("/api/Atendimentos", {
      method: "POST",
      body: JSON.stringify(request),
    }, true);
  }

  /**
   * Obtém lista de consultas do paciente
   */
  async getConsultations(
    pageSize: number = 20,
    pageIndex: number = 0
  ): Promise<GetConsultationsResponse> {
    if (this.useMock) {
      return assemedMockClient.getConsultations();
    }

    const request: GetConsultationsRequest = { pageSize, pageIndex };

    return this.request<GetConsultationsResponse>("/api/Atendimentos/obter", {
      method: "POST",
      body: JSON.stringify(request),
    }, true);
  }

  /**
   * Obtém detalhes de uma consulta específica
   */
  async getConsultation(id: number): Promise<Consultation | null> {
    if (this.useMock) {
      return assemedMockClient.getConsultation(id);
    }

    try {
      return await this.request<Consultation>(
        `/api/Atendimentos/${id}`,
        { method: "GET" },
        true
      );
    } catch {
      return null;
    }
  }

  /**
   * Obtém status simplificado de uma consulta (para polling)
   */
  async getConsultationStatus(id: number): Promise<ConsultationSimplified> {
    if (this.useMock) {
      return assemedMockClient.getConsultationStatus(id);
    }

    return this.request<ConsultationSimplified>(
      `/api/Atendimentos/${id}/simplificado`,
      { method: "GET" },
      true
    );
  }

  /**
   * Cancela uma consulta
   */
  async cancelConsultation(id: number): Promise<void> {
    if (this.useMock) {
      return assemedMockClient.cancelConsultation(id);
    }

    await this.request<void>(
      `/api/Atendimentos/${id}/cancelar`,
      { method: "PUT" },
      true
    );
  }

  /**
   * Envia avaliação da consulta
   */
  async evaluateConsultation(
    id: number,
    nota: number,
    comentario?: string
  ): Promise<void> {
    if (this.useMock) {
      return assemedMockClient.evaluateConsultation(id, nota, comentario);
    }

    await this.request<void>(
      `/api/Atendimentos/${id}/avaliar`,
      {
        method: "POST",
        body: JSON.stringify({ nota, comentario }),
      },
      true
    );
  }

  // ==========================================
  // RECEITUÁRIOS E DOCUMENTOS
  // ==========================================

  /**
   * Obtém receituários/documentos de uma consulta
   */
  async getPrescriptions(consultationId: number): Promise<GetPrescriptionsResponse> {
    if (this.useMock) {
      return assemedMockClient.getPrescriptions(consultationId);
    }

    return this.request<GetPrescriptionsResponse>(
      `/api/Atendimentos/v2/${consultationId}/receituario`,
      { method: "GET" },
      true
    );
  }
}

export class AssemedApiError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = "AssemedApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Singleton instance
export const assemedClient = new AssemedClient();
