import { getAssemedCredentials, getAssemedUrls } from "./config";
import type {
  RegisterPatientRequest,
  RegisterPatientResponse,
  LoginRequest,
  LoginResponse,
  GetSpecialtiesRequest,
  GetSpecialtiesResponse,
  Specialty,
  CreateConsultationRequest,
  CreateConsultationResponse,
  GetConsultationsRequest,
  GetConsultationsResponse,
  ConsultationSimplified,
  Consultation,
  DecodedToken,
  AvailableProfessional,
  GetAvailableProfessionalsResponse,
  GetAvailableSchedulesRequest,
  GetAvailableSchedulesResponse,
  ScheduleSlot,
  AvailableScheduleDay,
} from "./types";


const STORAGE_KEY_TOKEN = "assemed_access_token";
const STORAGE_KEY_CPF = "assemed_cpf_paciente";

class AssemedClient {
  private clientId: string;
  private clientSecret: string;
  private cnpj: string;
  private apiUrl: string;
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

    if (!this.clientId || !this.clientSecret) {
      console.warn(
        "[Assemed] Credenciais não configuradas. As chamadas à API falharão."
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
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;

      if (isJson) {
        const errorData = await response.json();

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

  async registerPatient(
    data: Omit<RegisterPatientRequest, "identificacao" | "cnpj">
  ): Promise<RegisterPatientResponse> {
    const request: RegisterPatientRequest = {
      identificacao: {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      },
      cnpj: this.cnpj,
      ...data,
    };

    console.log("[Assemed] RegisterPatient request:", {
      ...request,
      identificacao: {
        clientId: request.identificacao.clientId,
        clientSecretLength: request.identificacao.clientSecret?.length || 0,
      },
    });

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

  async login(cpf: string): Promise<LoginResponse> {
    const request: LoginRequest = {
      cpfPaciente: cpf,
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    };

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

  async getSpecialties(
    pacienteId: number,
    options?: { requerAgendamento?: boolean }
  ): Promise<GetSpecialtiesResponse> {
    const request: GetSpecialtiesRequest = {
      pageSize: 0,
      pageIndex: 0,
      pacienteId,
      apenasDisponiveis: true,
      requerAgendamento: options?.requerAgendamento ?? true,
    };

    const raw = await this.request<GetSpecialtiesResponse | Specialty[]>(
      "/api/Especialidades/obterDisponiveis",
      {
        method: "POST",
        body: JSON.stringify(request),
      },
      true
    );

    // API pode retornar array direto ou { items: [...] }
    if (Array.isArray(raw)) {
      return { items: raw };
    }
    return raw;
  }

  // ==========================================
  // ATENDIMENTOS/CONSULTAS
  // ==========================================

  async createConsultation(
    data: Omit<CreateConsultationRequest, "tipoAtendimento"> & { tipoAtendimento?: number }
  ): Promise<CreateConsultationResponse> {
    const request: CreateConsultationRequest = {
      ...data,
      tipoAtendimento: data.tipoAtendimento ?? 1,
    };

    return this.request<CreateConsultationResponse>("/api/Atendimentos", {
      method: "POST",
      body: JSON.stringify(request),
    }, true);
  }

  async getConsultations(
    pageSize: number = 20,
    pageIndex: number = 0
  ): Promise<GetConsultationsResponse> {
    const request: GetConsultationsRequest = { pageSize, pageIndex };

    return this.request<GetConsultationsResponse>("/api/Atendimentos/obter", {
      method: "POST",
      body: JSON.stringify(request),
    }, true);
  }

  async getConsultation(id: number): Promise<Consultation | null> {
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

  async getConsultationStatus(id: number): Promise<ConsultationSimplified> {
    return this.request<ConsultationSimplified>(
      `/api/Atendimentos/${id}/simplificado`,
      { method: "GET" },
      true
    );
  }

  async cancelConsultation(id: number): Promise<void> {
    await this.request<void>(
      `/api/Atendimentos/${id}/cancelar`,
      { method: "PUT" },
      true
    );
  }

  async evaluateConsultation(
    id: number,
    notaAtendimento: number,
    notaAplicativo: number,
    comentario?: string
  ): Promise<void> {
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
  // AGENDAMENTO DE ESPECIALISTAS
  // ==========================================

  /**
   * Obtém profissionais disponíveis para uma especialidade
   * POST /api/DisponibilidadeEspecialidade/obterProfissionaisDisponiveis
   */
  async getAvailableProfessionals(
    pacienteId: number,
    especialidadeId: number
  ): Promise<GetAvailableProfessionalsResponse> {
    const raw = await this.request<GetAvailableProfessionalsResponse | Record<string, unknown>[]>(
      `/api/DisponibilidadeEspecialidade/obterProfissionaisDisponiveis`,
      {
        method: "POST",
        body: JSON.stringify({ pacienteId, especialidadeId }),
      },
      true
    );

    // API pode retornar array direto ou { items: [...] }
    const rawItems: Record<string, unknown>[] = Array.isArray(raw)
      ? raw
      : ((raw as GetAvailableProfessionalsResponse).items || []) as unknown as Record<string, unknown>[];

    // Normaliza campo profissionalNome → nome
    const items: AvailableProfessional[] = rawItems.map((p) => ({
      profissionalId: p.profissionalId as number,
      nome: (p.nome || p.profissionalNome || "") as string,
      especialidadeId: (p.especialidadeId as number) ?? especialidadeId,
      profissionalPrecoConsulta: p.profissionalPrecoConsulta as number | null,
      profissionalTempoConsulta: p.profissionalTempoConsulta as number,
      disponibilidade: p.disponibilidade,
      foto: (p.foto as string) ?? null,
    }));

    return { items };
  }

  /**
   * Obtém datas e horários disponíveis para agendamento com um profissional
   * POST /api/DisponibilidadeEspecialidade/obterDisponiveisParaAgendamento
   *
   * A API retorna um array plano de slots: [{ id, profissionalId, profissionalNome, dataHora, precoConsulta }]
   * Agrupamos por data para facilitar a exibição no modal.
   */
  async getAvailableSchedules(
    profissionalId: number,
    pacienteId: number,
    especialidadeId: number
  ): Promise<GetAvailableSchedulesResponse> {
    const request: GetAvailableSchedulesRequest = {
      profissionalId: null,
      pacienteId,
      dataInicio: null,
      dataFim: null,
      horaInicio: null,
      horaFim: null,
      especialidadeId,
      fuso: 180,
    };

    const raw = await this.request<ScheduleSlot[] | GetAvailableSchedulesResponse>(
      `/api/DisponibilidadeEspecialidade/obterDisponiveisParaAgendamento`,
      {
        method: "POST",
        body: JSON.stringify(request),
      },
      true
    );

    // Se API retornar já agrupado, retorna direto
    if (!Array.isArray(raw) && raw.items) {
      return raw;
    }

    // API retorna array plano — agrupa por data
    const flatSlots: ScheduleSlot[] = Array.isArray(raw) ? raw : [];
    const dayMap = new Map<string, ScheduleSlot[]>();

    for (const slot of flatSlots) {
      const dateKey = slot.dataHora.substring(0, 10); // YYYY-MM-DD
      const existing = dayMap.get(dateKey) || [];
      existing.push(slot);
      dayMap.set(dateKey, existing);
    }

    // Ordena por data e horário
    const items: AvailableScheduleDay[] = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, horarios]) => ({
        data,
        horarios: horarios.sort((a, b) => a.dataHora.localeCompare(b.dataHora)),
      }));

    return { items };
  }

  // ==========================================
  // RECEITUÁRIOS E DOCUMENTOS
  // ==========================================

  /**
   * Obtém receituários/documentos de uma consulta
   * GET /api/Atendimentos/{id}/receituario
   * Retorna array de {urlPdf: string}
   */
  async getReceituarios(consultationId: number): Promise<{urlPdf: string}[]> {
    return this.request<{urlPdf: string}[]>(
      `/api/Atendimentos/${consultationId}/receituario`,
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
