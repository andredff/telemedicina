import { Home, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackLinkProps {
  to?: string;
  label?: string;
}

/**
 * Breadcrumb de navegação. Sempre inicia em Dashboard.
 * Uso: <BackLink to="/dashboard" label="Receituários" />
 * Renderiza: 🏠 Dashboard / Receituários
 */
const BackLink = ({ to = "/dashboard", label }: BackLinkProps) => {
  const navigate = useNavigate();

  const isDashboard = to === "/dashboard" && !label;

  return (
    <nav
      aria-label="Navegação"
      className="flex items-center gap-1 text-sm mb-6"
    >
      <button
        onClick={() => navigate("/dashboard")}
        className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
      >
        <Home className="h-3.5 w-3.5 group-hover:text-primary transition-colors" />
        <span>Dashboard</span>
      </button>

      {label && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
          {to !== "/dashboard" ? (
            <button
              onClick={() => navigate(to)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </button>
          ) : (
            <span className="text-foreground font-medium">{label}</span>
          )}
        </>
      )}
    </nav>
  );
};

export default BackLink;
