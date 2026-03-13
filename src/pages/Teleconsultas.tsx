import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Video,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Stethoscope,
  X,
  ExternalLink,
  FileText,
  Star,
  Plus,
  RefreshCw,
  Upload,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAssemedConsultation } from "@/hooks/useAssemedConsultation";
import { useSubscription } from "@/hooks/useSubscription";
import type { Consultation, Specialty, ConsultationStatus, AnamneseResposta } from "@/integrations/assemed/types";
import { normalizeConsultationStatus, normalizeSimplifiedStatus } from "@/integrations/assemed/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
  full_name: string;
  cpf: string;
  email: string;
  phone: string;
  birth_date: string;
  gender: "M" | "F";
}

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<
  ConsultationStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
  }
> = {
  AGUARDANDO: {
    label: "Aguardando",
    variant: "default",
    icon: Clock,
    bgColor: "bg-amber-50 text-amber-700 border-amber-200",
  },
  EM_ATENDIMENTO: {
    label: "Em Atendimento",
    variant: "secondary",
    icon: Video,
    bgColor: "bg-blue-50 text-blue-700 border-blue-200",
  },
  CONCLUIDO: {
    label: "Concluído",
    variant: "outline",
    icon: CheckCircle,
    bgColor: "bg-green-50 text-green-700 border-green-200",
  },
  CANCELADO: {
    label: "Cancelado",
    variant: "destructive",
    icon: XCircle,
    bgColor: "bg-red-50 text-red-700 border-red-200",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateString: string) {
  try {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", {
      locale: ptBR,
    });
  } catch {
    return dateString;
  }
}

function getIsSandbox() {
  return import.meta.env.VITE_ASSEMED_SANDBOX === "true" || import.meta.env.DEV;
}

function buildConsultationUrl(atendimentoId: number, pacienteToken: string) {
  const isSandbox = getIsSandbox();
  const base = isSandbox
    ? "https://dev-app-assemed.azurewebsites.net"
    : "https://app.assemedtelemedicina.com";
  return `${base}/sala-espera-externa/${atendimentoId}?token=${encodeURIComponent(pacienteToken)}`;
}

function calculateDuration(start: string, end: string): string {
  try {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  } catch {
    return "—";
  }
}

// ─── Consultation History Card ────────────────────────────────────────────────

