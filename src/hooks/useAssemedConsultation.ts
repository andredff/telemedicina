import { useState, useCallback } from "react";
import { assemedClient, AssemedApiError } from "@/integrations/assemed/client";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

// ── Notification helper ─────────────────────────────────────────────────────
function getServerUrl() {
  if (import.meta.env.DEV) return "";
  return import.meta.env.VITE_LOCAL_SERVER_URL || "";
}

async function notifyConsultaAgendada(params: {
  consultaId: string | number;
  especialidade: string;
  profissional?: string;
  dataHora: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const baseUrl = getServerUrl();
    await fetch(`${baseUrl}/api/notifications/consulta-agendada`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consultaId: String(params.consultaId),
        email: user.email,
        nome: profile?.full_name || user.email,
        especialidade: params.especialidade,
        profissional: params.profissional || "A definir",
        dataHora: params.dataHora,
        userId: user.id,
      }),
    });
  } catch {
    // Fire-and-forget — don't block the consultation flow
  }
}

/**
 * Transforma mensagens de erro técnicas da API Assemed em mensagens amigáveis para o usuário.
 */
function humanizeAssemedError(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("consulta não finalizada") ||
    lower.includes("consulta nao finalizada") ||
    lower.includes("atendimento não finalizado") ||
    lower.includes("existe uma consulta")
  ) {
    return "Você já possui uma consulta em andamento. Aguarde o atendimento ser concluído ou cancele-o antes de iniciar uma nova consulta.";
  }

  if (lower.includes("não cadastrado") || lower.includes("nao cadastrado") || lower.includes("not found") || lower.includes("404")) {
    return "Paciente não encontrado. Tente novamente.";
  }

  if (
    lower.includes("invalid access token") ||
    (lower.includes("token") && (lower.includes("expirado") || lower.includes("inválido") || lower.includes("invalido") || lower.includes("invalid")))
  ) {
    return "Token de acesso inválido ou expirado. Por favor, tente novamente.";
  }

  if (lower.includes("unauthorized") || lower.includes("401")) {
    return "Acesso não autorizado. Verifique suas credenciais.";
  }

  if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("load failed")) {
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  }

  if (
    lower.includes("especialidade não está habilitada") ||
    lower.includes("especialidade nao esta habilitada") ||
    lower.includes("não está habilitada para o paciente") ||
    lower.includes("nao esta habilitada para o paciente")
  ) {
    return "Esta especialidade não está disponível para o seu perfil. Por favor, selecione outra especialidade ou entre em contato com o suporte.";
  }

  if (lower.includes("validation errors") || lower.includes("one or more validation")) {
    return "Não foi possível criar a consulta. Verifique seus dados ou selecione outra especialidade.";
  }

  // Retorna a mensagem original se não houver tradução conhecida
  return message;
}
import type {
  Consultation,
  Specialty,
  CreateConsultationResponse,
  AnamneseResposta,
  AvailableProfessional,
  AvailableScheduleDay,
  ScheduleSlot,
} from "@/integrations/assemed/types";

interface ProfileData {
  full_name: string;
  email: string;
  cpf?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
}

export type ConsultationFlowStep =
  | "idle"
  | "registering"
  | "authenticating"
  | "loading_specialties"
  | "selecting_specialty"
  | "loading_professionals"
  | "selecting_professional"
  | "loading_schedules"
  | "selecting_schedule"
  | "creating_consultation"
  | "in_consultation"
  | "error";

interface ConsultationFlowState {
  step: ConsultationFlowStep;
  accessToken: string | null;
  specialties: Specialty[];
  availableProfessionals: AvailableProfessional[];
  availableSchedules: AvailableScheduleDay[];
  activeConsultation: CreateConsultationResponse | null;
  consultations: Consultation[];
  isLoadingConsultations: boolean;
  error: string | null;
}

/**
 * Hook para gerenciar o fluxo completo de teleconsulta via API Assemed:
 * 1. Cadastro externo do paciente (se necessário)
 * 2. Login externo para obter accessToken
 * 3. Obter especialidades disponíveis
 * 4. Criar atendimento
 * 5. Abrir iframe com sala de espera
 */
