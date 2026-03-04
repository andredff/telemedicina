import { useState, useCallback } from "react";
import { assemedClient, AssemedApiError } from "@/integrations/assemed/client";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

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
  | "creating_consultation"
  | "in_consultation"
  | "error";

interface ConsultationFlowState {
  step: ConsultationFlowStep;
  accessToken: string | null;
  specialties: Specialty[];
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
        }

        // Carrega especialidades
        setState((prev) => ({
          ...prev,
          step: "loading_specialties",
          accessToken,
        }));

        const specialtiesResponse = await assemedClient.getSpecialties(100, 0);
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
    async (specialty: Specialty): Promise<boolean> => {
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

        const consultation = await assemedClient.createConsultation({
          tipoProfissional: specialty.tipoProfissionalId,
          especialidadeId: specialty.id,
          pacienteId,
          exames: [],
        });

        setState((prev) => ({
          ...prev,
          step: "in_consultation",
          activeConsultation: consultation,
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
   * Carrega o histórico de consultas do paciente
   */
  const loadConsultations = useCallback(async (): Promise<void> => {
    if (!state.accessToken) return;

    setState((prev) => ({ ...prev, isLoadingConsultations: true }));

    try {
      const response = await assemedClient.getConsultations(20, 0);
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
    loadConsultations,
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
