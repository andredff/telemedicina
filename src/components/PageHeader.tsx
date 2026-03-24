import { Home, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  /** Título principal da página */
  title: string;
  /** Subtítulo descritivo */
  subtitle?: string;
  /** Ícone decorativo (Lucide component) */
  icon?: React.ComponentType<{ className?: string }>;
  /** Cor do ícone — ex: "text-primary" */
  iconColor?: string;
  /** Background do ícone — ex: "bg-primary/10" */
  iconBg?: string;
  /** Ações do lado direito (botões, etc.) */
  actions?: React.ReactNode;
  /**
   * Crumbs entre Dashboard e o título atual.
   * Ex: [{ label: "Receituários", to: "/prescriptions" }]
   * Gera: Dashboard / Receituários / Título
   */
  crumbs?: Crumb[];
}

/**
 * Cabeçalho de página padronizado para todas as telas internas.
 * Inclui breadcrumb + título + subtítulo + ações.
 */
const PageHeader = ({
  title,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  actions,
  crumbs = [],
}: PageHeaderProps) => {
  const navigate = useNavigate();

  // Trilha completa: Dashboard → [crumbs] → título (sempre o último)
  const trail: (Crumb & { clickable: boolean })[] = [
    { label: "Dashboard", to: "/dashboard", clickable: true },
    ...crumbs.map((c) => ({ ...c, clickable: !!c.to })),
    { label: title, clickable: false },
  ];

  return (
    <div className="mb-8">
      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <nav aria-label="Navegação" className="flex items-center gap-1 text-sm mb-5 flex-wrap">
        {trail.map((crumb, i) => {
          const isFirst = i === 0;
          const isLast = i === trail.length - 1;
          return (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              )}
              {crumb.clickable && crumb.to ? (
                <button
                  onClick={() => navigate(crumb.to!)}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors group"
                >
                  {isFirst && (
                    <Home className="h-3.5 w-3.5 shrink-0 group-hover:text-primary transition-colors" />
                  )}
                  <span>{crumb.label}</span>
                </button>
              ) : (
                <span
                  className={
                    isLast
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                  }
                >
                  {isFirst && (
                    <Home className="h-3.5 w-3.5 inline mr-1 mb-0.5 shrink-0" />
                  )}
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>

      {/* ── Title row ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          {Icon && (
            <div
              className={`w-11 h-11 rounded-xl ${iconBg} border border-border/50 flex items-center justify-center shrink-0 mt-0.5`}
            >
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
