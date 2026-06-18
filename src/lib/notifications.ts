// Cliente das notificações internas. Encapsula as RPCs e queries da tabela
// `public.notifications`. As RPCs e a tabela ainda não estão nos tipos gerados
// do Supabase — usamos narrow cast, como em src/lib/audit.ts.

import { supabase } from "@/integrations/supabase/client";
import type { AppNotification, NotificationType } from "@/types/notification";

type RpcResult<T = unknown> = { data: T; error: { message: string } | null };
type RpcFn = <T = unknown>(fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<T>>;
const rpc: RpcFn = (fn, args) =>
  (supabase.rpc as unknown as RpcFn)(fn, args ?? {});

// Acesso à tabela sem os tipos gerados (idem Teleconsultas → consultation_credits).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("notifications");

export interface PlanStatus {
  has_plan: boolean;
  status: string | null;
  plan_name: string | null;
  expires_at: string | null;
  days_remaining: number | null;
  /** 'ok' | 'd15' | 'd10' | 'd5' | 'd1' | 'd0' | 'expired' | null */
  bucket: string | null;
}

/** GET — lista as notificações do usuário (mais recentes primeiro). */
export async function listNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await table()
    .select("id, user_id, type, title, body, action_label, action_url, is_read, read_at, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as AppNotification[]) ?? [];
}

/** GET — quantidade de não lidas. */
export async function getUnreadCount(): Promise<number> {
  const { data, error } = await rpc<number>("unread_notification_count");
  if (error || typeof data !== "number") return 0;
  return data;
}

/** PATCH — marca uma notificação como lida. */
export async function markRead(id: string): Promise<void> {
  await rpc("mark_notification_read", { p_id: id });
}

/** PATCH — marca todas as não lidas como lidas. Retorna quantas mudaram. */
export async function markAllRead(): Promise<number> {
  const { data, error } = await rpc<number>("mark_all_notifications_read");
  if (error || typeof data !== "number") return 0;
  return data;
}

/** POST — cria uma notificação para o próprio usuário (deduplicada por dedupKey). */
export async function createNotification(params: {
  type: NotificationType;
  title: string;
  body: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  dedupKey?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const { data, error } = await rpc<string | null>("create_notification", {
    p_type: params.type,
    p_title: params.title,
    p_body: params.body,
    p_action_label: params.actionLabel ?? null,
    p_action_url: params.actionUrl ?? null,
    p_dedup_key: params.dedupKey ?? null,
    p_metadata: params.metadata ?? {},
  });
  if (error) return null;
  return typeof data === "string" ? data : null;
}

/** GET — status do plano atual (para banner/alertas). */
export async function getPlanStatus(): Promise<PlanStatus | null> {
  const { data, error } = await rpc<PlanStatus[] | PlanStatus>("get_plan_status");
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as PlanStatus) ?? null;
}
