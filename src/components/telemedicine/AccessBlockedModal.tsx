import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard } from "lucide-react";

interface AccessBlockedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: "no_subscription" | "expired" | "payment_pending";
}

export function AccessBlockedModal({
  open,
  onOpenChange,
  reason = "no_subscription",
}: AccessBlockedModalProps) {
  const navigate = useNavigate();

  const messages = {
    no_subscription: {
      title: "Assinatura Necessária",
      description:
        "Para acessar a telemedicina, você precisa ter uma assinatura ativa. Escolha um de nossos planos para começar.",
      buttonText: "Ver Planos",
      buttonAction: () => navigate("/planos"),
    },
    expired: {
      title: "Assinatura Expirada",
      description:
        "Sua assinatura expirou. Renove agora para continuar tendo acesso à telemedicina e todos os benefícios do seu plano.",
      buttonText: "Renovar Assinatura",
      buttonAction: () => navigate("/planos"),
    },
    payment_pending: {
      title: "Pagamento Pendente",
      description:
        "Identificamos um pagamento pendente em sua assinatura. Por favor, regularize para continuar acessando a telemedicina.",
      buttonText: "Regularizar Pagamento",
      buttonAction: () => navigate("/dashboard"), // ou página de pagamento
    },
  };

  const { title, description, buttonText, buttonAction } = messages[reason];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button onClick={buttonAction} className="w-full gap-2">
            <CreditCard className="h-4 w-4" />
            {buttonText}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Voltar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