function ConsultationHistoryCard({
  consultation,
  onJoin,
  onCancel,
  onEvaluate,
  hasBeenEvaluated,
  receituarioUrl,
}: {
  consultation: Consultation;
  onJoin: (c: Consultation) => void;
  onCancel: (id: number) => void;
  onEvaluate: (c: Consultation) => void;
  hasBeenEvaluated: boolean;
  receituarioUrl?: string;
}) {
  const normalizedStatus = normalizeConsultationStatus(consultation);
  const status = statusConfig[normalizedStatus];
  const StatusIcon = status.icon;
  const isActive =
    normalizedStatus === "AGUARDANDO" || normalizedStatus === "EM_ATENDIMENTO";

  return (
    <Card className="bg-card border-border/50 hover:shadow-card transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Video className="h-5 w-5 text-primary shrink-0" />
            <CardTitle className="text-base truncate">
              Consulta #{consultation.id}
            </CardTitle>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${status.bgColor}`}
          >
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Especialidade</p>
            <p className="font-medium">{consultation.especialidadeNome || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Profissional</p>
            <p className="font-medium">
              {normalizedStatus === "CANCELADO"
                ? "Consulta cancelada"
                : consultation.profissionalNome || "Aguardando..."}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Data</p>
            <p className="font-medium">{formatDate(consultation.dataCriacao || consultation.dataHoraCriacao)}</p>
          </div>
          {consultation.dataHoraFim && consultation.dataHoraInicio && (
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Duração</p>
              <p className="font-medium">
                {calculateDuration(consultation.dataHoraInicio, consultation.dataHoraFim)}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
          {isActive && (
            <Button size="sm" onClick={() => onJoin(consultation)} className="gap-2">
              {normalizedStatus === "AGUARDANDO" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrar na sala
                </>
              ) : (
                <>
                  <Video className="h-4 w-4" />
                  Entrar na Consulta
                </>
              )}
            </Button>
          )}
          {normalizedStatus === "AGUARDANDO" || normalizedStatus === "EM_ATENDIMENTO" && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={() => onCancel(consultation.id)}
            >
              <XCircle className="h-4 w-4" />
              Cancelar consulta
            </Button>
          )}
          {normalizedStatus === "CONCLUIDO" && receituarioUrl && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => window.open(receituarioUrl, "_blank")}
            >
              <FileText className="h-4 w-4" />
              Ver Receita
            </Button>
          )}
          {normalizedStatus === "CONCLUIDO" && (
            <Button
              size="sm"
              variant={hasBeenEvaluated ? "ghost" : "outline"}
              className="gap-2"
              onClick={() => !hasBeenEvaluated && onEvaluate(consultation)}
              disabled={hasBeenEvaluated}
            >
              <Star className={`h-4 w-4 ${hasBeenEvaluated ? "fill-amber-400 text-amber-400" : ""}`} />
              {hasBeenEvaluated ? "Avaliada" : "Avaliar"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Consulta Wizard Modal ────────────────────────────────────────────────────

const SINTOMAS_OPTIONS = [
  { id: 1, label: "Dor no corpo" },
  { id: 2, label: "Dores articulares" },
  { id: 3, label: "Dor lombar" },
  { id: 4, label: "Náuseas" },
  { id: 5, label: "Dor de garganta" },
];

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type WizardStep = "sintomas" | "sintomaForte" | "exames";

interface WizardData {
  sintomasSelecionados: number[];
  sintomaForteId: number | null;
  medicamentos: string;
  exames: { name: string; base64: string }[];
}

function ConsultaWizardModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (respostasAnamnese: AnamneseResposta[], exames: { arquivoBase64: string }[]) => void;
}) {
  const [step, setStep] = useState<WizardStep>("sintomas");
  const [data, setData] = useState<WizardData>({
    sintomasSelecionados: [],
    sintomaForteId: null,
    medicamentos: "",
    exames: [],
  });
  const [isAddingFile, setIsAddingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stepIndex = step === "sintomas" ? 0 : step === "sintomaForte" ? 1 : 2;
  const steps = [
    { label: "Anamnese 1/2", key: "sintomas" },
    { label: "Anamnese 2/2", key: "sintomaForte" },
    { label: "Anexar Exame", key: "exames" },
  ];

  // Sintomas marcados no passo 1 (para exibir no passo 2)
  const sintomasMarcados = SINTOMAS_OPTIONS.filter((s) =>
    data.sintomasSelecionados.includes(s.id)
  );

  const toggleSintoma = (id: number) => {
    setData((prev) => ({
      ...prev,
      sintomasSelecionados: prev.sintomasSelecionados.includes(id)
        ? prev.sintomasSelecionados.filter((s) => s !== id)
        : [...prev.sintomasSelecionados, id],
      // Limpa o sintoma forte se ele foi desmarcado
      sintomaForteId:
        prev.sintomaForteId === id && prev.sintomasSelecionados.includes(id)
          ? null
          : prev.sintomaForteId,
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setIsAddingFile(true);
    const newExames = await Promise.all(
      files.map(async (f) => ({ name: f.name, base64: await fileToBase64(f) }))
    );
    setData((prev) => ({ ...prev, exames: [...prev.exames, ...newExames] }));
    setIsAddingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeExame = (index: number) => {
    setData((prev) => ({ ...prev, exames: prev.exames.filter((_, i) => i !== index) }));
  };

  const handleSubmit = () => {
    const sintomaForteLabel =
      SINTOMAS_OPTIONS.find((s) => s.id === data.sintomaForteId)?.label || "";

    const sintomaTexto =
      data.sintomaForteId
        ? `Sintomas mais fortes: ${sintomaForteLabel}.`
        : data.sintomasSelecionados.length > 0
        ? `Sintomas: ${sintomasMarcados.map((s) => s.label).join(", ")}.`
        : "Nenhum sintoma selecionado.";

    const respostasAnamnese: AnamneseResposta[] = [
      {
        perguntaQuestionarioAnamneseId: 1,
        opcoesRespondidas: data.sintomasSelecionados.map((id) => ({
          opcoesPerguntaQuestionarioAnamneseId: id,
        })),
        texto: sintomaTexto,
      },
      {
        perguntaQuestionarioAnamneseId: 2,
        opcoesRespondidas: [],
        texto: data.medicamentos.trim() || "Nenhum",
      },
    ];

    onSubmit(respostasAnamnese, data.exames.map((e) => ({ arquivoBase64: e.base64 })));
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    i < stepIndex
                      ? "bg-primary border-primary text-primary-foreground"
                      : i === stepIndex
                      ? "border-primary text-primary bg-primary/10"
                      : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {i < stepIndex ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-[10px] mt-0.5 text-center leading-tight ${i === stepIndex ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 mb-4 transition-colors ${i < stepIndex ? "bg-primary" : "bg-muted-foreground/20"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step: Sintomas */}
        {step === "sintomas" && (
          <>
            <DialogHeader>
              <DialogTitle>Marque os sintomas que você tem sentido</DialogTitle>
            </DialogHeader>
            <div className="divide-y divide-border rounded-lg border overflow-hidden mt-2">
              {SINTOMAS_OPTIONS.map((s) => {
                const checked = data.sintomasSelecionados.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSintoma(s.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${checked ? "bg-primary/5" : ""}`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                      {checked && <CheckCircle className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <span className="text-sm">{s.label}</span>
                  </button>
                );
              })}
            </div>
            <DialogFooter className="mt-4">
              <Button onClick={() => setStep("sintomaForte")} className="gap-2">
                Avançar <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step: Sintoma mais forte + Medicamentos */}
        {step === "sintomaForte" && (
          <>
            <DialogHeader>
              <DialogTitle>Onde você sente a dor mais forte?</DialogTitle>
              {sintomasMarcados.length > 0 ? (
                <DialogDescription>
                  Selecione o sintoma mais intenso entre os que você marcou.
                </DialogDescription>
              ) : (
                <DialogDescription>
                  Você não marcou nenhum sintoma no passo anterior.
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Radio: sintoma mais forte (apenas os marcados no passo 1) */}
              {sintomasMarcados.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border overflow-hidden">
                  {sintomasMarcados.map((s) => {
                    const selected = data.sintomaForteId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          setData((prev) => ({ ...prev, sintomaForteId: s.id }))
                        }
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${selected ? "bg-primary/5" : ""}`}
                      >
                        {/* Radio circle */}
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-primary" : "border-muted-foreground/40"}`}>
                          {selected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="text-sm">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum sintoma foi selecionado anteriormente.
                </p>
              )}

              {/* Medicamentos */}
              <div className="space-y-1.5 pt-1">
                <p className="text-sm font-medium text-foreground">
                  Você toma algum medicamento?{" "}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </p>
                <Textarea
                  placeholder="Ex: Dipirona, Losartana..."
                  value={data.medicamentos}
                  onChange={(e) =>
                    setData((prev) => ({ ...prev, medicamentos: e.target.value }))
                  }
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => setStep("sintomas")}>
                Voltar
              </Button>
              <Button
                onClick={() => setStep("exames")}
                disabled={sintomasMarcados.length > 0 && !data.sintomaForteId}
                className="gap-2"
              >
                Avançar <ChevronRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step: Exames */}
        {step === "exames" && (
          <>
            <DialogHeader>
              <DialogTitle>Gostaria de fornecer algum exame?</DialogTitle>
              <DialogDescription>Anexe imagens ou PDFs (opcional).</DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-3">
              {/* Drop zone */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  {isAddingFile ? "Carregando..." : "Clique aqui ou arraste o arquivo para esta área"}
                </p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />

              {/* File list */}
              {data.exames.length > 0 && (
                <div className="space-y-2">
                  {data.exames.map((exame, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{exame.name}</span>
                      <button
                        type="button"
                        onClick={() => removeExame(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 mt-4">
              <Button variant="outline" onClick={() => setStep("medicamentos")}>
                Voltar
              </Button>
              <Button onClick={handleSubmit} className="gap-2">
                <Stethoscope className="h-4 w-4" />
                Iniciar Consulta
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Evaluation Modal ─────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;
  const labels = ["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"];

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => onChange(star)}
            >
              <Star
                className={`h-7 w-7 transition-colors ${
                  star <= display ? "text-amber-400 fill-amber-400" : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground w-20">
          {display > 0 ? labels[display] : "—"}
        </span>
      </div>
    </div>
  );
}

function EvaluationModal({
  consultation,
  accessToken,
  onClose,
  onSuccess,
}: {
  consultation: Consultation;
  accessToken: string | null;
  onClose: () => void;
  onSuccess: (id: number) => void;
}) {
  const { toast } = useToast();
  const [notaAtendimento, setNotaAtendimento] = useState(0);
  const [notaAplicativo, setNotaAplicativo] = useState(0);
  const [comentario, setComentario] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (notaAtendimento === 0 || notaAplicativo === 0) {
      toast({
        title: "Avaliação incompleta",
        description: "Por favor, avalie o atendimento e o aplicativo.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { assemedClient } = await import("@/integrations/assemed/client");
      if (accessToken) assemedClient.setAccessToken(accessToken);
      await assemedClient.evaluateConsultation(
        consultation.id,
        notaAtendimento,
        notaAplicativo,
        comentario || undefined
      );
      toast({
        title: "Avaliação enviada!",
        description: "Obrigado pelo seu feedback.",
      });
      onSuccess(consultation.id);
    } catch {
      toast({
        title: "Erro ao enviar avaliação",
        description: "Não foi possível enviar sua avaliação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" fill="currentColor" />
            Avaliar consulta #{consultation.id}
          </DialogTitle>
          <DialogDescription>
            {consultation.profissionalNome
              ? `Como foi sua consulta com ${consultation.profissionalNome}?`
              : "Como foi sua consulta?"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <StarRating
            label="Avaliação do atendimento"
            value={notaAtendimento}
            onChange={setNotaAtendimento}
          />
          <StarRating
            label="Avaliação do aplicativo"
            value={notaAplicativo}
            onChange={setNotaAplicativo}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Comentário <span className="text-muted-foreground font-normal">(opcional)</span>
            </label>
            <Textarea
              placeholder="Conte como foi sua experiência..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || notaAtendimento === 0 || notaAplicativo === 0}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar avaliação"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Specialty Selection Card ─────────────────────────────────────────────────

function SpecialtySelectionCard({
  specialty,
  onSelect,
  isLoading,
}: {
  specialty: Specialty;
  onSelect: (s: Specialty) => void;
  isLoading: boolean;
}) {
  const isIncluded = specialty.precoConsulta === 0;

  return (
    <Card
      className={`bg-card border-border/50 transition-all ${
        isLoading
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-card hover:border-primary/20 cursor-pointer group"
      }`}
      onClick={() => !isLoading && onSelect(specialty)}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
            isIncluded
              ? "bg-primary/10 group-hover:bg-primary/20"
              : "bg-accent/10 group-hover:bg-accent/20"
          }`}
        >
          <Stethoscope
            className={`h-6 w-6 ${isIncluded ? "text-primary" : "text-accent"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground">{specialty.nome}</p>
          <p className="text-sm text-muted-foreground">
            {specialty.tipoProfissionalDescricao}
          </p>
          {specialty.triagem && (
            <Badge variant="outline" className="text-xs mt-1">
              Triagem
            </Badge>
          )}
        </div>
        <div className="text-right shrink-0">
          {isIncluded ? (
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary text-xs"
            >
              No plano
            </Badge>
          ) : (
            <div>
              <p className="font-bold text-foreground text-sm">
                R$ {specialty.precoConsulta.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-muted-foreground">por consulta</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Iframe Consultation View ─────────────────────────────────────────────────

function ConsultationIframe({
  atendimentoId,
  pacienteToken,
  especialidade,
  onClose,
}: {
  atendimentoId: number;
  pacienteToken: string;
  especialidade: string;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showIframe, setShowIframe] = useState(false);
  const [localToken, setLocalToken] = useState<string | null>(pacienteToken || null);
  const isSandbox = getIsSandbox();

  // Build url to the iframe wrapper. When we have a token we will load Assemed's sala URL directly.
  const iframeWrapperBase = `https://telemedicina.novitahomecare.com.br/?sala=${atendimentoId}&sandbox=${isSandbox}&especialidade=${encodeURIComponent(
    especialidade
  )}`;
  const iframeWrapperUrl = localToken ? `${iframeWrapperBase}&token=${encodeURIComponent(localToken)}` : iframeWrapperBase;
  const assemedSalaUrl = localToken ? buildConsultationUrl(atendimentoId, localToken) : null;

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "IFRAME_READY") {
        setIsLoading(false);
      }
      if (event.data?.type === "CONSULTATION_CLOSED") {
        onClose();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onClose]);

  // If parent gave a pacienteToken, open iframe immediately
  useEffect(() => {
    if (pacienteToken) {
      setLocalToken(pacienteToken);
      setShowIframe(true);
      setIsLoading(true);
    }
  }, [pacienteToken]);

  // When iframe is shown and we have a token, notify the iframe to start the consultation
  useEffect(() => {
    if (!showIframe) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const payload = {
      type: "START_CONSULTATION",
      atendimentoId,
      token: localToken,
      especialidade,
    };
    try {
      win.postMessage(payload, "*");
    } catch (e) {
      // ignore
    }
  }, [showIframe, localToken, atendimentoId, especialidade]);

  const handleEnterClick = async () => {
    setIsLoading(true);
    // Fetch fresh consultation token only when user explicitly clicks
    if (!localToken) {
      try {
        const { assemedClient } = await import("@/integrations/assemed/client");
        const fresh = await assemedClient.getConsultation(atendimentoId);
        if (fresh?.pacienteToken) setLocalToken(fresh.pacienteToken);
      } catch (err) {
        toast({
          title: "Erro ao preparar consulta",
          description: "Não foi possível obter detalhes da consulta. Tente novamente.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
    }
    setShowIframe(true);
    setIsLoading(false);
  };

  if (isLoading && !showIframe) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground text-lg">Carregando teleconsultas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* ...o restante do JSX do ConsultationIframe aqui... */}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const Teleconsultas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [hasLoadedConsultations, setHasLoadedConsultations] = useState(false);
  const [joiningConsultation, setJoiningConsultation] =
    useState<Consultation | null>(null);
  const [showSpecialtyModal, setShowSpecialtyModal] = useState(false);
  const [showStandaloneModal, setShowStandaloneModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [evaluatingConsultation, setEvaluatingConsultation] = useState<Consultation | null>(null);
  const [evaluatedIds, setEvaluatedIds] = useState<Set<number>>(new Set());
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);
  const [isCancellingConsultation, setIsCancellingConsultation] = useState(false);

  // Mapa de consultationId → URL do receituário (PDF)
  const [receituarioMap, setReceituarioMap] = useState<Record<number, string>>({});

  // Dados coletados no wizard (anamnese + exames) para usar na criação do atendimento
  const pendingAnamneseRef = useRef<{
    respostasAnamnese: AnamneseResposta[];
    exames: { arquivoBase64: string }[];
  } | null>(null);
  const [selectedSpecialtyName, setSelectedSpecialtyName] = useState<string>("Consulta Imediata");
  const [pendingCreditId, setPendingCreditId] = useState<string | null>(null);
  const [activeConsultationCreditId, setActiveConsultationCreditId] = useState<string | null>(null); // Crédito usado na consulta ativa atual
  const [creditsInUse, setCreditsInUse] = useState(0); // Créditos em uso por consultas ativas
  const [availableCredits, setAvailableCredits] = useState<{
    id: string;
    type: string;
    amount: number;
    expires_at: string;
  }[]>([]);

  const { isActive: hasActivePlan } = useSubscription();

  // IDs de créditos em uso (carregados do banco)
  const [usedCreditIds, setUsedCreditIds] = useState<string[]>([]);

  // Carrega créditos disponíveis (apenas clínico geral)
  const loadAvailableCredits = useCallback(async () => {
    if (!user) return;
    
    // Usa any porque a tabela consultation_credits ainda não está nos tipos gerados
    const { data, error } = await (supabase as any)
      .from("consultation_credits")
      .select("id, type, amount, expires_at")
      .eq("user_id", user.id)
      .eq("status", "available")
      .eq("type", "clinico_geral") // Apenas créditos de clínico geral
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (!error && data) {
      setAvailableCredits(data);
    }
  }, [user]);

  // Carrega créditos quando o usuário é definido
  useEffect(() => {
    loadAvailableCredits();
  }, [loadAvailableCredits]);

  // Recarrega créditos quando abre o modal (para garantir dados atualizados)
  useEffect(() => {
    if (showStandaloneModal) {
      loadAvailableCredits();
    }
  }, [showStandaloneModal, loadAvailableCredits]);

  const {
    step,
    accessToken,
    specialties: rawSpecialties,
    activeConsultation,
    consultations,
    isLoadingConsultations,
    error,
    silentAuthenticate,
    startConsultationFlow,
    createConsultation,
    loadConsultations,
    cancelConsultation,
    closeConsultation,
    resetFlow,
    backToSpecialtySelection,
  } = useAssemedConsultation();

  // Carrega créditos em uso (para consultas ativas) e sincroniza activeConsultationCreditId
  const loadCreditsInUse = useCallback(async () => {
    if (!user) {
      setCreditsInUse(0);
      setUsedCreditIds([]);
      if (!pendingCreditId) {
        setActiveConsultationCreditId(null);
      }
      return;
    }
    
    // Obtém IDs das consultas ativas (AGUARDANDO ou EM_ATENDIMENTO)
    const activeConsultationIds = consultations
      .filter(c => {
        const status = normalizeConsultationStatus(c);
        return status === "AGUARDANDO" || status === "EM_ATENDIMENTO";
      })
      .map(c => String(c.id));
    
    // Busca TODOS os créditos "used" do usuário
    const { data: allUsedCredits, error: fetchError } = await (supabase as any)
      .from("consultation_credits")
      .select("id, consultation_id, used_at")
      .eq("user_id", user.id)
      .eq("status", "used")
      .eq("type", "clinico_geral");
    
    if (fetchError) {
      logger.error("Erro ao buscar créditos usados:", fetchError);
      return;
    }
    
    // CORREÇÃO: Busca créditos que foram restaurados indevidamente
    // (status = 'available' mas com consultation_id de uma consulta ativa)
    if (activeConsultationIds.length > 0) {
      const { data: wronglyAvailableCredits } = await (supabase as any)
        .from("consultation_credits")
        .select("id, consultation_id")
        .eq("user_id", user.id)
        .eq("status", "available")
        .eq("type", "clinico_geral")
        .not("consultation_id", "is", null);
      
      if (wronglyAvailableCredits && wronglyAvailableCredits.length > 0) {
        for (const credit of wronglyAvailableCredits) {
          if (activeConsultationIds.includes(String(credit.consultation_id))) {
            // Re-marca como "used" pois a consulta ainda está ativa
            logger.info(`Crédito ${credit.id} remarcado como "used" - consulta ${credit.consultation_id} ainda ativa`);
            await (supabase as any)
              .from("consultation_credits")
              .update({ status: "used", used_at: new Date().toISOString() })
              .eq("id", credit.id);
          }
        }
      }
    }
    
    // Filtra créditos que estão ativamente em uso:
    // 1. Créditos com consultation_id de uma consulta ativa
    // 2. Créditos recém-marcados como "used" (últimos 5 minutos) sem consultation_id
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const activeCredits = (allUsedCredits || []).filter((credit: { id: string; consultation_id: string | number | null; used_at: string | null }) => {
      // Se o crédito está associado a uma consulta ativa, está em uso
      // Converte para string para comparação correta
      if (credit.consultation_id && activeConsultationIds.includes(String(credit.consultation_id))) {
        return true;
      }
      // Se o crédito foi marcado como "used" recentemente e não tem consultation_id, também está em uso
      // (pode estar no processo de ser associado a uma nova consulta)
      if (!credit.consultation_id && credit.used_at) {
        const usedAt = new Date(credit.used_at);
        return usedAt > fiveMinutesAgo;
      }
      return false;
    });
    
    const ids = activeCredits.map((d: { id: string }) => d.id);
    setCreditsInUse(activeCredits.length);
    setUsedCreditIds(ids);
    
    // Se encontrou crédito em uso e não temos activeConsultationCreditId setado, seta agora
    if (ids.length > 0 && !activeConsultationCreditId && !pendingCreditId) {
      setActiveConsultationCreditId(ids[0]);
    } else if (ids.length === 0 && !pendingCreditId) {
      setActiveConsultationCreditId(null);
    }
    
    // Recarrega créditos disponíveis após correções
    if (activeConsultationIds.length > 0) {
      loadAvailableCredits();
    }
  }, [user, consultations, pendingCreditId, activeConsultationCreditId, loadAvailableCredits]);

  // Atualiza créditos em uso quando consultas mudam
  useEffect(() => {
    loadCreditsInUse();
  }, [loadCreditsInUse]);

  // Calcula créditos efetivamente disponíveis (exclui pendentes e em uso na consulta ativa)
  const effectiveAvailableCredits = useMemo(() => {
    // Filtra o crédito pendente E o crédito da consulta ativa E créditos já em uso (do banco)
    const filtered = availableCredits.filter(c => 
      c.id !== pendingCreditId && 
      c.id !== activeConsultationCreditId &&
      !usedCreditIds.includes(c.id)
    );
    return filtered;
  }, [availableCredits, pendingCreditId, activeConsultationCreditId, usedCreditIds]);

  // Restaura créditos órfãos (marcados como "used" mas sem consulta ativa)
  const restoreOrphanCredits = useCallback(async () => {
    if (!user) return;
    
    // Busca créditos que estão como "used" para este usuário
    const { data: usedCredits, error: fetchError } = await (supabase as any)
      .from("consultation_credits")
      .select("id, consultation_id, used_at")
      .eq("user_id", user.id)
      .eq("status", "used")
      .eq("type", "clinico_geral");
    
    if (fetchError || !usedCredits || usedCredits.length === 0) return;
    
    // Para cada crédito usado, verifica se a consulta ainda está ativa
    for (const credit of usedCredits) {
      // Nunca restaura créditos que estamos ativamente usando nesta sessão
      if (credit.id === pendingCreditId || credit.id === activeConsultationCreditId) {
        logger.info(`Crédito ${credit.id} está em uso na sessão atual, não restaurar`);
        continue;
      }
      
      if (!credit.consultation_id) {
        // Crédito sem consultation_id - pode ser que ainda esteja sendo associado
        // Só restaura se foi marcado como "used" há mais de 5 minutos
        const usedAt = credit.used_at ? new Date(credit.used_at) : null;
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        
        if (!usedAt || usedAt > fiveMinutesAgo) {
          // Crédito foi marcado como usado recentemente, pode estar sendo associado ainda
          logger.info(`Crédito ${credit.id} sem consultation_id mas recente, aguardando...`);
          continue;
        }
        
        // Crédito sem consultation_id há mais de 5 minutos - restaura
        await (supabase as any)
          .from("consultation_credits")
          .update({ status: "available", used_at: null })
          .eq("id", credit.id);
        logger.info(`Crédito órfão ${credit.id} restaurado (sem consultation_id por mais de 5 min)`);
        continue;
      }
      
      // Verifica se a consulta ainda está ativa localmente
      // Converte para string para garantir comparação correta (c.id é number, credit.consultation_id pode ser string)
      const consultationIdStr = String(credit.consultation_id);
      const isActiveLocally = consultations.some(
        c => String(c.id) === consultationIdStr && 
        (normalizeConsultationStatus(c) === "AGUARDANDO" || normalizeConsultationStatus(c) === "EM_ATENDIMENTO")
      );
      
      if (!isActiveLocally) {
        // Só restaura se realmente não há consultas ativas com este ID
        // Também verifica se as consultas já foram carregadas
        if (consultations.length === 0) {
          logger.info(`Crédito ${credit.id} não restaurado - consultas ainda não carregadas`);
          continue;
        }
        
        // NÃO restaura créditos usados recentemente (últimos 30 minutos)
        // A consulta pode ter acabado de ser criada e ainda não estar na lista local
        const usedAt = credit.used_at ? new Date(credit.used_at) : null;
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        if (usedAt && usedAt > thirtyMinutesAgo) {
          logger.info(`Crédito ${credit.id} não restaurado - usado recentemente (${usedAt.toISOString()})`);
          continue;
        }
        
        await (supabase as any)
          .from("consultation_credits")
          .update({ status: "available", consultation_id: null, used_at: null })
          .eq("id", credit.id);
        logger.info(`Crédito órfão ${credit.id} restaurado (consulta ${credit.consultation_id} não está ativa)`);
      }
    }
    
    // Recarrega créditos após restaurar
    loadAvailableCredits();
  }, [user, consultations, loadAvailableCredits, pendingCreditId, activeConsultationCreditId]);

  // Restaura créditos órfãos quando as consultas são carregadas
  const hasRestoredOrphans = useRef(false);
  useEffect(() => {
    if (!isLoadingConsultations && user && !hasRestoredOrphans.current) {
      hasRestoredOrphans.current = true;
      restoreOrphanCredits();
    }
  }, [isLoadingConsultations, user, restoreOrphanCredits]);

  // Se o usuário tem plano ativo, clínico geral é incluído (preço = 0)
  const specialties = hasActivePlan
    ? rawSpecialties.map((s) => {
        const nomeLower = s.nome.toLowerCase();
        const isClinicoGeral =
          (nomeLower.includes("cl") && nomeLower.includes("geral")) ||
          nomeLower.includes("clínico") ||
          nomeLower.includes("clinico");
        return isClinicoGeral ? { ...s, precoConsulta: 0 } : s;
      })
    : rawSpecialties;

  // ── Auth ──────────────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();

      const { data: userData } = await supabase.auth.getUser();
      const metadata = userData.user?.user_metadata;
      const identity = userData.user?.identities?.[0];
      const identityCpf = identity?.identity_data?.cpf as string | undefined;
      const cpf = (metadata?.cpf as string | undefined) || identityCpf || "";

      setProfile({
        full_name: data?.full_name || (metadata?.full_name as string) || "",
        email: data?.email || userData.user?.email || "",
        cpf,
        phone: (metadata?.phone as string) || "",
        birth_date: (metadata?.birth_date as string) || "",
        gender: (metadata?.gender as "M" | "F") || "M",
      });
    } catch (err) {
      logger.error("Erro ao buscar perfil:", err);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        } else if (session.user) {
          fetchProfile(session.user.id);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else if (session.user) {
        fetchProfile(session.user.id);
      }
      setPageLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate, fetchProfile]);

  // Auto-authenticate when profile is ready to load existing consultations
  useEffect(() => {
    if (!profile || hasLoadedConsultations || pageLoading) return;

    const cpf = profile.cpf.replace(/\D/g, "");
    if (cpf.length !== 11 || !profile.email) return;

    setHasLoadedConsultations(true);

    silentAuthenticate(cpf, profile).then((token) => {
      if (token) {
        loadConsultations();
      }
    });
  }, [profile, hasLoadedConsultations, pageLoading, silentAuthenticate, loadConsultations]);

  // Also load consultations when access token becomes available (e.g. after startConsultationFlow)
  const hasLoadedOnTokenRef = useRef(false);
  useEffect(() => {
    if (accessToken && hasLoadedConsultations && !hasLoadedOnTokenRef.current) {
      hasLoadedOnTokenRef.current = true;
      loadConsultations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ── Buscar receituários para consultas concluídas ──
  useEffect(() => {
    if (!accessToken || consultations.length === 0) return;

    let cancelled = false;

    const fetchReceituarios = async () => {
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setAccessToken(accessToken);

      const concluidas = consultations.filter(
        c => normalizeConsultationStatus(c) === "CONCLUIDO"
      );

      if (concluidas.length === 0) return;

      const results = await Promise.allSettled(
        concluidas.map(async (c) => {
          const items = await assemedClient.getReceituarios(c.id);
          return { id: c.id, items };
        })
      );

      if (cancelled) return;

      const map: Record<number, string> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          const { id, items } = result.value;
          const firstPdf = items.find(i => i.urlPdf);
          if (firstPdf) {
            map[id] = firstPdf.urlPdf;
          }
        }
      }
      setReceituarioMap(map);
    };

    fetchReceituarios();

    return () => { cancelled = true; };
  }, [accessToken, consultations]);

  // ── Polling para atualizar status de consultas ativas usando endpoint simplificado ──
  // Usa refs para evitar re-execução do effect quando consultations muda
  const consultationsRef = useRef(consultations);
  // Rastreia consultas para as quais já navegamos (evita navegar mais de uma vez)
  const navigatedToConsultationRef = useRef<Set<number>>(new Set());
  // Ref para sempre ter o accessToken mais recente dentro do polling (evita closure stale)
  const accessTokenRef = useRef<string | null>(accessToken);

  // Mantém refs atualizados
  useEffect(() => {
    consultationsRef.current = consultations;
  }, [consultations]);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    // Aguarda ter consultations carregadas
    const getActiveConsultationIds = () => {
      return consultationsRef.current
        .filter((c) => {
          const status = normalizeConsultationStatus(c);
          return status === "AGUARDANDO" || status === "EM_ATENDIMENTO";
        })
        .map((c) => c.id);
    };

    const pollActiveConsultations = async () => {
      const activeIds = getActiveConsultationIds();
      if (activeIds.length === 0) return;

      // Tenta re-autenticar se o token expirou
      const currentToken = accessTokenRef.current;
      if (!currentToken) return;

      try {
        const { assemedClient } = await import("@/integrations/assemed/client");
        assemedClient.setAccessToken(currentToken);

        // Verifica se o token ainda é válido tentando uma chamada simples
        // Se der 401, re-autentica antes de continuar
        const decoded = assemedClient.decodeToken(currentToken);
        if (decoded && decoded.exp * 1000 < Date.now() + 30000) {
          // Token expira em menos de 30s, re-autentica
          if (profile) {
            const cpf = profile.cpf.replace(/\D/g, "");
            if (cpf.length === 11) {
              const newToken = await silentAuthenticate(cpf, profile);
              if (newToken) assemedClient.setAccessToken(newToken);
            }
          }
        }
        
        for (const consultationId of activeIds) {
          try {
            const response = await assemedClient.getConsultationStatus(consultationId);
            // Normaliza o status (API pode retornar em diferentes formatos)
            const normalizedStatus = normalizeSimplifiedStatus(response);
            console.log(`[Teleconsultas] Status consulta ${consultationId}:`, response.situacao, '-> normalizado:', normalizedStatus);
            
            // Encontra a consulta atual no ref
            const currentConsultation = consultationsRef.current.find(c => c.id === consultationId);
            if (!currentConsultation) continue;
            
            const currentStatus = normalizeConsultationStatus(currentConsultation);
            
            // Navega para sala de espera quando EM_ATENDIMENTO (independente de mudança de status)
            if (normalizedStatus === "EM_ATENDIMENTO" && !navigatedToConsultationRef.current.has(consultationId)) {
              navigatedToConsultationRef.current.add(consultationId);
              toast({
                title: "Médico Disponível",
                description: `${response.profissionalNome || "O médico"} está pronto para atendê-lo. Entrando na consulta...`,
              });
              // Busca dados completos (incluindo pacienteToken) antes de navegar
              try {
                const fullConsultation = await assemedClient.getConsultation(consultationId);
                const token = fullConsultation?.pacienteToken;
                const especialidade = encodeURIComponent(currentConsultation.especialidadeNome || "Consulta");
                if (token) {
                  navigate(`/sala-espera/${consultationId}?especialidade=${especialidade}&token=${encodeURIComponent(token)}`);
                } else {
                  navigate(`/sala-espera/${consultationId}?especialidade=${especialidade}`);
                }
              } catch {
                navigate(`/sala-espera/${consultationId}?especialidade=${encodeURIComponent(currentConsultation.especialidadeNome || "Consulta")}`);
              }
            }

            // Verifica se houve mudança
            if (normalizedStatus !== currentStatus ||
                response.profissionalNome !== currentConsultation.profissionalNome) {

              // Atualiza a consulta localmente sem chamar /obter novamente
              const updatedConsultations = consultationsRef.current.map(c =>
                c.id === consultationId
                  ? { ...c, status: normalizedStatus, situacao: normalizedStatus, profissionalNome: response.profissionalNome }
                  : c
              );
              consultationsRef.current = updatedConsultations;

              // Força re-render via hook - precisa chamar loadConsultations apenas uma vez
              // Notifica o usuário
              if (normalizedStatus === "CONCLUIDO") {
                // Limpa o crédito da consulta ativa (foi consumido)
                setActiveConsultationCreditId(null);
                toast({
                  title: "Consulta Finalizada",
                  description: "Sua teleconsulta foi concluída com sucesso.",
                });
                // Abre modal de avaliação automaticamente (se ainda não avaliada)
                setEvaluatedIds(prev => {
                  if (!prev.has(consultationId)) {
                    setEvaluatingConsultation({ ...currentConsultation, status: "CONCLUIDO" });
                  }
                  return prev;
                });
                // Recarrega apenas quando consulta finaliza para atualizar histórico
                loadConsultations();
              } else if (normalizedStatus === "CANCELADO") {
                // Tenta restaurar crédito avulso (se existir)
                try {
                  const { data: restoredCredits, error } = await (supabase as any)
                    .from("consultation_credits")
                    .update({
                      status: "available",
                      consultation_id: null,
                      used_at: null,
                    })
                    .eq("consultation_id", consultationId)
                    .eq("status", "used")
                    .select();
                  
                  const hadCredit = restoredCredits && restoredCredits.length > 0;
                  
                  if (hadCredit) {
                    logger.info(`Crédito restaurado para consulta cancelada ${consultationId}`);
                    setActiveConsultationCreditId(null); // Limpa o crédito da consulta ativa
                    loadAvailableCredits();
                    toast({
                      title: "Consulta Cancelada",
                      description: response.motivoCancelamento === 4
                        ? "Sua consulta expirou por tempo de espera. Seu crédito foi restaurado."
                        : "A consulta foi cancelada. Seu crédito foi restaurado.",
                    });
                  } else {
                    // Consulta do plano (sem crédito avulso) - também limpa o estado
                    setActiveConsultationCreditId(null);
                    toast({
                      title: "Consulta Cancelada",
                      description: response.motivoCancelamento === 4
                        ? "Sua consulta expirou por tempo de espera."
                        : "A consulta foi cancelada.",
                    });
                  }
                  
                  if (error) {
                    logger.error("Erro ao verificar crédito:", error);
                  }
                } catch (restoreError) {
                  logger.error("Erro ao restaurar crédito:", restoreError);
                  toast({
                    title: "Consulta Cancelada",
                    description: "A consulta foi cancelada.",
                  });
                }
                loadConsultations();
              }
            }
          } catch (err: unknown) {
            // Se 401, tenta re-autenticar e aguarda próximo ciclo
            const is401 = err instanceof Error && (
              (err as { statusCode?: number }).statusCode === 401 ||
              err.message.includes("401") ||
              err.message.toLowerCase().includes("unauthorized")
            );
            if (is401 && profile) {
              console.warn(`[Teleconsultas] 401 na consulta ${consultationId}, re-autenticando...`);
              const cpf = profile.cpf.replace(/\D/g, "");
              if (cpf.length === 11) {
                const newToken = await silentAuthenticate(cpf, profile);
                if (newToken) {
                  const { assemedClient: client } = await import("@/integrations/assemed/client");
                  client.setAccessToken(newToken);
                }
              }
            } else {
              console.error(`[Teleconsultas] Erro ao verificar status da consulta ${consultationId}:`, err);
            }
          }
        }
      } catch (err) {
        console.error("[Teleconsultas] Erro no polling de consultas:", err);
      }
    };

    // Inicia polling após 5 segundos (dá tempo para carregar consultas)
    const initialDelay = setTimeout(() => {
      pollActiveConsultations();
    }, 5000);

    // Depois executa a cada 10 segundos
    const interval = setInterval(pollActiveConsultations, 10000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [accessToken, toast, loadConsultations, loadAvailableCredits, navigate, profile, silentAuthenticate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // ── Auto-select clínico geral when specialties are loaded ──────────────────
  // Used for direct consultation flow (without modal)
  const [isAutoSelecting, setIsAutoSelecting] = useState(false);

  useEffect(() => {
    // When specialties are loaded and we started a new consultation flow, auto-select clínico geral
    if (step === "selecting_specialty" && specialties.length > 0 && isAutoSelecting) {
      // Find "Clínico Geral" (case insensitive)
      const clinicoGeral = specialties.find((s) => {
        const nome = s.nome.toLowerCase();
        return nome.includes("cl") && nome.includes("geral");
      });

      const pending = pendingAnamneseRef.current;
      if (clinicoGeral) {
        setSelectedSpecialtyName(clinicoGeral.nome);
        createConsultation(clinicoGeral, pending?.respostasAnamnese, pending?.exames);
      } else if (specialties.length > 0) {
        // Fallback: use first available specialty
        setSelectedSpecialtyName(specialties[0].nome);
        createConsultation(specialties[0], pending?.respostasAnamnese, pending?.exames);
      }
      
      setIsAutoSelecting(false);
    }
  }, [step, specialties, isAutoSelecting, createConsultation]);

  // Ref para lembrar qual crédito usar quando o wizard completar
  const pendingCreditForWizardRef = useRef<string | null>(null);

  // ── Start new consultation flow ───────────────────────────────────────────

  const handleStartNewConsultation = () => {
    if (!profile) {
      toast({
        title: "Perfil não carregado",
        description: "Aguarde o carregamento do perfil.",
        variant: "destructive",
      });
      return;
    }

    const cpf = profile.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) {
      toast({
        title: "CPF necessário",
        description:
          "É necessário ter um CPF válido cadastrado no perfil para acessar a telemedicina.",
        variant: "destructive",
      });
      navigate("/perfil");
      return;
    }

    if (!profile.full_name || !profile.email) {
      toast({
        title: "Dados incompletos",
        description: "Complete seu perfil antes de iniciar uma consulta.",
        variant: "destructive",
      });
      navigate("/perfil");
      return;
    }

    // Verifica se já existe consulta em andamento
    const activeConsultations = consultations.filter(
      (c) =>
        normalizeConsultationStatus(c) === "AGUARDANDO" ||
        normalizeConsultationStatus(c) === "EM_ATENDIMENTO"
    );

    if (activeConsultations.length > 0) {
      toast({
        title: "Consulta em andamento",
        description:
          "Você já possui uma consulta em andamento. Aguarde o atendimento ser concluído ou cancele-o antes de iniciar uma nova consulta.",
        variant: "destructive",
      });
      return;
    }

    // Se não tem plano ativo
    if (!hasActivePlan) {
      if (effectiveAvailableCredits.length > 0) {
        // Tem crédito: salva o ID e abre o wizard
        pendingCreditForWizardRef.current = effectiveAvailableCredits[0].id;
        setShowWizardModal(true);
        return;
      }
      // Sem créditos: mostra modal para comprar
      setShowStandaloneModal(true);
      return;
    }

    // Tem plano: abre o wizard diretamente
    pendingCreditForWizardRef.current = null;
    setShowWizardModal(true);
  };

  // Chamado quando o wizard é concluído — inicia o fluxo real com os dados coletados
  const handleWizardSubmit = async (
    respostasAnamnese: AnamneseResposta[],
    exames: { arquivoBase64: string }[]
  ) => {
    if (!profile) return;

    // Armazena dados da anamnese para uso em createConsultation
    pendingAnamneseRef.current = { respostasAnamnese, exames };
    setShowWizardModal(false);

    const cpf = profile.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) return;

    const creditId = pendingCreditForWizardRef.current;
    pendingCreditForWizardRef.current = null;

    if (creditId) {
      // Usa crédito avulso
      setPendingCreditId(creditId);
      setActiveConsultationCreditId(creditId);
      await (supabase as any)
        .from("consultation_credits")
        .update({ status: "used", used_at: new Date().toISOString() })
        .eq("id", creditId);
      setAvailableCredits((prev) => prev.filter((c) => c.id !== creditId));
    }

    setIsAutoSelecting(true);
    await startConsultationFlow(cpf, profile);
  };

  // Usa um crédito existente para iniciar consulta — abre o wizard
  const handleUseExistingCredit = (creditId: string) => {
    setShowStandaloneModal(false);
    pendingCreditForWizardRef.current = creditId;
    setShowWizardModal(true);
  };

  // Inicia consulta após pagamento de consulta avulsa — abre o wizard
  const handleStartAfterPayment = (creditId?: string) => {
    if (!profile) return;
    pendingCreditForWizardRef.current = creditId || null;
    setShowWizardModal(true);
  };

  // Associa o consultation_id ao crédito e navega para sala de espera
  // Unificado para evitar race condition entre associação e redirecionamento
  useEffect(() => {
    const handleConsultationCreated = async () => {
      if (!activeConsultation || !activeConsultation.id) return;
      
      // Se tem crédito pendente, associa PRIMEIRO antes de navegar
      if (pendingCreditId) {
        const { error } = await (supabase as any)
          .from("consultation_credits")
          .update({
            consultation_id: activeConsultation.id,
          })
          .eq("id", pendingCreditId);

        if (error) {
          logger.error("Error associating credit to consultation:", error);
        } else {
          logger.info(`Crédito ${pendingCreditId} associado à consulta ${activeConsultation.id}`);
        }
        setPendingCreditId(null);
      }
      
      // Agora que o crédito foi associado, navega para sala de espera
      navigate(
        `/sala-espera/${activeConsultation.id}?especialidade=${encodeURIComponent(
          selectedSpecialtyName
        )}`
      );
    };
    handleConsultationCreated();
  }, [activeConsultation, pendingCreditId, navigate, selectedSpecialtyName]);

  // Verifica se veio do checkout de consulta avulsa
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const consultationCredit = params.get("consultation_credit");
    
    if (consultationCredit && profile && !pageLoading) {
      // Remove o parâmetro da URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
      
      // Verifica se é um UUID válido (crédito do banco)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(consultationCredit);
      
      // Inicia a consulta automaticamente
      toast({
        title: "Pagamento confirmado!",
        description: "Iniciando sua consulta...",
      });
      
      setTimeout(() => {
        handleStartAfterPayment(isUUID ? consultationCredit : undefined);
      }, 1000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, pageLoading]);

  const handleSelectSpecialty = async (specialty: Specialty) => {
    setSelectedSpecialtyName(specialty.nome);
    setShowSpecialtyModal(false);
    const success = await createConsultation(specialty);
    
    // Se falhou, limpa o crédito pendente (será restaurado automaticamente)
    if (!success && pendingCreditId) {
      logger.info(`Limpando crédito pendente ${pendingCreditId} por falha na criação`);
      setPendingCreditId(null);
    }
  };

  const handleCloseSpecialtyModal = () => {
    setShowSpecialtyModal(false);
    resetFlow();
  };

  // ── Join existing consultation ────────────────────────────────────────────

  const handleJoinConsultation = async (consultation: Consultation) => {
    // Navigate to in-app waiting room; actual token fetch and iframe load happen there
    navigate(`/sala-espera/${consultation.id}?especialidade=${encodeURIComponent(
      consultation.especialidadeNome || "Consulta"
    )}`);
  };

  // ── Cancel consultation ───────────────────────────────────────────────────

  const handleRequestCancel = (id: number) => {
    setCancelConfirmId(id);
  };

  const handleConfirmCancel = async () => {
    if (!cancelConfirmId) return;
    const id = cancelConfirmId;
    setIsCancellingConsultation(true);
    try {
      await cancelConsultation(id);

      // Tenta restaurar o crédito avulso se existir
      let hadCredit = false;
      try {
        const { data: creditByConsultation } = await (supabase as any)
          .from("consultation_credits")
          .update({
            status: "available",
            consultation_id: null,
            used_at: null,
          })
          .eq("consultation_id", id)
          .eq("status", "used")
          .select();

        if (creditByConsultation && creditByConsultation.length > 0) {
          logger.info(`Crédito restaurado para consulta cancelada pelo usuário ${id}`);
          setActiveConsultationCreditId(null);
          loadAvailableCredits();
          hadCredit = true;
        } else if (pendingCreditId || activeConsultationCreditId) {
          const creditIdToRestore = pendingCreditId || activeConsultationCreditId;
          const { error: error2 } = await (supabase as any)
            .from("consultation_credits")
            .update({
              status: "available",
              consultation_id: null,
              used_at: null,
            })
            .eq("id", creditIdToRestore);

          if (!error2) {
            logger.info(`Crédito ${creditIdToRestore} restaurado`);
            setPendingCreditId(null);
            setActiveConsultationCreditId(null);
            loadAvailableCredits();
            hadCredit = true;
          }
        }
      } catch (err) {
        logger.error("Erro ao restaurar crédito:", err);
      }

      toast({
        title: "Consulta cancelada",
        description: hadCredit
          ? "Sua consulta foi cancelada e seu crédito foi restaurado."
          : "Sua consulta foi cancelada.",
      });
    } catch {
      toast({
        title: "Erro ao cancelar",
        description: "Não foi possível cancelar a consulta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsCancellingConsultation(false);
      setCancelConfirmId(null);
    }
  };

  // ── Close iframe ──────────────────────────────────────────────────────────

  const handleCloseIframe = useCallback(() => {
    setJoiningConsultation(null);
    closeConsultation();
    // Reload consultations to reflect updated status
    if (accessToken) {
      loadConsultations();
    }
  }, [closeConsultation, loadConsultations, accessToken]);

  // ── Render: full-screen iframe for joining existing consultation ───────────

  if (joiningConsultation && joiningConsultation.pacienteToken) {
    return (
      <ConsultationIframe
        atendimentoId={joiningConsultation.id}
        pacienteToken={joiningConsultation.pacienteToken}
        especialidade={joiningConsultation.especialidadeNome || "Consulta"}
        onClose={() => setJoiningConsultation(null)}
      />
    );
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render: specialty selection modal ─────────────────────────────────────

  const isFlowLoading =
    step === "registering" ||
    step === "authenticating" ||
    step === "loading_specialties" ||
    step === "creating_consultation";

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Page title */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Voltar ao Dashboard
          </button>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">
                Consulta Imediata
              </h1>
              <p className="text-muted-foreground mt-1">
                Atendimento com clínico geral 24h, sem agendamento
              </p>
            </div>
            <Button
              onClick={handleStartNewConsultation}
              disabled={step === "creating_consultation"}
              className="gap-2 shrink-0"
              size="lg"
            >
              {step === "creating_consultation" ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Criando consulta...
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Nova Consulta
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Info card: créditos de consulta avulsa disponíveis (apenas para usuários sem plano) */}
        {!hasActivePlan && (effectiveAvailableCredits.length > 0 || creditsInUse > 0) && (
          <Card className={`mb-6 ${effectiveAvailableCredits.length > 0 ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${effectiveAvailableCredits.length > 0 ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    {effectiveAvailableCredits.length > 0 ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className={`font-medium ${effectiveAvailableCredits.length > 0 ? 'text-green-800' : 'text-yellow-800'}`}>
                      {effectiveAvailableCredits.length > 0 ? 'Consultas Avulsas Disponíveis' : 'Consulta em Andamento'}
                    </p>
                    <p className={`text-sm ${effectiveAvailableCredits.length > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {effectiveAvailableCredits.length > 0 ? (
                        <>
                          Você tem <span className="font-semibold">{effectiveAvailableCredits.length}</span> consulta{effectiveAvailableCredits.length !== 1 ? 's' : ''} avulsa{effectiveAvailableCredits.length !== 1 ? 's' : ''} de clínico geral paga{effectiveAvailableCredits.length !== 1 ? 's' : ''} para usar
                        </>
                      ) : (
                        <>Você tem {creditsInUse} consulta{creditsInUse !== 1 ? 's' : ''} em andamento usando crédito avulso</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${effectiveAvailableCredits.length > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {effectiveAvailableCredits.length > 0 ? effectiveAvailableCredits.length : creditsInUse}
                  </p>
                  <p className={`text-xs ${effectiveAvailableCredits.length > 0 ? 'text-green-700' : 'text-yellow-700'}`}>
                    {effectiveAvailableCredits.length > 0 
                      ? `disponível${effectiveAvailableCredits.length !== 1 ? 'is' : ''}` 
                      : 'em uso'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error alert (outside modal, e.g. after modal is closed) */}
        {step === "error" && error && !showSpecialtyModal && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-4">
              <span>{error}</span>
              {error !==
                "Você já possui uma consulta em andamento. Aguarde o atendimento ser concluído ou cancele-o antes de iniciar uma nova consulta." && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFlow}
                  className="gap-2 shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Specialty selection modal */}
        <Dialog
          open={showSpecialtyModal}
          onOpenChange={(open) => {
            if (!open) handleCloseSpecialtyModal();
          }}
        >
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Nova Consulta
              </DialogTitle>
              <DialogDescription>
                Selecione a especialidade para iniciar seu atendimento
              </DialogDescription>
            </DialogHeader>

            {/* Loading state inside modal */}
            {(step === "authenticating" ||
              step === "registering" ||
              step === "loading_specialties") && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {step === "registering" && "Cadastrando paciente..."}
                  {step === "authenticating" && "Autenticando..."}
                  {step === "loading_specialties" && "Carregando especialidades..."}
                </p>
              </div>
            )}

            {/* Error inside modal */}
            {step === "error" && error && (
              <div className="space-y-4 py-2">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                {error !==
                  "Você já possui uma consulta em andamento. Aguarde o atendimento ser concluído ou cancele-o antes de iniciar uma nova consulta." && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={async () => {
                      if (profile) {
                        const cpf = profile.cpf.replace(/\D/g, "");
                        await startConsultationFlow(cpf, profile);
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Tentar novamente
                  </Button>
                )}
              </div>
            )}

            {/* Specialties list */}
            {step === "selecting_specialty" && specialties.length > 0 && (
              <div className="space-y-3 py-2">
                {specialties.map((specialty) => (
                  <SpecialtySelectionCard
                    key={specialty.id}
                    specialty={specialty}
                    onSelect={handleSelectSpecialty}
                    isLoading={isFlowLoading}
                  />
                ))}
              </div>
            )}

            {/* No specialties */}
            {step === "selecting_specialty" && specialties.length === 0 && (
              <Alert className="my-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Nenhuma especialidade disponível</AlertTitle>
                <AlertDescription>
                  Não há especialidades disponíveis para criação de atendimento
                  no momento. Tente novamente mais tarde.
                </AlertDescription>
              </Alert>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de consulta avulsa (usuários sem plano) */}
        <Dialog
          open={showStandaloneModal}
          onOpenChange={(open) => {
            if (!open) setShowStandaloneModal(false);
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Consulta Avulsa
              </DialogTitle>
              <DialogDescription>
                {effectiveAvailableCredits.filter(c => c.type === "clinico_geral").length > 0 
                  ? "Você tem créditos disponíveis! Use um abaixo ou compre uma nova consulta."
                  : "Pague uma consulta avulsa para ser atendido por um clínico geral"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Créditos disponíveis (apenas clínico geral) */}
              {effectiveAvailableCredits.filter(c => c.type === "clinico_geral").length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Seus créditos disponíveis:</p>
                  {effectiveAvailableCredits.filter(c => c.type === "clinico_geral").map((credit) => (
                    <Card
                      key={credit.id}
                      className="cursor-pointer transition-all border-green-200 bg-green-50 hover:border-green-400 hover:shadow-md"
                      onClick={() => handleUseExistingCredit(credit.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="font-medium text-green-800">
                                Clínico Geral
                              </p>
                              <p className="text-xs text-green-600">
                                Válido até {format(new Date(credit.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700">
                            Usar agora
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm text-muted-foreground text-center mb-3">
                      Ou compre uma nova consulta:
                    </p>
                  </div>
                </div>
              )}

              {/* Opção Clínico Geral */}
              <Card 
                className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                onClick={() => navigate("/checkout/consultation?type=clinico_geral")}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Stethoscope className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">Consulta Avulsa - Clínico Geral</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Consulta pontual com médico clínico geral, sem compromisso.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-primary">R$ 59,90</p>
                      <p className="text-xs text-muted-foreground">por consulta</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* CTA para planos */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground text-center mb-3">
                  Ou assine um plano para consultas ilimitadas com clínico geral
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/planos")}
                >
                  Ver planos disponíveis
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Consultations history */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-heading font-semibold text-foreground">
              Minhas Consultas
            </h2>
            {accessToken && (
              <Button
                variant="ghost"
                size="sm"
                onClick={loadConsultations}
                disabled={isLoadingConsultations}
                className="gap-2 text-muted-foreground"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoadingConsultations ? "animate-spin" : ""}`}
                />
                Atualizar
              </Button>
            )}
          </div>

          {/* Loading consultations */}
          {isLoadingConsultations && (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          )}

          {/* Consultations list */}
          {!isLoadingConsultations && accessToken && consultations.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {consultations.map((consultation) => (
                <ConsultationHistoryCard
                  key={consultation.id}
                  consultation={consultation}
                  onJoin={handleJoinConsultation}
                  onCancel={handleRequestCancel}
                  onEvaluate={setEvaluatingConsultation}
                  hasBeenEvaluated={evaluatedIds.has(consultation.id)}
                  receituarioUrl={receituarioMap[consultation.id]}
                />
              ))}
            </div>
          )}

          {/* Empty state after loading */}
          {!isLoadingConsultations &&
            accessToken &&
            consultations.length === 0 && (
              <Card className="bg-card border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
                  <Video className="h-10 w-10 text-muted-foreground" />
                  <p className="text-muted-foreground text-center">
                    Você ainda não possui consultas registradas.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleStartNewConsultation}
                    className="gap-2 mt-1"
                  >
                    <Plus className="h-4 w-4" />
                    Iniciar primeira consulta
                  </Button>
                </CardContent>
              </Card>
            )}
        </div>
      </main>

      {/* Wizard de nova consulta (anamnese + exames) */}
      {showWizardModal && (
        <ConsultaWizardModal
          onClose={() => setShowWizardModal(false)}
          onSubmit={handleWizardSubmit}
        />
      )}

      {/* Modal de avaliação */}
      {evaluatingConsultation && (
        <EvaluationModal
          consultation={evaluatingConsultation}
          accessToken={accessToken}
          onClose={() => setEvaluatingConsultation(null)}
          onSuccess={(id) => {
            setEvaluatedIds((prev) => new Set([...prev, id]));
            setEvaluatingConsultation(null);
          }}
        />
      )}

      {/* Modal de confirmação de cancelamento */}
      <Dialog open={cancelConfirmId !== null} onOpenChange={(open) => { if (!open) setCancelConfirmId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar consulta?</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar esta consulta? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setCancelConfirmId(null)}
              disabled={isCancellingConsultation}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isCancellingConsultation}
              className="gap-2"
            >
              {isCancellingConsultation ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Cancelando...</>
              ) : (
                "Cancelar consulta"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Teleconsultas;
