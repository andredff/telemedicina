import type {
  RegisterPatientRequest,
  RegisterPatientResponse,
  LoginRequest,
  LoginResponse,
  GetSpecialtiesResponse,
  CreateConsultationRequest,
  CreateConsultationResponse,
  GetConsultationsResponse,
  ConsultationSimplified,
  GetPrescriptionsResponse,
  GetAvailableProfessionalsResponse,
  GetAvailableSchedulesResponse,
  Consultation,
  ConsultationStatus,
} from "./types";

// Simula delay de rede
const simulateDelay = () =>
  new Promise((resolve) =>
    setTimeout(resolve, 500 + Math.random() * 500)
  );

// Armazena dados mockados em memória
const mockStorage = {
  patients: new Map<string, { id: number; cpf: string; nome: string }>(),
  consultations: new Map<number, Consultation>(),
  nextPatientId: 1000,
  nextConsultationId: 100,
};

// Especialidades mockadas
const mockSpecialties = [
  {
    id: 1,
    nome: "Clínico Geral",
    icone: "clinico-geral.svg",
    tipoIcone: "arquivo" as const,
    precoConsulta: 0,
    valorRepasseProfissional: 0,
    tipoProfissionalId: 1,
    tipoProfissionalDescricao: "Médico",
    especialidadeIdMemed: 14,
    segundaOpcaoEspecialidadeId: null,
    segundaOpcaoEspecialidadeNome: null,
    permiteCriacaoAtendimentoPeloPaciente: true,
    triagem: false,
    contratoPadraoId: 0,
    contratoPadraoNome: null,
  },
  {
    id: 2,
    nome: "Pediatria",
    icone: "pediatria.svg",
    tipoIcone: "arquivo" as const,
    precoConsulta: 89.9,
    valorRepasseProfissional: 0,
    tipoProfissionalId: 1,
    tipoProfissionalDescricao: "Médico",
    especialidadeIdMemed: 27,
    segundaOpcaoEspecialidadeId: 1,
    segundaOpcaoEspecialidadeNome: "Clínico Geral",
    permiteCriacaoAtendimentoPeloPaciente: true,
    triagem: false,
    contratoPadraoId: 0,
    contratoPadraoNome: null,
  },
  {
    id: 3,
    nome: "Dermatologia",
    icone: "dermatologia.svg",
    tipoIcone: "arquivo" as const,
    precoConsulta: 129.9,
    valorRepasseProfissional: 0,
    tipoProfissionalId: 1,
    tipoProfissionalDescricao: "Médico",
    especialidadeIdMemed: 10,
    segundaOpcaoEspecialidadeId: null,
    segundaOpcaoEspecialidadeNome: null,
    permiteCriacaoAtendimentoPeloPaciente: true,
    triagem: false,
    contratoPadraoId: 0,
    contratoPadraoNome: null,
  },
];

// Gera um token JWT mock
function generateMockToken(pacienteId: number, nome: string, email: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      usuarioId: String(pacienteId + 10000),
      pacienteId: String(pacienteId),
      nome,
      email,
      perfil: "Paciente",
      cliente: "Novità",
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hora
    })
  );
  const signature = btoa("mock-signature");
  return `${header}.${payload}.${signature}`;
}

// Gera um token de paciente para a sala de espera
function generatePatientToken(consultationId: number): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" }));
  const payload = btoa(
    JSON.stringify({
      iss: "mock-issuer",
      exp: Math.floor(Date.now() / 1000) + 3600,
      jti: `mock-${consultationId}-${Date.now()}`,
      sub: "mock-subject",
      grants: {
        identity: "Paciente",
        video: { room: String(consultationId) },
      },
    })
  );
  const signature = btoa("mock-video-signature");
  return `${header}.${payload}.${signature}`;
}

