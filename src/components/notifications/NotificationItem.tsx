// Linha de notificação, reutilizada no dropdown do sino e na página completa.
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { notificationConfig, TONE_STYLES, type AppNotification } from "@/types/notification";

interface NotificationItemProps {
  notification: AppNotification;
  onActivate: (n: AppNotification) => void;
  onMarkRead: (id: string) => void;
  compact?: boolean;
}

export function NotificationItem({ notification, onActivate, onMarkRead, compact }: NotificationItemProps) {
  const cfg = notificationConfig(notification.type);
  const tone = TONE_STYLES[cfg.tone];
  const Icon = cfg.icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onActivate(notification)}
      onKeyDown={(e) => { if (e.key === "Enter") onActivate(notification); }}
      className={cn(
        "group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors cursor-pointer",
        notification.is_read ? "bg-transparent hover:bg-slate-50" : "bg-primary/[0.04] hover:bg-primary/[0.07]",
      )}
    >
      {/* Ícone por tom */}
      <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1", tone.bg, tone.ring)}>
        <Icon className={cn("h-[18px] w-[18px]", tone.fg)} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("truncate text-sm", notification.is_read ? "font-medium text-slate-700" : "font-semibold text-slate-900")}>
            {notification.title}
          </p>
          {!notification.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
        </div>
        <p className={cn("mt-0.5 text-xs text-slate-500", compact ? "line-clamp-2" : "")}>{notification.body}</p>
        <p className="mt-1 text-[11px] text-slate-400">
          {formatDistanceToNow(new Date(notification.created_at), { locale: ptBR, addSuffix: true })}
        </p>
      </div>

      {/* Marcar como lida (sem disparar a navegação) */}
      {!notification.is_read && (
        <button
          type="button"
          title="Marcar como lida"
          onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
          className="mt-0.5 rounded-lg p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100"
        >
          <Check className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
