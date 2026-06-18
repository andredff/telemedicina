// Estado das notificações do usuário logado: lista, contador de não lidas e
// atualização ao vivo via Supabase Realtime (postgres_changes na tabela
// `notifications`, que entra na publication pela migration). Segue o padrão de
// realtime já usado em Teleconsultas/ConsultaPage.

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listNotifications, getUnreadCount, markRead as apiMarkRead,
  markAllRead as apiMarkAllRead,
} from "@/lib/notifications";
import type { AppNotification } from "@/types/notification";

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(limit = 30): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const [list, count] = await Promise.all([listNotifications(limit), getUnreadCount()]);
    setNotifications(list);
    setUnreadCount(count);
    setLoading(false);
  }, [limit]);

  // Initial load + resolve current user id (for the realtime filter).
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      userIdRef.current = user?.id ?? null;
      if (!user) { setLoading(false); return; }
      await refresh();
    })();
    return () => { active = false; };
  }, [refresh]);

  // Realtime: novas notificações e mudanças de leitura.
  useEffect(() => {
    const uid = userIdRef.current;
    if (!uid) return;

    const channel = supabase
      .channel(`notifications-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) =>
            prev.some((n) => n.id === row.id) ? prev : [row, ...prev].slice(0, limit)
          );
          if (!row.is_read) setUnreadCount((c) => c + 1);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => prev.map((n) => (n.id === row.id ? { ...n, ...row } : n)));
          // Recalcula o contador de forma autoritativa (COUNT indexado e barato).
          void getUnreadCount().then(setUnreadCount);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loading, limit]);

  const markRead = useCallback(async (id: string) => {
    // Otimista: reflete na hora; realtime/refresh confirmam.
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.is_read ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await apiMarkRead(id);
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => (n.is_read ? n : { ...n, is_read: true, read_at: new Date().toISOString() })));
    setUnreadCount(0);
    await apiMarkAllRead();
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh };
}