export const assemedMockClient = {
  /**
   * Cadastra um novo paciente (mock)
   */
  async registerPatient(
    request: RegisterPatientRequest
  ): Promise<RegisterPatientResponse> {
    await simulateDelay();

    // Verifica se já existe paciente com esse CPF
    const existingPatient = Array.from(mockStorage.patients.values()).find(
      (p) => p.cpf === request.cpf
    );

    if (existingPatient) {
      return { pacienteId: existingPatient.id };
    }

    const pacienteId = mockStorage.nextPatientId++;
    mockStorage.patients.set(request.cpf, {
      id: pacienteId,
      cpf: request.cpf,
      nome: request.nome,
    });

    console.info("[Assemed Mock] Paciente cadastrado:", {
      pacienteId,
      nome: request.nome,
    });

    return { pacienteId };
  },

  /**
   * Realiza login do paciente (mock)
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    await simulateDelay();

    // Busca ou cria paciente
    let patient = mockStorage.patients.get(request.cpfPaciente);

    if (!patient) {
      // Cria paciente automaticamente no mock
      const pacienteId = mockStorage.nextPatientId++;
      patient = {
        id: pacienteId,
        cpf: request.cpfPaciente,
        nome: "Paciente Mock",
      };
      mockStorage.patients.set(request.cpfPaciente, patient);
    }

    const accessToken = generateMockToken(
      patient.id,
      patient.nome,
      `paciente${patient.id}@mock.com`
    );

    console.info("[Assemed Mock] Login realizado:", { pacienteId: patient.id });

    return {
      accessToken,
      refreshToken: btoa(`refresh-${patient.id}-${Date.now()}`),
      prazoMaximoAssumirAtendimento: 0,
    };
  },

  /**
   * Obtém especialidades disponíveis (mock)
   */
  async getSpecialties(
    _pacienteId: number,
    _options?: { requerAgendamento?: boolean }
  ): Promise<GetSpecialtiesResponse> {
    await simulateDelay();
    return { items: mockSpecialties };
  },

  /**
   * Cria um novo atendimento/consulta (mock)
   */
  async createConsultation(
    request: CreateConsultationRequest
  ): Promise<CreateConsultationResponse> {
    await simulateDelay();

    const id = mockStorage.nextConsultationId++;
    const pacienteToken = generatePatientToken(id);

    const specialty = mockSpecialties.find(
      (s) => s.id === request.especialidadeId
    );

    const consultation: Consultation = {
      id,
      pacienteId: request.pacienteId,
      pacienteNome: "Paciente Mock",
      especialidadeId: request.especialidadeId,
      especialidadeNome: specialty?.nome || "Clínico Geral",
      tipoProfissionalId: request.tipoProfissional ?? 0,
      profissionalNome: null,
      status: "AGUARDANDO",
      dataHoraCriacao: new Date().toISOString(),
      dataHoraInicio: null,
      dataHoraFim: null,
      pacienteToken,
    };

    mockStorage.consultations.set(id, consultation);

    console.info("[Assemed Mock] Consulta criada:", { id, especialidade: specialty?.nome });

    return {
      id,
      pacienteToken,
      usuarioIdProximoProfissional: null,
      existePacienteAguardandoSemProfissional: true,
      existeAtendimentoTextoAguardando: false,
      pacienteNome: "Paciente Mock",
      tituloAssinatura: "Assinatura Novità",
      cupom: null,
      pendingBillingSessionSecret: null,
    };
  },

  /**
   * Obtém lista de consultas do paciente (mock)
   */
  async getConsultations(): Promise<GetConsultationsResponse> {
    await simulateDelay();
    const items = Array.from(mockStorage.consultations.values()).sort(
      (a, b) =>
        new Date(b.dataHoraCriacao).getTime() -
        new Date(a.dataHoraCriacao).getTime()
    );
    return { items };
  },

  /**
   * Obtém detalhes de uma consulta (mock)
   */
  async getConsultation(id: number): Promise<Consultation | null> {
    await simulateDelay();
    return mockStorage.consultations.get(id) || null;
  },

  /**
   * Obtém status simplificado de uma consulta (mock)
   */
  async getConsultationStatus(id: number): Promise<ConsultationSimplified> {
    await simulateDelay();
    const consultation = mockStorage.consultations.get(id);

    if (!consultation) {
      return {
        id,
        situacao: "CANCELADO",
        profissionalNome: null,
        motivoCancelamento: 4, // Timeout - não encontrou
      };
    }

    // Simula mudança de status após algum tempo
    const timeSinceCreation =
      Date.now() - new Date(consultation.dataHoraCriacao).getTime();

    let status: ConsultationStatus = consultation.status;
    let profissionalNome = consultation.profissionalNome;
    let motivoCancelamento: number | undefined;

    if (timeSinceCreation > 30000 && status === "AGUARDANDO") {
      status = "EM_ATENDIMENTO";
      profissionalNome = "Dr. Mock Silva";
      consultation.status = status;
      consultation.profissionalNome = profissionalNome;
      consultation.dataHoraInicio = new Date().toISOString();
    }

    // Se cancelado, define o motivo
    if (status === "CANCELADO") {
      motivoCancelamento = (consultation as any).motivoCancelamento || 1;
    }

    return {
      id,
      situacao: status,
      profissionalNome,
      motivoCancelamento,
    };
  },

  /**
   * Cancela uma consulta (mock)
   */
  async cancelConsultation(id: number): Promise<void> {
    await simulateDelay();
    const consultation = mockStorage.consultations.get(id);
    if (consultation) {
      consultation.status = "CANCELADO";
      console.info("[Assemed Mock] Consulta cancelada:", { id });
    }
  },

  /**
   * Envia avaliação da consulta (mock)
   */
  async evaluateConsultation(
    id: number,
    nota: number,
    comentario?: string
  ): Promise<void> {
    await simulateDelay();
    console.info("[Assemed Mock] Avaliação enviada:", { id, nota, comentario });
  },

  /**
   * Obtém profissionais disponíveis para uma especialidade (mock)
   */
  async getAvailableProfessionals(pacienteId: number, especialidadeId: number): Promise<GetAvailableProfessionalsResponse> {
    await simulateDelay();

    const specialty = mockSpecialties.find((s) => s.id === especialidadeId);
    const especialidadeNome = specialty?.nome || "Especialidade";

    return {
      items: [
        {
          profissionalId: 5001,
          nome: "Dra. Ana Carolina Santos",
          especialidadeId,
          especialidadeNome,
          foto: null,
        },
        {
          profissionalId: 5002,
          nome: "Dr. Ricardo Oliveira",
          especialidadeId,
          especialidadeNome,
          foto: null,
        },
        {
          profissionalId: 5003,
          nome: "Dra. Beatriz Lima",
          especialidadeId,
          especialidadeNome,
          foto: null,
        },
      ],
    };
  },

  /**
   * Obtém horários disponíveis para agendamento de um profissional (mock)
   */
  async getAvailableSchedules(profissionalId: number, pacienteId: number, especialidadeId: number): Promise<GetAvailableSchedulesResponse> {
    await simulateDelay();

    // Gera 3 dias a partir de amanhã com horários disponíveis
    const days = [];
    const now = new Date();
    let slotId = 1;

    for (let d = 1; d <= 3; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);
      // Pula fins de semana
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const dateStr = date.toISOString().split("T")[0];
      const horarios = [];

      // Gera slots de 30 min entre 8h e 17h
      for (let h = 8; h < 17; h++) {
        for (const m of [0, 30]) {
          // Simula alguns horários já ocupados
          if (Math.random() > 0.5) continue;

          const slotDate = new Date(date);
          slotDate.setHours(h, m, 0, 0);

          horarios.push({
            id: slotId++,
            profissionalId,
            profissionalNome: "Profissional Mock",
            dataHora: slotDate.toISOString(),
            precoConsulta: 50,
          });
        }
      }

      if (horarios.length > 0) {
        days.push({ data: dateStr, horarios });
      }
    }

    console.info("[Assemed Mock] Horários disponíveis para profissional:", { profissionalId, pacienteId, especialidadeId, dias: days.length });

    return { items: days };
  },

  /**
   * Obtém receituários/documentos de uma consulta (mock)
   */
  async getPrescriptions(consultationId: number): Promise<GetPrescriptionsResponse> {
    await simulateDelay();

    const consultation = mockStorage.consultations.get(consultationId);
    if (!consultation || consultation.status !== "CONCLUIDO") {
      return { items: [] };
    }

    return {
      items: [
        {
          id: consultationId * 100 + 1,
          tipo: "RECEITA",
          url: `https://mock-prescriptions.novita.com/receita-${consultationId}.pdf`,
          dataCriacao: consultation.dataHoraFim || new Date().toISOString(),
        },
      ],
    };
  },
};
