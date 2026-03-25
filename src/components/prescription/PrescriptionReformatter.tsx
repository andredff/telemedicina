/**
 * PrescriptionReformatter.tsx
 *
 * UI para reformatar receita PDF com identidade visual Novità.
 * Suporta três modos de entrada:
 *  - initialPdfUrl: extrai automaticamente via URL (Assemed)
 *  - Upload de arquivo local (drag & drop ou clique)
 *  - Cola de texto manual (fallback CORS)
 */

import { useState, useCallback, useEffect } from "react";
import {
  Upload, FileText, Download, Eye, RefreshCw,
  CheckCircle2, AlertCircle, Edit3, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import { PrescriptionPdfDocument } from "./PrescriptionPdfDocument";
import {
  extractTextFromUrl,
  extractTextFromFile,
} from "@/services/prescriptionParserService";
import {
  parsePrescriptionText,
  type ParsedPrescriptionData,
  type ParsedMedication,
} from "@/services/prescriptionStructuredParser";
import logoUrl from "@/assets/logo-novita.png";

// ─── Props ─────────────────────────────────────────────────────────────────

export interface PrescriptionReformatterProps {
  /** URL do PDF Assemed — pula o passo de upload e extrai automaticamente */
  initialPdfUrl?: string;
  /** Dados pré-preenchidos vindos do card (médico, especialidade, data) */
  initialMeta?: {
    doctorName?: string;
    specialty?: string;
    date?: string;
    patientName?: string;
  };
}

// ─── Estados do fluxo ──────────────────────────────────────────────────────

type FlowStep = "auto-extracting" | "upload" | "review" | "preview";

// ─── Sub-componente: Editor de medicamentos ────────────────────────────────

function MedicationEditor({
  med,
  index,
  onChange,
}: {
  med: ParsedMedication;
  index: number;
  onChange: (updated: ParsedMedication) => void;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className="text-xs">#{index + 1}</Badge>
          <span className="text-sm font-medium text-muted-foreground">Medicamento</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label className="text-xs">Nome do medicamento</Label>
            <Input
              value={med.name}
              onChange={(e) => onChange({ ...med, name: e.target.value })}
              className="mt-1 text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Dosagem</Label>
              <Input
                value={med.dosage || ""}
                onChange={(e) => onChange({ ...med, dosage: e.target.value })}
                placeholder="ex: 500mg"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Frequência</Label>
              <Input
                value={med.frequency || ""}
                onChange={(e) => onChange({ ...med, frequency: e.target.value })}
                placeholder="ex: 2x ao dia"
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Duração</Label>
              <Input
                value={med.duration || ""}
                onChange={(e) => onChange({ ...med, duration: e.target.value })}
                placeholder="ex: 7 dias"
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Instruções adicionais</Label>
            <Input
              value={med.instructions || ""}
              onChange={(e) => onChange({ ...med, instructions: e.target.value })}
              placeholder="ex: tomar após as refeições"
              className="mt-1 text-sm"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────

export function PrescriptionReformatter({
  initialPdfUrl,
  initialMeta,
}: PrescriptionReformatterProps) {
  const [step, setStep] = useState<FlowStep>(
    initialPdfUrl ? "auto-extracting" : "upload"
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [data, setData] = useState<ParsedPrescriptionData | null>(null);
  const [fileName, setFileName] = useState<string>("");

  // ── Auto-extração via URL (modo Assemed) ───────────────────────────────

  useEffect(() => {
    if (!initialPdfUrl) return;

    let cancelled = false;

    const autoExtract = async () => {
      setIsExtracting(true);
      setExtractionError(null);

      try {
        const rawText = await extractTextFromUrl(initialPdfUrl);

        if (cancelled) return;

        if (rawText && rawText.trim().length > 20) {
          const parsed = parsePrescriptionText(rawText);
          // Mescla com metadados do card (médico, especialidade, data)
          const merged: ParsedPrescriptionData = {
            ...parsed,
            doctorName: parsed.doctorName || initialMeta?.doctorName,
            specialty: parsed.specialty || initialMeta?.specialty,
            date: parsed.date || initialMeta?.date,
            patientName: parsed.patientName || initialMeta?.patientName,
          };
          setData(merged);
          // Extração automática bem-sucedida → vai direto para preview
          setStep("preview");
        } else {
          // CORS bloqueou — vai para upload/manual com metadados pré-preenchidos
          setData({
            medications: [],
            rawText: "",
            doctorName: initialMeta?.doctorName,
            specialty: initialMeta?.specialty,
            date: initialMeta?.date,
            patientName: initialMeta?.patientName,
          });
          setExtractionError(
            "O PDF não pôde ser lido automaticamente (restrição de acesso). " +
            "Os dados do médico foram preenchidos. Faça upload do PDF ou cole o texto para extrair os medicamentos."
          );
          setStep("review");
        }
      } catch {
        if (cancelled) return;
        setData({
          medications: [],
          rawText: "",
          doctorName: initialMeta?.doctorName,
          specialty: initialMeta?.specialty,
          date: initialMeta?.date,
        });
        setExtractionError("Erro ao processar o PDF. Você pode ajustar os dados manualmente.");
        setStep("review");
      } finally {
        if (!cancelled) setIsExtracting(false);
      }
    };

    autoExtract();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPdfUrl]);

  // ── Upload e extração manual ───────────────────────────────────────────

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.includes("pdf")) {
      setExtractionError("Por favor, selecione um arquivo PDF.");
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setFileName(file.name);

    try {
      const rawText = await extractTextFromFile(file);

      if (!rawText || rawText.trim().length < 20) {
        setExtractionError(
          "Não foi possível extrair texto deste PDF. Pode ser um PDF digitalizado (imagem). Cole o texto manualmente abaixo."
        );
        setData((prev) => prev ?? { medications: [], rawText: "" });
        setStep("review");
        return;
      }

      const parsed = parsePrescriptionText(rawText);
      // Se já havia metadados do Assemed, preserva os que o parser não encontrou
      setData((prev) => ({
        ...parsed,
        doctorName: parsed.doctorName || prev?.doctorName || initialMeta?.doctorName,
        specialty: parsed.specialty || prev?.specialty || initialMeta?.specialty,
        date: parsed.date || prev?.date || initialMeta?.date,
        patientName: parsed.patientName || prev?.patientName || initialMeta?.patientName,
      }));
      setStep("review");
    } catch (err) {
      setExtractionError("Erro ao processar o arquivo. Tente novamente.");
      console.error("[PrescriptionReformatter]", err);
    } finally {
      setIsExtracting(false);
    }
  }, [initialMeta]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  // ── Edição de dados ────────────────────────────────────────────────────

  const updateField = (field: keyof ParsedPrescriptionData, value: string) => {
    setData((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const updateMedication = (index: number, updated: ParsedMedication) => {
    setData((prev) => {
      if (!prev) return prev;
      const meds = [...prev.medications];
      meds[index] = updated;
      return { ...prev, medications: meds };
    });
  };

  const addMedication = () => {
    setData((prev) => prev ? {
      ...prev,
      medications: [...prev.medications, { name: "" }],
    } : prev);
  };

  const removeMedication = (index: number) => {
    setData((prev) => prev ? {
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    } : prev);
  };

  const handleManualText = (text: string) => {
    if (text.trim().length < 10) return;
    const parsed = parsePrescriptionText(text);
    setData((prev) => ({
      ...parsed,
      doctorName: parsed.doctorName || prev?.doctorName || initialMeta?.doctorName,
      specialty: parsed.specialty || prev?.specialty || initialMeta?.specialty,
      date: parsed.date || prev?.date || initialMeta?.date,
      patientName: parsed.patientName || prev?.patientName || initialMeta?.patientName,
    }));
  };

  // ── Reset ──────────────────────────────────────────────────────────────

  const reset = () => {
    setStep(initialPdfUrl ? "auto-extracting" : "upload");
    setData(null);
    setFileName("");
    setExtractionError(null);
    if (initialPdfUrl) {
      // Re-dispara o useEffect
      window.location.reload();
    }
  };

  // ─── Render: Auto-extraindo ───────────────────────────────────────────

  if (step === "auto-extracting") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <p className="font-medium text-lg">Lendo receita...</p>
        <p className="text-sm text-muted-foreground">
          Extraindo dados do PDF da consulta
        </p>
      </div>
    );
  }

  // ─── Render: Upload ───────────────────────────────────────────────────

  if (step === "upload") {
    return (
      <div className="space-y-4">
        <div
          className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => document.getElementById("pdf-upload-input")?.click()}
        >
          <input
            id="pdf-upload-input"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileInput}
          />
          {isExtracting ? (
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-10 w-10 text-primary animate-spin" />
              <p className="font-medium">Extraindo texto do PDF...</p>
              <p className="text-sm text-muted-foreground">Aguarde um momento</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">
                  Arraste o PDF da receita ou clique para selecionar
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Suporta receitas médicas digitais em PDF
                </p>
              </div>
              <Button variant="outline" size="sm" className="mt-2" type="button">
                <FileText className="h-4 w-4 mr-2" />
                Selecionar PDF
              </Button>
            </div>
          )}
        </div>

        {extractionError && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{extractionError}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Review ───────────────────────────────────────────────────

  if (step === "review" && data) {
    const pdfFileName = `receita-novita-${data.patientName?.split(" ")[0]?.toLowerCase() || "paciente"}.pdf`;

    return (
      <div className="space-y-6">
        {/* Header do review */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {extractionError ? (
              <AlertCircle className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            <div>
              <p className="font-medium text-sm">
                {extractionError ? "Dados parcialmente extraídos" : "Dados extraídos com sucesso"}
              </p>
              {fileName && (
                <p className="text-xs text-muted-foreground">{fileName}</p>
              )}
              {initialPdfUrl && !fileName && (
                <p className="text-xs text-muted-foreground">Receita da consulta Assemed</p>
              )}
            </div>
          </div>
          {!initialPdfUrl && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Novo PDF
            </Button>
          )}
        </div>

        {/* Aviso de CORS / extração parcial */}
        {extractionError && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-3">
              <p className="text-sm text-amber-800">{extractionError}</p>

              {/* Upload alternativo */}
              <div>
                <input
                  id="pdf-fallback-input"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => document.getElementById("pdf-fallback-input")?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {isExtracting ? "Extraindo..." : "Fazer upload do PDF"}
                </Button>
              </div>

              <Separator />

              <div>
                <Label className="text-xs text-amber-800">Ou cole o texto da receita:</Label>
                <Textarea
                  placeholder="Cole o conteúdo da receita médica aqui..."
                  className="mt-1 text-xs h-24"
                  onChange={(e) => handleManualText(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Dados do paciente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-primary" />
              Dados do Paciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-xs">Nome do paciente</Label>
              <Input
                value={data.patientName || ""}
                onChange={(e) => updateField("patientName", e.target.value)}
                placeholder="Nome completo do paciente"
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Dados do médico */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-primary" />
              Dados do Profissional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome do médico</Label>
                <Input
                  value={data.doctorName || ""}
                  onChange={(e) => updateField("doctorName", e.target.value)}
                  placeholder="Dr(a). Nome"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">CRM</Label>
                <Input
                  value={data.doctorCRM || ""}
                  onChange={(e) => updateField("doctorCRM", e.target.value)}
                  placeholder="CRM/SP 123456"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Especialidade</Label>
                <Input
                  value={data.specialty || ""}
                  onChange={(e) => updateField("specialty", e.target.value)}
                  placeholder="ex: Clínico Geral"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Data da receita</Label>
                <Input
                  value={data.date || ""}
                  onChange={(e) => updateField("date", e.target.value)}
                  placeholder="DD/MM/YYYY"
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medicamentos */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-primary" />
                Medicamentos Prescritos
                <Badge variant="secondary" className="ml-1">
                  {data.medications.length}
                </Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={addMedication}>
                + Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.medications.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum medicamento extraído. Clique em "+ Adicionar" para incluir manualmente.
              </p>
            )}
            {data.medications.map((med, i) => (
              <div key={i} className="relative">
                <MedicationEditor
                  med={med}
                  index={i}
                  onChange={(updated) => updateMedication(i, updated)}
                />
                {data.medications.length > 0 && (
                  <button
                    onClick={() => removeMedication(i)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center hover:bg-destructive/80"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={data.observations || ""}
              onChange={(e) => updateField("observations", e.target.value)}
              placeholder="Observações gerais do médico (opcional)"
              className="text-sm"
              rows={3}
            />
          </CardContent>
        </Card>

        <Separator />

        {/* Ações */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setStep("preview")}>
            <Eye className="h-4 w-4 mr-2" />
            Pré-visualizar
          </Button>

          <PDFDownloadLink
            document={<PrescriptionPdfDocument data={data} logoUrl={logoUrl} />}
            fileName={pdfFileName}
          >
            {({ loading }) => (
              <Button disabled={loading} className="gradient-hero text-primary-foreground">
                <Download className="h-4 w-4 mr-2" />
                {loading ? "Gerando PDF..." : "Baixar Nova Receita"}
              </Button>
            )}
          </PDFDownloadLink>
        </div>
      </div>
    );
  }

  // ─── Render: Preview ──────────────────────────────────────────────────

  if (step === "preview" && data) {
    const pdfFileName = `receita-novita-${data.patientName?.split(" ")[0]?.toLowerCase() || "paciente"}.pdf`;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStep("review")}>
            ← Editar dados
          </Button>
          <PDFDownloadLink
            document={<PrescriptionPdfDocument data={data} logoUrl={logoUrl} />}
            fileName={pdfFileName}
          >
            {({ loading }) => (
              <Button disabled={loading} className="gradient-hero text-primary-foreground">
                <Download className="h-4 w-4 mr-2" />
                {loading ? "Gerando..." : "Baixar PDF"}
              </Button>
            )}
          </PDFDownloadLink>
        </div>

        <div className="border rounded-xl overflow-hidden" style={{ height: "70vh" }}>
          <PDFViewer width="100%" height="100%" showToolbar={false}>
            <PrescriptionPdfDocument data={data} logoUrl={logoUrl} />
          </PDFViewer>
        </div>
      </div>
    );
  }

  return null;
}
