import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackLinkProps {
  to?: string | number;
  label?: string;
}

const BackLink = ({ to = -1, label = "Voltar" }: BackLinkProps) => {
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
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
};

export default BackLink;
