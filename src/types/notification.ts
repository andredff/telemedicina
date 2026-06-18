// Tipos e metadados de apresentação das notificações internas.
// O backend (migration 20260612000000_notifications.sql) é a fonte da verdade
// para os valores de `type` — mantenha os dois lados em sincronia.

import {
  Bell, CalendarClock, AlertTriangle, CreditCard, CheckCircle2,
  Video, FileText, FlaskConical, ClipboardCheck, ShieldAlert,
  type LucideIcon,
} from "lucide-react";

export type NotificationType =
  | "plan_expiring"
  | "plan_expired"
  | "payment_pending"
  | "payment_confirmed"
  | "consultation_scheduled"
  | "prescription_available"
  | "exam_available"
  | "certificate_available"
  | "general"
  | "security_alert";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  action_label: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type NotificationTone = "info" | "warning" | "danger" | "success";

interface NotificationTypeConfig {
  icon: LucideIcon;
  tone: NotificationTone;
  label: string;
}

/** Ícone, tom (cor) e rótulo curto por tipo de notificação. */
export const NOTIFICATION_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
  plan_expiring:          { icon: CalendarClock,  tone: "warning", label: "Plano vencendo" },
  plan_expired:           { icon: AlertTriangle,  tone: "danger",  label: "Plano vencido" },
  payment_pending:        { icon: CreditCard,     tone: "warning", label: "Pagamento pendente" },
  payment_confirmed:      { icon: CheckCircle2,   tone: "success", label: "Pagamento confirmado" },
  consultation_scheduled: { icon: Video,          tone: "info",    label: "Consulta agendada" },
  prescription_available: { icon: FileText,       tone: "info",    label: "Receita disponível" },
  exam_available:         { icon: FlaskConical,   tone: "info",    label: "Exame disponível" },
  certificate_available:  { icon: ClipboardCheck, tone: "info",    label: "Atestado disponível" },
  general:                { icon: Bell,           tone: "info",    label: "Aviso" },
  security_alert:         { icon: ShieldAlert,    tone: "danger",  label: "Segurança" },
};

/** Classes Tailwind por tom — usadas no ícone/realce das notificações. */
export const TONE_STYLES: Record<NotificationTone, { bg: string; fg: string; ring: string }> = {
  info:    { bg: "bg-blue-50",   fg: "text-blue-600",   ring: "ring-blue-200" },
  warning: { bg: "bg-amber-50",  fg: "text-amber-600",  ring: "ring-amber-200" },
  danger:  { bg: "bg-red-50",    fg: "text-red-600",    ring: "ring-red-200" },
  success: { bg: "bg-green-50",  fg: "text-green-600",  ring: "ring-green-200" },
};

export function notificationConfig(type: NotificationType): NotificationTypeConfig {
  return NOTIFICATION_CONFIG[type] ?? NOTIFICATION_CONFIG.general;
}
