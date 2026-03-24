import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Video, X, Clock, Loader2, Ban, Calendar, ChevronRight, ChevronDown, ChevronUp, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Consultation, ConsultationSimplified } from "@/integrations/assemed/types";
import { normalizeConsultationStatus, normalizeSimplifiedStatus } from "@/integrations/assemed/types";

const STORAGE_KEY = "novita_active_consultation";
const POLL_INTERVAL = 10000; // 10 segundos

interface CachedConsultation {
  id: number;
  especialidadeNome: string;
  profissionalNome: string | null;
  situacao: string;
  dataAgendamento?: string;
  tipoAtendimento?: number; // 1 = imediato, 3 = agendado
  _v?: number; // versão do cache para migração
}

function getCachedConsultation(): CachedConsultation | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function setCachedConsultation(consultation: CachedConsultation | null) {
  try {
    if (consultation) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consultation));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

interface ActiveConsultationBannerProps {
  accessToken: string | null;
}

export function ActiveConsultationBanner({ accessToken }: ActiveConsultationBannerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const hasLoaded = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Verifica status da consulta usando endpoint simplificado
   * GET /api/Atendimentos/{id}/simplificado
   */
  const checkConsultationStatus = useCallback(async (consultationId: number): Promise<ConsultationSimplified | null> => {
    try {
      if (!accessToken) return null;
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setAccessToken(accessToken);
      const response = await assemedClient.getConsultationStatus(consultationId);
      // Normaliza o status (API pode retornar em diferentes formatos)
      const normalizedStatus = normalizeSimplifiedStatus(response);
      console.log(`[ActiveConsultationBanner] Status simplificado consulta ${consultationId}:`, response.situacao, '-> normalizado:', normalizedStatus);
      return { ...response, situacao: normalizedStatus };
    } catch (err) {
      console.error("[ActiveConsultationBanner] Erro ao verificar status simplificado:", err);
      return null;
    }
  }, [accessToken]);

  /**
   * Carrega consulta ativa usando cache + endpoint simplificado
   * Se não houver cache, busca lista completa de consultas
   */
  const loadActiveConsultation = useCallback(async () => {
    try {
      if (!accessToken) return;
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setAccessToken(accessToken);
      
      // Primeiro tenta usar cache e verificar com endpoint simplificado
      const cached = getCachedConsultation();
      if (cached) {
        // Cache sem versão = formato antigo sem tipoAtendimento/dataAgendamento → força reload completo
        if (!cached._v) {
          console.log("[ActiveConsultationBanner] Cache antigo detectado, forçando reload completo");
          setCachedConsultation(null);
        } else {
          console.log("[ActiveConsultationBanner] Verificando consulta em cache:", cached.id);
          const status = await checkConsultationStatus(cached.id);

          if (status && (status.situacao === "AGUARDANDO" || status.situacao === "EM_ATENDIMENTO")) {
            const updatedCached = { ...cached, situacao: status.situacao, profissionalNome: status.profissionalNome };
            setCachedConsultation(updatedCached);
            setActiveConsultation({
              id: cached.id,
              pacienteId: 0,
              pacienteNome: "",
              especialidadeId: 0,
              especialidadeNome: cached.especialidadeNome,
              tipoProfissionalId: 0,
              profissionalNome: status.profissionalNome,
              status: status.situacao,
              dataHoraCriacao: "",
              dataHoraInicio: null,
              dataHoraFim: null,
              pacienteToken: null,
              dataAgendamento: cached.dataAgendamento,
              tipoAtendimento: cached.tipoAtendimento,
            });
            hasLoaded.current = true;
            return;
          } else {
            console.log("[ActiveConsultationBanner] Consulta em cache não está mais ativa");
            setCachedConsultation(null);
          }
        }
      }

      // Fallback: busca lista completa de consultas
      console.log("[ActiveConsultationBanner] Buscando lista completa de consultas");
      const response = await assemedClient.getConsultations(10, 0);
      const consultations = response.items || [];
      
      console.log("[ActiveConsultationBanner] Consultas carregadas:", consultations.length);

      // Encontra a primeira consulta ativa usando normalizeConsultationStatus
      const active = consultations.find((c) => {
        const normalized = normalizeConsultationStatus(c);
        return normalized === "AGUARDANDO" || normalized === "EM_ATENDIMENTO";
      });
      
      console.log("[ActiveConsultationBanner] Consulta ativa encontrada:", active?.id ?? "nenhuma");
      
      if (active) {
        // Salva em cache para próximas verificações
        setCachedConsultation({
          id: active.id,
          especialidadeNome: active.especialidadeNome,
          profissionalNome: active.profissionalNome,
          situacao: normalizeConsultationStatus(active),
          dataAgendamento: active.dataAgendamento,
          tipoAtendimento: active.tipoAtendimento,
          _v: 2,
        });
      } else {
        setCachedConsultation(null);
      }
      
      setActiveConsultation(active || null);
      hasLoaded.current = true;
    } catch (err) {
      console.error("[ActiveConsultationBanner] Erro ao buscar consultas:", err);
      setActiveConsultation(null);
    }
  }, [accessToken, checkConsultationStatus]);

  // Rastreia consultas para as quais já redirecionamos (evita loop)
  const redirectedIds = useRef<Set<number>>(new Set());

  /**
   * Polling periódico usando endpoint simplificado
   */
  useEffect(() => {
    if (!accessToken || isDismissed || !activeConsultation) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const pollStatus = async () => {
      const status = await checkConsultationStatus(activeConsultation.id);

      if (!status) return;

      if (status.situacao === "CONCLUIDO" || status.situacao === "CANCELADO") {
        // Consulta finalizada - limpa cache e estado
        console.log("[ActiveConsultationBanner] Consulta finalizada:", status.situacao);
        setCachedConsultation(null);
        setActiveConsultation(null);
        return;
      }

      // Redireciona automaticamente quando médico inicia atendimento
      if (status.situacao === "EM_ATENDIMENTO" && !redirectedIds.current.has(activeConsultation.id)) {
        const alreadyInRoom = location.pathname.startsWith("/sala-espera");
        if (!alreadyInRoom) {
          redirectedIds.current.add(activeConsultation.id);
          console.log("[ActiveConsultationBanner] Médico iniciou atendimento, redirecionando...");
          navigate(
            `/sala-espera/${activeConsultation.id}?especialidade=${encodeURIComponent(
              activeConsultation.especialidadeNome || "Consulta"
            )}`
          );
          return;
        }
      }

      // Atualiza dados do profissional se mudou
      if (status.profissionalNome !== activeConsultation.profissionalNome ||
          status.situacao !== activeConsultation.status) {
        setActiveConsultation(prev => prev ? {
          ...prev,
          profissionalNome: status.profissionalNome,
          status: status.situacao,
        } : null);

        const cached = getCachedConsultation();
        if (cached) {
          setCachedConsultation({
            ...cached,
            profissionalNome: status.profissionalNome,
            situacao: status.situacao,
          });
        }
      }
    };

    // Verifica imediatamente e depois a cada intervalo
    pollStatus();
    pollingRef.current = setInterval(pollStatus, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [accessToken, isDismissed, activeConsultation, checkConsultationStatus, navigate, location.pathname]);

  useEffect(() => {
    if (!isDismissed) {
      loadActiveConsultation();
    }
  }, [loadActiveConsultation, isDismissed]);

  const handleEnter = () => {
    if (activeConsultation) {
      navigate(
        `/sala-espera/${activeConsultation.id}?especialidade=${encodeURIComponent(
          activeConsultation.especialidadeNome || "Consulta"
        )}`
      );
    }
  };

  const handleOpenNewTab = async () => {
    if (!activeConsultation || !accessToken) return;
    try {
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setAccessToken(accessToken);
      const fresh = await assemedClient.getConsultation(activeConsultation.id);
      if (!fresh?.pacienteToken) {
        toast({ title: "Consulta indisponível", description: "Token do paciente não disponível.", variant: "destructive" });
        return;
      }
      const isSandbox = import.meta.env.VITE_ASSEMED_SANDBOX === "true" || import.meta.env.DEV;
      const base = isSandbox ? "https://dev-app-assemed.azurewebsites.net" : "https://app.assemedtelemedicina.com";
      window.open(`${base}/sala-espera-externa/${activeConsultation.id}?token=${encodeURIComponent(fresh.pacienteToken)}`, "_blank");
    } catch (err) {
      toast({ title: "Erro", description: "Não foi possível abrir a consulta.", variant: "destructive" });
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const handleCancel = async () => {
    if (!activeConsultation || !accessToken) return;
    
    setIsCancelling(true);
    try {
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setAccessToken(accessToken);
      await assemedClient.cancelConsultation(activeConsultation.id);
      
      // Limpa cache e estado
      setCachedConsultation(null);
      setActiveConsultation(null);
      
      toast({
        title: "Consulta cancelada",
        description: "Sua consulta foi cancelada com sucesso.",
      });
    } catch (err) {
      console.error("[ActiveConsultationBanner] Erro ao cancelar consulta:", err);
      toast({
        title: "Erro ao cancelar",
        description: "Não foi possível cancelar a consulta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Não mostra na própria sala de espera
  if (location.pathname.startsWith("/sala-espera")) return null;
  if (!activeConsultation || isDismissed) return null;

  const normalizedStatus = normalizeConsultationStatus(activeConsultation);
  const isWaiting = normalizedStatus === "AGUARDANDO";
  const isInProgress = normalizedStatus === "EM_ATENDIMENTO";
  const isAgendada = !!activeConsultation.dataAgendamento || activeConsultation.tipoAtendimento === 3;

  const agendamentoDate = activeConsultation.dataAgendamento
    ? new Date(activeConsultation.dataAgendamento)
    : null;
  const now = new Date();
  const releaseDate = agendamentoDate
    ? new Date(agendamentoDate.getTime() - 10 * 60000)
    : null;
  const canEnterAgendada =
    !isAgendada ||
    (agendamentoDate !== null &&
      now.toDateString() === agendamentoDate.toDateString() &&
      now >= releaseDate!);

  const especialidade = activeConsultation.especialidadeNome || "Consulta";

  // ── Config da barra de status (usada tanto no chip minimizado quanto no card) ─
  let barBg: string;
  let chipLabel: string;
  let ChipIcon: React.ComponentType<{ className?: string }>;
  let hasPingDot = false;
  let hasPulseDot = false;

  if (isInProgress) {
    barBg = "bg-green-500";
    chipLabel = "Em andamento";
    ChipIcon = Video;
    hasPulseDot = true;
  } else if (isAgendada && isWaiting && !canEnterAgendada) {
    barBg = "bg-blue-600";
    chipLabel = "Consulta agendada";
    ChipIcon = Calendar;
  } else {
    barBg = "bg-gradient-to-r from-amber-500 to-orange-500";
    chipLabel = isAgendada ? "Horário liberado" : "Aguardando";
    ChipIcon = Stethoscope;
    hasPingDot = true;
  }

  // ── Estado minimizado: pílula compacta ───────────────────────────────────
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-2xl ${barBg} cursor-pointer hover:opacity-90 transition-opacity`}
          onClick={() => setIsMinimized(false)}
          role="button"
          aria-label="Expandir informações da consulta"
        >
          {hasPingDot && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
          )}
          {hasPulseDot && <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />}
          <ChipIcon className="h-3.5 w-3.5 text-white shrink-0" />
          <span className="text-xs font-semibold text-white uppercase tracking-wide">{chipLabel}</span>
          <ChevronUp className="h-3.5 w-3.5 text-white/80 ml-1" />
        </div>
      </div>
    );
  }

  // ── Botões de controle do header (minimizar + fechar) ───────────────────
  const HeaderControls = () => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setIsMinimized(true)}
        className="text-white/70 hover:text-white transition-colors p-0.5"
        title="Minimizar"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleDismiss}
        className="text-white/70 hover:text-white transition-colors p-0.5"
        title="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  // ── Estado: em andamento ─────────────────────────────────────────────────
  if (isInProgress) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="w-80 rounded-2xl overflow-hidden shadow-2xl border border-green-200 bg-white">
          <div className="bg-green-500 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-xs font-semibold text-white uppercase tracking-wide">
                Consulta em andamento
              </span>
            </div>
            <HeaderControls />
          </div>

          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                <Video className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{especialidade}</p>
                {activeConsultation.profissionalNome && (
                  <p className="text-xs text-gray-500 truncate">{activeConsultation.profissionalNome}</p>
                )}
              </div>
            </div>

            <Button
              onClick={handleEnter}
              className="w-full bg-green-500 hover:bg-green-600 text-white gap-2"
              size="sm"
            >
              <Video className="h-4 w-4" />
              Entrar na Consulta
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Estado: agendada aguardando horário ──────────────────────────────────
  if (isAgendada && isWaiting && !canEnterAgendada) {
    const releaseTimeStr = releaseDate
      ? releaseDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : null;
    const scheduledDateStr = agendamentoDate
      ? agendamentoDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      : null;
    const scheduledTimeStr = agendamentoDate
      ? agendamentoDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : null;

    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="w-80 rounded-2xl overflow-hidden shadow-2xl border border-blue-200 bg-white">
          <div className="bg-blue-600 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-white" />
              <span className="text-xs font-semibold text-white uppercase tracking-wide">
                Consulta agendada
              </span>
            </div>
            <HeaderControls />
          </div>

          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <Stethoscope className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{especialidade}</p>
                {activeConsultation.profissionalNome && (
                  <p className="text-xs text-gray-500 truncate">{activeConsultation.profissionalNome}</p>
                )}
              </div>
            </div>

            {scheduledDateStr && scheduledTimeStr && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-3 flex items-center gap-3">
                <div className="text-center shrink-0">
                  <p className="text-[10px] text-blue-500 uppercase font-medium leading-none mb-0.5">Data</p>
                  <p className="text-sm font-bold text-blue-800">{scheduledDateStr}</p>
                </div>
                <div className="w-px h-8 bg-blue-200" />
                <div className="text-center shrink-0">
                  <p className="text-[10px] text-blue-500 uppercase font-medium leading-none mb-0.5">Horário</p>
                  <p className="text-xl font-black text-blue-800">{scheduledTimeStr}</p>
                </div>
                {releaseTimeStr && (
                  <>
                    <div className="w-px h-8 bg-blue-200" />
                    <div className="flex-1">
                      <p className="text-[10px] text-blue-500 uppercase font-medium leading-none mb-0.5">Acesso</p>
                      <p className="text-xs font-semibold text-blue-700">a partir das {releaseTimeStr}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            <Button
              onClick={handleCancel}
              size="sm"
              variant="outline"
              className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              disabled={isCancelling}
            >
              {isCancelling
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Ban className="h-4 w-4" />}
              Cancelar agendamento
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Estado: aguardando atendimento (imediata ou agendada no horário) ─────
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="w-80 rounded-2xl overflow-hidden shadow-2xl border border-amber-200 bg-white">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            <span className="text-xs font-semibold text-white uppercase tracking-wide">
              {isAgendada ? "Horário liberado" : "Aguardando atendimento"}
            </span>
          </div>
          <HeaderControls />
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative w-10 h-10 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-amber-600" />
              </div>
              <span className="absolute -inset-1 rounded-xl border-2 border-amber-300 animate-ping opacity-40" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">{especialidade}</p>
              <p className="text-xs text-gray-500">
                {activeConsultation.profissionalNome
                  ? activeConsultation.profissionalNome
                  : isAgendada
                  ? "Médico confirmado"
                  : "Buscando médico disponível..."}
              </p>
            </div>
          </div>

          {isAgendada && agendamentoDate && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                Agendada para{" "}
                <strong>
                  {agendamentoDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </strong>
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleEnter}
              size="sm"
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white gap-2"
            >
              {isWaiting && !isAgendada ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrar na Fila
                </>
              ) : (
                <>
                  <Video className="h-4 w-4" />
                  Entrar na Consulta
                </>
              )}
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
            <Button
              onClick={handleCancel}
              size="sm"
              variant="outline"
              className="border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 px-3"
              disabled={isCancelling}
              title="Cancelar consulta"
            >
              {isCancelling
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Ban className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
