import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ProfileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentData: {
    full_name: string;
    email: string;
    phone?: string;
    cpf?: string;
  };
  userId: string;
  onSuccess: () => void;
}

export function ProfileEditDialog({
  open,
  onOpenChange,
  currentData,
  userId,
  onSuccess,
}: ProfileEditDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: currentData.full_name || "",
    email: currentData.email || "",
    phone: currentData.phone || "",
    cpf: currentData.cpf || "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return value;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 11) {
      if (numbers.length <= 10) {
        return numbers.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
      }
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return value;
  };

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    handleInputChange("cpf", formatted);
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    handleInputChange("phone", formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validações básicas
      if (!formData.full_name.trim()) {
        toast({
          title: "Erro",
          description: "O nome completo é obrigatório.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!formData.email.trim() || !formData.email.includes("@")) {
        toast({
          title: "Erro",
          description: "Por favor, insira um email válido.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Atualizar perfil no Supabase
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      // Atualizar metadados do usuário (phone e cpf)
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || null,
          cpf: formData.cpf.trim() || null,
        },
      });

      if (metadataError) throw metadataError;

      // Se o email mudou, atualizar no auth
      if (formData.email !== currentData.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email.trim(),
        });

        if (emailError) throw emailError;

        toast({
          title: "Email atualizado",
          description: "Um email de confirmação foi enviado para o novo endereço.",
        });
      }

      toast({
        title: "Perfil atualizado!",
        description: "Seus dados foram atualizados com sucesso.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar seus dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Atualize suas informações pessoais. Seus dados estão protegidos e seguros.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleInputChange("full_name", e.target.value)}
                placeholder="Seu nome completo"
                disabled={loading}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="seu@email.com"
                disabled={loading}
                required
              />
              <p className="text-xs text-muted-foreground">
                Se você alterar seu email, precisará confirmá-lo.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="(00) 00000-0000"
                disabled={loading}
                maxLength={15}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => handleCPFChange(e.target.value)}
                placeholder="000.000.000-00"
                disabled={loading}
                maxLength={14}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
