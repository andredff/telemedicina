// Snapshot do status do plano do usuário, para o banner de vencimento e o
// alerta de plano vencido. Fonte: RPC get_plan_status() (migration de
// notificações), que devolve dias restantes + bucket já calculados no servidor.

import { useState, useEffect, useCallback } from "react";
import { getPlanStatus, type PlanStatus } from "@/lib/notifications";

interface UsePlanStatusReturn {
  status: PlanStatus | null;
  loading: boolean;
  /** Plano ativo e a <= 15 dias do fim (mas ainda não vencido). */
  isExpiringSoon: boolean;
  /** Plano vencido (expires_at no passado). */
  isExpired: boolean;
  refresh: () => Promise<void>;
}

export function usePlanStatus(): UsePlanStatusReturn {
  const [status, setStatus] = useState<PlanStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await getPlanStatus();
    setStatus(s);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const bucket = status?.bucket ?? null;
  const isExpired = bucket === "expired";
  const isExpiringSoon =
    !!status?.has_plan && bucket != null && bucket !== "ok" && bucket !== "expired";

  return { status, loading, isExpiringSoon, isExpired, refresh };
}
