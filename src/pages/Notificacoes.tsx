// Página com todas as notificações do usuário: filtro (todas / não lidas),
// marcar uma como lida e marcar todas como lidas. Renderiza dentro do
// PatientLayout (topbar já provido pelo layout).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import type { AppNotification } from "@/types/notification";

type Filter = "todas" | "nao_lidas";

export default function Notificacoes() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications(50);
  const [filter, setFilter] = useState<Filter>("todas");

  const visible = filter === "nao_lidas" ? notifications.filter((n) => !n.is_read) : notifications;

  const handleActivate = async (n: AppNotification) => {
    if (!n.is_read) await markRead(n.id);
    if (n.action_url) navigate(n.action_url);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {/* Cabeçalho */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notificações</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Tudo em dia"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex items-center gap-2">
        {([["todas", "Todas"], ["nao_lidas", "Não lidas"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === key ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
            {key === "nao_lidas" && unreadCount > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-50">
              <Bell className="h-7 w-7 text-slate-300" />
            </span>
            <p className="text-sm font-medium text-slate-600">
              {filter === "nao_lidas" ? "Nenhuma notificação não lida" : "Nenhuma notificação"}
            </p>
            <p className="text-xs text-slate-400">Avisaremos por aqui sobre o seu plano, pagamentos e documentos.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visible.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onActivate={handleActivate}
                onMarkRead={markRead}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
