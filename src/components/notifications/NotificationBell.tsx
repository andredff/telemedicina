// Sino de notificações + contador de não lidas + dropdown com as últimas.
// Pensado para o topbar do PatientLayout (substitui o sino estático que havia).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationItem } from "./NotificationItem";
import type { AppNotification } from "@/types/notification";

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications(8);

  const handleActivate = async (n: AppNotification) => {
    if (!n.is_read) await markRead(n.id);
    setOpen(false);
    if (n.action_url) navigate(n.action_url);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ""}`}
          className="relative rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">Notificações</p>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como lidas
            </button>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
              <Bell className="h-6 w-6 text-slate-300" />
            </span>
            <p className="text-sm font-medium text-slate-600">Nenhuma notificação</p>
            <p className="text-xs text-slate-400">Você está em dia. Avisaremos por aqui quando algo precisar de atenção.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[22rem]">
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onActivate={handleActivate}
                  onMarkRead={markRead}
                  compact
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Rodapé */}
        <div className="border-t border-slate-100 p-2">
          <button
            onClick={() => { setOpen(false); navigate("/notificacoes"); }}
            className="w-full rounded-lg px-3 py-2 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            Ver todas as notificações
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
