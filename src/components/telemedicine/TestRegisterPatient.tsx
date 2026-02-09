import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { assemedClient } from "@/integrations/assemed";
import { UserPlus, Loader2, Copy, Check } from "lucide-react";

interface TestRegisterPatientProps {
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  defaultCpf?: string;
  defaultBirthDate?: string;
  defaultGender?: "M" | "F";
}

export function TestRegisterPatient({
  defaultName = "",
  defaultEmail = "",
  defaultPhone = "",
  defaultCpf = "",
  defaultBirthDate = "",
  defaultGender = "M",
}: TestRegisterPatientProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ pacienteId: number; cpf: string } | null>(null);

  // Form state
  const [nome, setNome] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [telefone, setTelefone] = useState(defaultPhone);
  const [cpf, setCpf] = useState(defaultCpf);
  const [dataNascimento, setDataNascimento] = useState(defaultBirthDate);
  const [sexo, setSexo] = useState<"M" | "F">(defaultGender);

  // Gera CPF válido para teste
  const generateTestCpf = () => {
    const randomDigits = () => Math.floor(Math.random() * 9);
    const digits = Array.from({ length: 9 }, randomDigits);

    // Calcula primeiro dígito verificador
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i);
    }
    let d1 = 11 - (sum % 11);
    if (d1 >= 10) d1 = 0;
    digits.push(d1);

    // Calcula segundo dígito verificador
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += digits[i] * (11 - i);
    }
    let d2 = 11 - (sum % 11);
    if (d2 >= 10) d2 = 0;
    digits.push(d2);

    return digits.join("");
  };

  // Formata CPF para exibição
  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  // Gera dados de teste
  const fillTestData = () => {
    const testCpf = generateTestCpf();
    const timestamp = Date.now();
    
    setNome(`Paciente Teste ${timestamp}`);
    setEmail(`teste${timestamp}@teste.com`);
    setTelefone("11999999999");
    setCpf(testCpf);
    setDataNascimento("1990-01-15");
    setSexo("M");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Remove formatação do CPF
      const cpfLimpo = cpf.replace(/\D/g, "");

      // Formata data para ISO 8601 (yyyy-MM-ddTHH:mm:ss)
      // A API Assemed pode esperar formato específico
      const [ano, mes, dia] = dataNascimento.split("-");
      const dataFormatada = `${ano}-${mes}-${dia}T00:00:00`;

      console.log("[TestRegisterPatient] Enviando dados:", {
        nome,
        cpf: cpfLimpo,
        dataNascimento: dataFormatada,
        sexo,
        telefone: telefone.replace(/\D/g, ""),
        email,
      });

      const response = await assemedClient.registerPatient({
        nome,
        cpf: cpfLimpo,
        dataNascimento: dataFormatada,
        sexo,
        telefone: telefone.replace(/\D/g, ""),
        email,
      });

      setResult({
        pacienteId: response.pacienteId,
        cpf: cpfLimpo,
      });

      toast({
        title: "Paciente cadastrado com sucesso!",
        description: `ID: ${response.pacienteId} | CPF: ${formatCpf(cpfLimpo)}`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro inesperado";
      console.error("[TestRegisterPatient] Erro:", error);
      toast({
        title: "Erro ao cadastrar paciente",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCpf = async () => {
    if (result?.cpf) {
      await navigator.clipboard.writeText(result.cpf);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "CPF copiado!",
        description: "Use este CPF para fazer login externo",
      });
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Limpa resultado ao fechar
    setTimeout(() => {
      setResult(null);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Cadastrar Paciente Teste
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cadastrar Usuário Externo (Teste)</DialogTitle>
          <DialogDescription>
            Cadastre um paciente na API Assemed para testar o login externo.
            O CPF gerado poderá ser usado para autenticação.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
              <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                ✅ Paciente cadastrado com sucesso!
              </h4>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">ID do Paciente:</span>{" "}
                  <strong>{result.pacienteId}</strong>
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">CPF:</span>
                  <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono">
                    {formatCpf(result.cpf)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleCopyCpf}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Use o CPF acima para fazer login externo na telemedicina.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Fechar
              </Button>
              <Button onClick={() => setResult(null)}>
                Cadastrar Outro
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={fillTestData}
                >
                  Preencher Dados de Teste
                </Button>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do paciente"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
                  placeholder="00000000000"
                  maxLength={11}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dataNascimento">Data Nascimento *</Label>
                  <Input
                    id="dataNascimento"
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="sexo">Sexo *</Label>
                  <Select value={sexo} onValueChange={(v) => setSexo(v as "M" | "F")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculino</SelectItem>
                      <SelectItem value="F">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ""))}
                  placeholder="11999999999"
                  maxLength={11}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cadastrar Paciente
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TestRegisterPatient;
