import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  checkSubscriptionStatus,
  getSpecialties,
  startConsultation,
  getConsultationHistory,
  pollConsultationStatus,
  cancelConsultation,
  submitEvaluation,
  getTelemedicineIframeUrl,
  type TelemedicinePatient,
  type SubscriptionStatus,
  type StartConsultationResult,
} from "@/services/telemedicineService";
import type { Specialty, Consultation, ConsultationStatus } from "@/integrations/assemed";

// ==========================================
// HOOK: useSubscriptionStatus
// ==========================================

export function useSubscriptionStatus(userId: string | null) {
  return useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status", userId],
    queryFn: () => checkSubscriptionStatus(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

// ==========================================
// HOOK: useSpecialties
// ==========================================

export function useSpecialties() {
  return useQuery<Specialty[]>({
    queryKey: ["telemedicine-specialties"],
    queryFn: getSpecialties,
    staleTime: 1000 * 60 * 30, // 30 minutos
  });
}

// ==========================================
// HOOK: useConsultationHistory
// ==========================================

export function useConsultationHistory() {
  return useQuery<Consultation[]>({
    queryKey: ["consultation-history"],
    queryFn: getConsultationHistory,
    staleTime: 1000 * 60, // 1 minuto
  });
}

// ==========================================
// HOOK: useStartConsultation
// ==========================================

export function useStartConsultation() {
  const queryClient = useQueryClient();

  return useMutation<
    StartConsultationResult,
    Error,
    {
      patient: TelemedicinePatient;
      especialidadeId: number;
      tipoProfissionalId: number;
    }
  >({
    mutationFn: ({ patient, especialidadeId, tipoProfissionalId }) =>
      startConsultation(patient, especialidadeId, tipoProfissionalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultation-history"] });
    },
  });
}

// ==========================================
// HOOK: useCancelConsultation
// ==========================================

export function useCancelConsultation() {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, number>({
    mutationFn: cancelConsultation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consultation-history"] });
    },
  });
}

// ==========================================
// HOOK: useSubmitEvaluation
// ==========================================

export function useSubmitEvaluation() {
  return useMutation<
    boolean,
    Error,
    { consultationId: number; rating: number; comment?: string }
  >({
    mutationFn: ({ consultationId, rating, comment }) =>
      submitEvaluation(consultationId, rating, comment),
  });
}

// ==========================================
// HOOK: useConsultationStatusPolling
// ==========================================

export function useConsultationStatusPolling(
  consultationId: number | null,
  enabled: boolean = true
) {
  const [status, setStatus] = useState<ConsultationStatus | null>(null);

  useEffect(() => {
    if (!consultationId || !enabled) return;

    const pollStatus = async () => {
      const newStatus = await pollConsultationStatus(consultationId);
      setStatus(newStatus);

      // Para de fazer polling se a consulta foi concluída ou cancelada
      if (newStatus === "CONCLUIDO" || newStatus === "CANCELADO") {
        return;
      }
    };

    // Polling inicial
    pollStatus();

    // Configura intervalo de polling (a cada 10 segundos)
    const interval = setInterval(pollStatus, 10000);

    return () => clearInterval(interval);
  }, [consultationId, enabled]);

  return status;
}

// ==========================================
// HOOK: useTelemedicine (combinado)
// ==========================================

export interface UseTelemedicineOptions {
  userId: string | null;
  userProfile: {
    full_name: string;
    cpf: string;
    email: string;
    phone: string;
    birth_date: string;
    gender: "M" | "F";
  } | null;
}

export interface UseTelemedicineReturn {
  // Status da assinatura
  subscription: SubscriptionStatus | undefined;
  isSubscriptionLoading: boolean;
  canAccessTelemedicine: boolean;

  // Especialidades
  specialties: Specialty[];
  isSpecialtiesLoading: boolean;

  // Histórico de consultas
  consultations: Consultation[];
  isConsultationsLoading: boolean;

  // Ações
  startNewConsultation: (
    especialidadeId: number,
    tipoProfissionalId: number
  ) => Promise<StartConsultationResult>;
  isStartingConsultation: boolean;

  cancelActiveConsultation: (consultationId: number) => Promise<boolean>;
  isCancellingConsultation: boolean;

  submitConsultationEvaluation: (
    consultationId: number,
    rating: number,
    comment?: string
  ) => Promise<boolean>;

  // URL do iframe
  iframeUrl: string;

  // Consulta ativa
  activeConsultation: StartConsultationResult | null;
  setActiveConsultation: (consultation: StartConsultationResult | null) => void;
  activeConsultationStatus: ConsultationStatus | null;
}

export function useTelemedicine({
  userId,
  userProfile,
}: UseTelemedicineOptions): UseTelemedicineReturn {
  const [activeConsultation, setActiveConsultation] =
    useState<StartConsultationResult | null>(null);

  // Queries
  const {
    data: subscription,
    isLoading: isSubscriptionLoading,
  } = useSubscriptionStatus(userId);

  const {
    data: specialties = [],
    isLoading: isSpecialtiesLoading,
  } = useSpecialties();

  const {
    data: consultations = [],
    isLoading: isConsultationsLoading,
  } = useConsultationHistory();

  // Mutations
  const startConsultationMutation = useStartConsultation();
  const cancelConsultationMutation = useCancelConsultation();
  const submitEvaluationMutation = useSubmitEvaluation();

  // Polling do status da consulta ativa
  const activeConsultationStatus = useConsultationStatusPolling(
    activeConsultation?.consultationId || null,
    activeConsultation?.success === true
  );

  // Helpers
  const canAccessTelemedicine = subscription?.isActive === true;
  const iframeUrl = getTelemedicineIframeUrl();

  // Actions
  const startNewConsultation = useCallback(
    async (
      especialidadeId: number,
      tipoProfissionalId: number
    ): Promise<StartConsultationResult> => {
      if (!userId || !userProfile) {
        return {
          success: false,
          error: "Usuário não autenticado",
        };
      }

      const patient: TelemedicinePatient = {
        id: userId,
        nome: userProfile.full_name,
        cpf: userProfile.cpf,
        email: userProfile.email,
        telefone: userProfile.phone,
        dataNascimento: userProfile.birth_date,
        sexo: userProfile.gender,
      };

      const result = await startConsultationMutation.mutateAsync({
        patient,
        especialidadeId,
        tipoProfissionalId,
      });

      if (result.success) {
        setActiveConsultation(result);
      }

      return result;
    },
    [userId, userProfile, startConsultationMutation]
  );

  const cancelActiveConsultation = useCallback(
    async (consultationId: number): Promise<boolean> => {
      const success = await cancelConsultationMutation.mutateAsync(consultationId);
      if (success && activeConsultation?.consultationId === consultationId) {
        setActiveConsultation(null);
      }
      return success;
    },
    [cancelConsultationMutation, activeConsultation]
  );

  const submitConsultationEvaluation = useCallback(
    async (
      consultationId: number,
      rating: number,
      comment?: string
    ): Promise<boolean> => {
      return submitEvaluationMutation.mutateAsync({
        consultationId,
        rating,
        comment,
      });
    },
    [submitEvaluationMutation]
  );

  return {
    // Status da assinatura
    subscription,
    isSubscriptionLoading,
    canAccessTelemedicine,

    // Especialidades
    specialties,
    isSpecialtiesLoading,

    // Histórico de consultas
    consultations,
    isConsultationsLoading,

    // Ações
    startNewConsultation,
    isStartingConsultation: startConsultationMutation.isPending,

    cancelActiveConsultation,
    isCancellingConsultation: cancelConsultationMutation.isPending,

    submitConsultationEvaluation,

    // URL do iframe
    iframeUrl,

    // Consulta ativa
    activeConsultation,
    setActiveConsultation,
    activeConsultationStatus,
  };
}
