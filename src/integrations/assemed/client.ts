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


const STORAGE_KEY_TOKEN = "assemed_access_token";
const STORAGE_KEY_CPF = "assemed_cpf_paciente";

class AssemedClient {
  private clientId: string;
  private clientSecret: string;
  private cnpj: string;
  private apiUrl: string;
  private useMock: boolean;
  private accessToken: string | null = null;
  private cpfPaciente: string | null = null; // CPF do paciente para retry de login
  /**
   * Define o CPF do paciente para retry automático de login
   */
  setCpfPaciente(cpf: string) {
    this.cpfPaciente = cpf;
    try { sessionStorage.setItem(STORAGE_KEY_CPF, cpf); } catch { /* ignore */ }
  }

  /**
   * Obtém o CPF do paciente salvo
   */
  getCpfPaciente(): string | null {
    return this.cpfPaciente;
  }

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

    // Recupera token e CPF do sessionStorage (persistência entre refreshes)
    try {
      const storedToken = sessionStorage.getItem(STORAGE_KEY_TOKEN);
      const storedCpf = sessionStorage.getItem(STORAGE_KEY_CPF);
      if (storedToken && !this.isTokenExpired(storedToken)) {
        this.accessToken = storedToken;
        console.info("[Assemed] Token recuperado do sessionStorage");
      } else if (storedToken) {
        // Token expirado — limpa
        sessionStorage.removeItem(STORAGE_KEY_TOKEN);
        console.info("[Assemed] Token expirado removido do sessionStorage");
      }
      if (storedCpf) {
        this.cpfPaciente = storedCpf;
      }
    } catch { /* ignore storage errors */ }
  }

  /**
   * Define o token de acesso para requisições autenticadas
   * Persiste no sessionStorage para sobreviver a refreshes de página
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
    try { sessionStorage.setItem(STORAGE_KEY_TOKEN, token); } catch { /* ignore */ }
  }

  /**
   * Obtém o token de acesso atual
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Verifica se o client tem um token válido (não expirado)
   */
  hasValidToken(): boolean {
    return !!this.accessToken && !this.isTokenExpired(this.accessToken);
  }

  /**
   * Limpa o token (logout ou expiração)
   */
  clearToken(): void {
    this.accessToken = null;
    try { sessionStorage.removeItem(STORAGE_KEY_TOKEN); } catch { /* ignore */ }
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
    authenticated: boolean = false,
    retryOn401: boolean = true
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;

    let response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(authenticated),
        ...options.headers,
      },
    });

    // Verifica se a resposta é JSON válido
    let contentType = response.headers.get("content-type");
    let isJson = contentType?.includes("application/json") || contentType?.includes("text/json");

    // Retry automático de login-externo se 401
    if (response.status === 401 && authenticated && retryOn401 && this.cpfPaciente) {
      console.warn("[Assemed] 401 detectado. Tentando login-externo automático e retry...");
      try {
        await this.login(this.cpfPaciente);
        // Repete a requisição original com novo token, mas sem retry recursivo
        response = await fetch(url, {
          ...options,
          headers: {
            ...this.getHeaders(authenticated),
            ...options.headers,
          },
        });
        contentType = response.headers.get("content-type");
        isJson = contentType?.includes("application/json") || contentType?.includes("text/json");
      } catch (retryErr) {
        console.error("[Assemed] Falha ao tentar login-externo automático após 401:", retryErr);
        // Continua para tratamento de erro padrão
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      
      if (isJson) {
        const errorData = await response.json();

        // Extrai a mensagem mais específica possível:
        // 1. errors[""] array (validation errors do .NET)
        // 2. errors como objeto com arrays
        // 3. message direto
        // 4. title genérico
        if (errorData.errors) {
          const errorValues = Object.values(errorData.errors) as string[][];
          const allMessages = errorValues.flat().filter(Boolean);
          if (allMessages.length > 0) {
            errorMessage = allMessages[0];
          } else {
            errorMessage = errorData.message || errorData.title || errorMessage;
          }
        } else {
          errorMessage = errorData.message || errorData.title || errorMessage;
        }
      } else {
        errorMessage = await response.text() || errorMessage;
      }

      console.error("[Assemed] Erro na API:", {
        status: response.status,
        endpoint,
        error: errorMessage,
      });

      throw new AssemedApiError(
        errorMessage,
        "API_ERROR",
        response.status
      );
    }

    if (isJson) {
      return response.json();
    }
    return {} as T;
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

    // Debug: log da requisição para identificar campos nulos
    console.log("[Assemed] RegisterPatient request:", {
      ...request,
      identificacao: {
        clientId: request.identificacao.clientId,
        clientSecretLength: request.identificacao.clientSecret?.length || 0,
      },
    });

    // Validação de campos obrigatórios antes de enviar
    const camposObrigatorios = [
      { campo: "clientId", valor: this.clientId },
      { campo: "clientSecret", valor: this.clientSecret },
      { campo: "cnpj", valor: this.cnpj },
      { campo: "nome", valor: data.nome },
      { campo: "cpf", valor: data.cpf },
      { campo: "dataNascimento", valor: data.dataNascimento },
      { campo: "sexo", valor: data.sexo },
      { campo: "telefone", valor: data.telefone },
      { campo: "email", valor: data.email },
    ];

    const camposFaltando = camposObrigatorios.filter(c => !c.valor);
    if (camposFaltando.length > 0) {
      const campos = camposFaltando.map(c => c.campo).join(", ");
      console.error("[Assemed] Campos obrigatórios faltando:", campos);
      throw new AssemedApiError(
        `Campos obrigatórios faltando: ${campos}`,
        "VALIDATION_ERROR",
        400
      );
    }

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
      try { sessionStorage.setItem(STORAGE_KEY_TOKEN, response.accessToken); } catch { /* ignore */ }
      return response;
    }

    const request: LoginRequest = {
      cpfPaciente: cpf,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    };

    // Debug: log da requisição (sem expor o secret completo)
    console.log("[Assemed] Login request:", {
      cpfPaciente: cpf,
      clientId: this.clientId,
      clientSecretLength: this.clientSecret?.length || 0,
      apiUrl: this.apiUrl,
    });

    const response = await this.request<LoginResponse>(
      "/api/Auth/login-externo",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );

    this.accessToken = response.accessToken;
    try { sessionStorage.setItem(STORAGE_KEY_TOKEN, response.accessToken); } catch { /* ignore */ }
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
    notaAtendimento: number,
    notaAplicativo: number,
    comentario?: string
  ): Promise<void> {
    if (this.useMock) {
      return assemedMockClient.evaluateConsultation(id, notaAtendimento, comentario);
    }

    await this.request<void>(
      `/api/Atendimentos/${id}/avaliar`,
      {
        method: "POST",
        body: JSON.stringify({
          notaAtendimento,
          notaAplicativo,
          comentario: comentario ?? "",
          atendimentoId: id,
        }),
      },
      true
    );
  }

  // ==========================================
  // RECEITUÁRIOS E DOCUMENTOS
  // ==========================================

  /**
   * Obtém receituários/documentos de uma consulta
   * GET /api/Atendimentos/v2/{id}/receituario
   * Retorna array de {urlPdf: string}
   */
  async getReceituarios(consultationId: number): Promise<{urlPdf: string}[]> {
    if (this.useMock) {
      const mock = await assemedMockClient.getPrescriptions(consultationId);
      return mock.items.map(i => ({ urlPdf: i.url }));
    }

    return this.request<{urlPdf: string}[]>(
      `/api/Atendimentos/v2/${consultationId}/receituario`,
      { method: "GET" },
      true
    );
  }

  /**
   * @deprecated Use getReceituarios. Mantido para compatibilidade.
   */
  async getPrescriptions(consultationId: number): Promise<GetPrescriptionsResponse> {
    if (this.useMock) {
      return assemedMockClient.getPrescriptions(consultationId);
    }

    const items = await this.getReceituarios(consultationId);
    return {
      items: items.map((item, idx) => ({
        id: consultationId * 100 + idx,
        tipo: "RECEITA" as const,
        url: item.urlPdf,
        dataCriacao: new Date().toISOString(),
      })),
    };
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
