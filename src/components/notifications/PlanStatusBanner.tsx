// Banner/alerta de status do plano, exibido no topo da área logada do paciente.
//   • Plano vencido  → alerta vermelho (não dispensável).
//   • Plano vencendo (<=15 dias) → banner âmbar dispensável na sessão.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarClock, X } from "lucide-react";
import { usePlanStatus } from "@/hooks/usePlanStatus";

const DISMISS_KEY = "novita:plan-banner-dismissed";

export function PlanStatusBanner() {
  const navigate = useNavigate();
  const { status, isExpiringSoon, isExpired } = usePlanStatus();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  if (isExpired) {
    return (
      <div className="border-b border-red-200 bg-red-50">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="min-w-0 flex-1 text-sm text-red-800">
            <strong className="font-semibold">Seu plano expirou.</strong>{" "}
            Algumas funcionalidades podem estar indisponíveis até a renovação.
          </p>
          <button
            onClick={() => navigate("/meu-plano")}
            className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700"
          >
            Renovar agora
          </button>
        </div>
      </div>
    );
  }

  if (isExpiringSoon && !dismissed) {
    const days = status?.days_remaining ?? null;
    const message =
      days === 0 ? "Seu plano vence hoje."
      : days === 1 ? "Seu plano termina amanhã."
      : `Seu plano termina em ${days} dias.`;
    return (
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <CalendarClock className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1 text-sm text-amber-800">
            <strong className="font-semibold">{message}</strong>{" "}
            Renove para continuar usando a plataforma sem interrupções.
          </p>
          <button
            onClick={() => navigate("/meu-plano")}
            className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
          >
            Renovar
          </button>
          <button
            aria-label="Dispensar aviso"
            onClick={() => { setDismissed(true); try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ } }}
            className="shrink-0 rounded-lg p-1 text-amber-600 transition-colors hover:bg-amber-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
