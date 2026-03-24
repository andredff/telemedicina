import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackLinkProps {
  to?: string | number;
  label?: string;
}

const BackLink = ({ to = "/dashboard", label = "Voltar ao Dashboard" }: BackLinkProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (typeof to === "number") {
      navigate(to);
    } else {
      navigate(to);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-6 group"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
      {label}
    </button>
  );
};

export default BackLink;