export function useAssemedConsultation() {
  const [state, setState] = useState<ConsultationFlowState>({
    step: "idle",
    accessToken: null,
    specialties: [],
    availableProfessionals: [],
    availableSchedules: [],
    activeConsultation: null,
    consultations: [],
    isLoadingConsultations: false,
    error: null,
  });

  const setStep = (step: ConsultationFlowStep) =>
    setState((prev) => ({ ...prev, step }));

  const setError = (error: string) =>
    setState((prev) => ({ ...prev, step: "error", error: humanizeAssemedError(error) }));

  /**
   * Autentica silenciosamente (sem abrir seleção de especialidade).
   * Usado ao entrar na página para carregar o histórico de consultas.
   */
  const silentAuthenticate = useCallback(
    async (cpf: string, profile: ProfileData): Promise<string | null> => {
      const cleanCpf = cpf.replace(/\D/g, "");

      setState((prev) => ({
        ...prev,
        step: "authenticating",
        error: null,
      }));

      try {
        let accessToken: string;

        try {
          const loginResponse = await assemedClient.login(cleanCpf);
          accessToken = loginResponse.accessToken;
        } catch (loginError: unknown) {
          const isNotRegistered =
            (loginError instanceof AssemedApiError &&
              (loginError.statusCode === 404 ||
                loginError.statusCode === 401 ||
                (loginError.statusCode === 400 &&
                  loginError.message.toLowerCase().includes("não cadastrado")))) ||
            (loginError instanceof Error &&
              (loginError.message.includes("404") ||
                loginError.message.includes("401") ||
                loginError.message.toLowerCase().includes("unauthorized") ||
                loginError.message.toLowerCase().includes("not found") ||
                loginError.message.toLowerCase().includes("não encontrado") ||
                loginError.message.toLowerCase().includes("não cadastrado")));

          if (!isNotRegistered) {
            throw loginError;
          }

          // Cadastra o paciente
          setState((prev) => ({ ...prev, step: "registering" }));
          const registerData = buildRegisterData(cleanCpf, profile);
          await assemedClient.registerPatient(registerData);

          // Salva o emailTelemedicina no banco de dados do usuário
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from("profiles")
                .update({ email_telemedicina: registerData.email })
                .eq("id", user.id);
              logger.info("[useAssemedConsultation] emailTelemedicina salvo:", registerData.email);
            }
          } catch (updateErr) {
            logger.error("[useAssemedConsultation] Erro ao salvar emailTelemedicina:", updateErr);
          }

          setState((prev) => ({ ...prev, step: "authenticating" }));
          const retryLogin = await assemedClient.login(cleanCpf);
          accessToken = retryLogin.accessToken;
        }

        assemedClient.setAccessToken(accessToken);
        assemedClient.setCpfPaciente(cleanCpf);
        setState((prev) => ({ ...prev, step: "idle", accessToken }));
        return accessToken;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao autenticar na telemedicina";
        // Silently fail - don't block the page
        setState((prev) => ({ ...prev, step: "idle", error: message }));
        return null;
      }
    },
    []
  );

  /**
   * Inicia o fluxo de consulta:
   * 1. Tenta login; se falhar com 404/não cadastrado, faz cadastro e tenta novamente
   * 2. Carrega especialidades
   * 3. Aguarda seleção de especialidade
   */
  const startConsultationFlow = useCallback(
    async (cpf: string, profile: ProfileData): Promise<void> => {
      const cleanCpf = cpf.replace(/\D/g, "");

      setState((prev) => ({
        ...prev,
        step: "authenticating",
        error: null,
        specialties: [],
        activeConsultation: null,
      }));

      try {
        let accessToken: string;

        // Se já temos token válido, reutiliza
        const currentToken = assemedClient.getAccessToken();
        if (currentToken && !assemedClient.isTokenExpired(currentToken)) {
          accessToken = currentToken;
          setState((prev) => ({ ...prev, accessToken }));
        } else {
          // Tenta login direto
          try {
            const loginResponse = await assemedClient.login(cleanCpf);
            accessToken = loginResponse.accessToken;
          } catch (loginError: unknown) {
            // Detecta paciente não cadastrado
            const isNotRegistered =
              (loginError instanceof AssemedApiError &&
                (loginError.statusCode === 404 ||
                  loginError.statusCode === 401 ||
                  (loginError.statusCode === 400 &&
                    loginError.message.toLowerCase().includes("não cadastrado")))) ||
              (loginError instanceof Error &&
                (loginError.message.includes("404") ||
                  loginError.message.includes("401") ||
                  loginError.message.toLowerCase().includes("unauthorized") ||
                  loginError.message.toLowerCase().includes("not found") ||
                  loginError.message.toLowerCase().includes("não encontrado") ||
                  loginError.message.toLowerCase().includes("não cadastrado")));

            if (!isNotRegistered) {
              throw loginError;
            }

            // Cadastra o paciente
            setState((prev) => ({ ...prev, step: "registering" }));
            const registerData = buildRegisterData(cleanCpf, profile);
            await assemedClient.registerPatient(registerData);

            // Salva o emailTelemedicina no banco de dados do usuário
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase
                  .from("profiles")
                  .update({ email_telemedicina: registerData.email })
                  .eq("id", user.id);
                logger.info("[useAssemedConsultation] emailTelemedicina salvo:", registerData.email);
              }
            } catch (updateErr) {
              logger.error("[useAssemedConsultation] Erro ao salvar emailTelemedicina:", updateErr);
            }

            // Login após cadastro
            setState((prev) => ({ ...prev, step: "authenticating" }));
            const retryLogin = await assemedClient.login(cleanCpf);
            accessToken = retryLogin.accessToken;
          }

          assemedClient.setAccessToken(accessToken);
          assemedClient.setCpfPaciente(cleanCpf);
        }

        // Carrega especialidades disponíveis
        setState((prev) => ({
          ...prev,
          step: "loading_specialties",
          accessToken,
        }));

        // Decodifica token para obter pacienteId
        const decoded = assemedClient.decodeToken(accessToken);
        const pacienteId = decoded?.pacienteId ? parseInt(decoded.pacienteId, 10) : 0;

        const specialtiesResponse = await assemedClient.getSpecialties(pacienteId, { requerAgendamento: true });
        const availableSpecialties = specialtiesResponse.items || [];

        setState((prev) => ({
          ...prev,
          step: "selecting_specialty",
          specialties: availableSpecialties,
        }));
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao iniciar fluxo de teleconsulta";
        setError(message);
      }
    },
    []
  );

  /**
   * Cria o atendimento com a especialidade selecionada
   * Retorna true se criado com sucesso, false se houver erro
   */
  const createConsultation = useCallback(
    async (
      specialty: Specialty,
      respostasAnamnese?: AnamneseResposta[],
      exames?: { arquivoBase64: string }[]
    ): Promise<boolean> => {
      if (!state.accessToken) {
        setError("Token de acesso não disponível. Tente novamente.");
        return false;
      }

      setState((prev) => ({ ...prev, step: "creating_consultation" }));

      try {
        // Decodifica o token para obter o pacienteId
        const decoded = assemedClient.decodeToken(state.accessToken);
        if (!decoded?.pacienteId) {
          throw new Error("Não foi possível obter o ID do paciente do token.");
        }

        const pacienteId = parseInt(decoded.pacienteId, 10);

        // Força especialidadeId = 1 e nome 'Clínico Geral' para consulta imediata
        const clinicoGeralSpecialty = {
          ...specialty,
          id: 1,
          nome: "Clínico Geral",
        };

        const consultation = await assemedClient.createConsultation({
          formatoAtendimento: 0,
          tipoProfissional: clinicoGeralSpecialty.tipoProfissionalId,
          especialidadeId: 1,
          pacienteId,
          respostasAnamnese: respostasAnamnese || [],
          exames: exames || [],
          pacienteToken: assemedClient.getGlobalPatientToken() || undefined,
        });

        // Persiste o pacienteToken no cache para uso posterior (entrada na sala)
        if (consultation.pacienteToken) {
          assemedClient.storePatientToken(consultation.id, consultation.pacienteToken);
        }

        setState((prev) => ({
          ...prev,
          step: "in_consultation",
          activeConsultation: {
            ...consultation,
            especialidadeNome: "Clínico Geral",
          },
        }));
        return true;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao criar atendimento";
        setError(message);
        return false;
      }
    },
    [state.accessToken]
  );

  /**
   * Cria uma consulta imediata (on-demand) com especialista.
   * Usa a especialidade real (não força clínico geral).
   */
  const createSpecialistConsultation = useCallback(
    async (
      specialty: Specialty,
      respostasAnamnese?: AnamneseResposta[],
      exames?: { arquivoBase64: string }[]
    ): Promise<boolean> => {
      if (!state.accessToken) {
        setError("Token de acesso não disponível. Tente novamente.");
        return false;
      }

      setState((prev) => ({ ...prev, step: "creating_consultation" }));

      try {
        const decoded = assemedClient.decodeToken(state.accessToken);
        if (!decoded?.pacienteId) {
          throw new Error("Não foi possível obter o ID do paciente do token.");
        }

        const pacienteId = parseInt(decoded.pacienteId, 10);

        const consultation = await assemedClient.createConsultation({
          formatoAtendimento: 0,
          tipoProfissional: specialty.tipoProfissionalId,
          especialidadeId: specialty.id,
          pacienteId,
          respostasAnamnese: respostasAnamnese || [],
          exames: exames || [],
          pacienteToken: assemedClient.getGlobalPatientToken() || undefined,
        });

        if (consultation.pacienteToken) {
          assemedClient.storePatientToken(consultation.id, consultation.pacienteToken);
        }

        setState((prev) => ({
          ...prev,
          step: "in_consultation",
          activeConsultation: {
            ...consultation,
            especialidadeNome: specialty.nome,
          },
        }));
        return true;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao criar atendimento com especialista";
        setError(message);
        return false;
      }
    },
    [state.accessToken]
  );

  /**
   * Carrega profissionais disponíveis para uma especialidade (fluxo de agendamento)
   */
  const loadAvailableProfessionals = useCallback(
    async (especialidadeId: number): Promise<void> => {
      setState((prev) => ({
        ...prev,
        step: "loading_professionals",
        availableProfessionals: [],
        availableSchedules: [],
        error: null,
      }));

      try {
        // Decodifica token para obter pacienteId (necessário no POST)
        const token = assemedClient.getAccessToken();
        const decoded = token ? assemedClient.decodeToken(token) : null;
        const pacienteId = decoded?.pacienteId ? parseInt(decoded.pacienteId, 10) : 0;

        const response = await assemedClient.getAvailableProfessionals(pacienteId, especialidadeId);
        const professionals = response.items || [];

        setState((prev) => ({
          ...prev,
          step: "selecting_professional",
          availableProfessionals: professionals,
        }));
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao carregar profissionais disponíveis";
        setError(message);
      }
    },
    []
  );

  /**
   * Carrega horários disponíveis para um profissional (fluxo de agendamento)
   */
  const loadAvailableSchedules = useCallback(
    async (profissionalId: number, especialidadeId: number): Promise<void> => {
      setState((prev) => ({
        ...prev,
        step: "loading_schedules",
        availableSchedules: [],
        error: null,
      }));

      try {
        // Decodifica token para obter pacienteId
        const token = assemedClient.getAccessToken();
        const decoded = token ? assemedClient.decodeToken(token) : null;
        const pacienteId = decoded?.pacienteId ? parseInt(decoded.pacienteId, 10) : 0;

        const response = await assemedClient.getAvailableSchedules(profissionalId, pacienteId, especialidadeId);
        const schedules = response.items || [];

        setState((prev) => ({
          ...prev,
          step: "selecting_schedule",
          availableSchedules: schedules,
        }));
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao carregar horários disponíveis";
        setError(message);
      }
    },
    []
  );

  /**
   * Cria um atendimento agendado com especialista (tipoAtendimento = 3)
   */
  const createScheduledConsultation = useCallback(
    async (
      specialty: Specialty,
      slot: ScheduleSlot,
      respostasAnamnese: AnamneseResposta[] = [],
      exames: { arquivoBase64: string }[] = []
    ): Promise<boolean> => {
      if (!state.accessToken) {
        setError("Token de acesso não disponível. Tente novamente.");
        return false;
      }

      setState((prev) => ({ ...prev, step: "creating_consultation" }));

      try {
        const decoded = assemedClient.decodeToken(state.accessToken);
        if (!decoded?.pacienteId) {
          throw new Error("Não foi possível obter o ID do paciente do token.");
        }

        const pacienteId = parseInt(decoded.pacienteId, 10);

        const profissionalAgendamentoId = slot.profissionalId;

        const payload = {
          dataAgendamento: slot.dataHora,
          especialidadeId: specialty.id,
          pacienteId,
          profissionalAgendamentoId,
          tipoAtendimento: 3,
          formatoAtendimento: 0,
          respostasAnamnese,
          exames,
          cupomCodigo: "",
          textoPerguntaPaciente: "",
          fusoUsuario: 180,
          pacienteToken: assemedClient.getGlobalPatientToken() || undefined,
        };

        console.log("[Agendamento] Slot original da API:", JSON.stringify(slot));
        console.log("[Agendamento] Payload enviado:", JSON.stringify(payload));

        // Cria o agendamento
        const consultation = await assemedClient.createConsultation(payload);
        logger.info("[Agendamento] Consulta criada com sucesso:", consultation);

        // Persiste o pacienteToken no cache — o endpoint /obter não retorna o token
        if (consultation.pacienteToken) {
          assemedClient.storePatientToken(consultation.id, consultation.pacienteToken);
        }

        // Pós-agendamento: busca lista de consultas para garantir dados completos
        setState((prev) => ({ ...prev, isLoadingConsultations: true }));
        let foundConsultation = null;
        let attempts = 0;
        while (!foundConsultation && attempts < 3) {
          try {
            const response = await assemedClient.getConsultations(50, 0);
            // Filtra apenas consultas agendadas (com dataAgendamento)
            const agendadas = (response.items || []).filter(c => c.dataAgendamento);
            // Tenta encontrar a consulta recém-criada
            foundConsultation = agendadas.find(c =>
              c.pacienteId === pacienteId &&
              c.especialidadeId === specialty.id &&
              c.profissionalNome === slot.profissionalNome &&
              c.dataAgendamento === slot.dataHora
            );
            // Fallback: pega a mais recente
            if (!foundConsultation && agendadas.length > 0) {
              foundConsultation = agendadas.sort((a, b) => new Date(b.dataAgendamento).getTime() - new Date(a.dataAgendamento).getTime())[0];
            }
            if (!foundConsultation) {
              logger.warn("[Agendamento] Consulta recém-criada não encontrada, tentativa:", attempts + 1);
              await new Promise(res => setTimeout(res, 1000));
            }
          } catch (err) {
            logger.error("[Agendamento] Erro ao buscar consultas pós-agendamento:", err);
            break;
          }
          attempts++;
        }
        setState((prev) => ({ ...prev, isLoadingConsultations: false }));

        if (foundConsultation) {
          logger.info("[Agendamento] Consulta agendada encontrada:", foundConsultation);

          // Notifica consulta agendada + registra lembrete 30 min (fire-and-forget)
          notifyConsultaAgendada({
            consultaId: foundConsultation.id,
            especialidade: specialty.nome,
            profissional: slot.profissionalNome,
            dataHora: slot.dataHora,
          });

          // Preserva o pacienteToken da resposta de criação — o endpoint /obter
          // não retorna pacienteToken, mas o POST /api/Atendimentos sim.
          setState((prev) => ({
            ...prev,
            step: "in_consultation",
            activeConsultation: {
              ...foundConsultation,
              pacienteToken: foundConsultation.pacienteToken || consultation.pacienteToken,
            },
          }));
        } else {
          logger.warn("[Agendamento] Não foi possível identificar a consulta recém-agendada.");
          setState((prev) => ({
            ...prev,
            step: "in_consultation",
            activeConsultation: consultation, // fallback — já tem o token
          }));
        }
        return true;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao criar agendamento";
        setError(message);
        return false;
      }
    },
    [state.accessToken]
  );

  /**
   * Carrega o histórico de consultas do paciente
   */
  const loadConsultations = useCallback(async (): Promise<void> => {
    if (!state.accessToken) return;

    setState((prev) => ({ ...prev, isLoadingConsultations: true }));

    try {
      const response = await assemedClient.getConsultations(50, 0);
      setState((prev) => ({
        ...prev,
        consultations: response.items || [],
        isLoadingConsultations: false,
      }));
    } catch {
      setState((prev) => ({ ...prev, isLoadingConsultations: false }));
    }
  }, [state.accessToken]);

  /**
   * Inclui uma consulta agendada na fila e retorna os dados de sessão.
   * Deve ser chamado ao clicar em "Iniciar consulta" no dia do agendamento.
   */
  const joinScheduledConsultation = useCallback(
    async (consultationId: number): Promise<CreateConsultationResponse | null> => {
      try {
        return await assemedClient.incluirAtendimentoAgendadoNaFila(consultationId);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Não foi possível iniciar a consulta. Tente novamente.";
        setError(message);
        return null;
      }
    },
    []
  );

  /**
   * Cancela uma consulta
   */
  const cancelConsultation = useCallback(
    async (consultationId: number): Promise<void> => {
      try {
        await assemedClient.cancelConsultation(consultationId);
        // Recarrega a lista
        await loadConsultations();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Erro ao cancelar consulta";
        setError(message);
      }
    },
    [loadConsultations]
  );

  /**
   * Fecha a consulta ativa e volta para a tela principal
   */
  const closeConsultation = useCallback((): void => {
    setState((prev) => ({
      ...prev,
      step: "idle",
      activeConsultation: null,
    }));
  }, []);

  /**
   * Reseta o fluxo para o estado inicial
   */
  const resetFlow = useCallback((): void => {
    setState({
      step: "idle",
      accessToken: null,
      specialties: [],
      availableProfessionals: [],
      availableSchedules: [],
      activeConsultation: null,
      consultations: [],
      isLoadingConsultations: false,
      error: null,
    });
  }, []);

  /**
   * Volta para a seleção de especialidade
   */
  const backToSpecialtySelection = useCallback((): void => {
    setState((prev) => ({
      ...prev,
      step: "selecting_specialty",
      activeConsultation: null,
      error: null,
    }));
  }, []);

  return {
    ...state,
    silentAuthenticate,
    startConsultationFlow,
    createConsultation,
    createSpecialistConsultation,
    createScheduledConsultation,
    loadAvailableProfessionals,
    loadAvailableSchedules,
    loadConsultations,
    joinScheduledConsultation,
    cancelConsultation,
    closeConsultation,
    resetFlow,
    backToSpecialtySelection,
  };
}

function buildRegisterData(
  cpf: string,
  profile: ProfileData
): Parameters<typeof assemedClient.registerPatient>[0] {
  const gender = profile.gender === "F" ? "F" : "M";

  let dataNascimento = "1990-01-01T00:00:00.000Z";
  if (profile.birth_date) {
    if (profile.birth_date.includes("/")) {
      const [day, month, year] = profile.birth_date.split("/");
      dataNascimento = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`;
    } else if (profile.birth_date.includes("-")) {
      dataNascimento = profile.birth_date.includes("T")
        ? profile.birth_date
        : `${profile.birth_date}T00:00:00.000Z`;
    }
  }

  let telefone = profile.phone?.replace(/\D/g, "") || "";
  if (telefone.length < 10) {
    telefone = "00000000000";
  }

  // Gera alias de email para telemedicina
  let username = "";
  if (profile.email) {
    username = profile.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  }
  const aliasEmail = `paciente+${username}@novitatelemedicina.com.br`;

  return {
    nome: profile.full_name.substring(0, 250),
    cpf,
    dataNascimento,
    sexo: gender,
    telefone: telefone.substring(0, 20),
    email: aliasEmail.substring(0, 100),
  };
}
