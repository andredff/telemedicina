/**
 * PrescriptionMedicationsModal — Fluxo guiado step-by-step
 *
 * Steps:
 *  "question"      → "Deseja adquirir os medicamentos com desconto?"
 *  "analyzing"     → OCR + IA rodando (loading)
 *  "manual"        → fallback: upload/texto manual
 *  "manual-analyzing" → processando texto manual
 *  "cep"           → input de CEP para validar região
 *  "cep-checking"  → verificando CEP na API
 *  "blocked"       → CEP fora da área → só download
 *  "catalog"       → CEP válido → lista de medicamentos com desconto
 */

import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Pill, Loader2, CheckCircle2, AlertTriangle, ShoppingCart,
  Download, Upload, Search, Package, Star,
  MapPin, XCircle, Tag, ArrowRight, FileText, Minus, Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { usePaidPrescriptions } from "@/hooks/usePaidPrescriptions";
import { searchCep, formatCep } from "@/integrations/correios/client";
import { isCepInDeliveryRegion, getRegionLabel } from "@/lib/cepRegion";
import {
  extractTextFromUrl,
  matchMedicationsInText,
} from "@/services/prescriptionParserService";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ServerEncontrado {
  prescrito: {
    nome: string;
    dosagem: string | null;
    forma: string | null;
    quantidade: string | null;
    posologia: string | null;
  };
  medicamentoId: string;
  nome: string;
  principioAtivo: string | null;
  dosagem: string | null;
  preco: number;
  estoque: number;
  farmaciaId: string | null;
  confidence: "high" | "medium" | "low";
  score: number;
}

interface ServerNaoEncontrado {
  nome: string;
  dosagem: string | null;
  posologia: string | null;
  motivo: string;
  dosagemDisponivel: string | null;
}

interface AnaliseResponse {
  extraidos: unknown[];
  encontrados: ServerEncontrado[];
  naoEncontrados: ServerNaoEncontrado[];
  ocr: { method: string; pages: number };
  ia: { provider: string; warnings: string[] };
}

// ─── Quantidade prescrita ─────────────────────────────────────────────────────

/**
 * Extrai o número de unidades de strings como "1 embalagem", "2 caixas", "30 comprimidos".
 * Retorna 1 como padrão se não encontrar um número claro.
 */
function parseQuantidade(quantidade: string | null): number {
  if (!quantidade) return 1;
  const match = quantidade.match(/^(\d+)/);
  if (!match) return 1;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const LOCAL_SERVER = import.meta.env.VITE_LOCAL_SERVER_URL || "http://localhost:5174";

async function analyzeFile(file: File): Promise<AnaliseResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${LOCAL_SERVER}/api/receitas/analisar`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

async function analyzeText(texto: string): Promise<AnaliseResponse> {
  const res = await fetch(`${LOCAL_SERVER}/api/receitas/analisar-texto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

// ─── Tipos do step ────────────────────────────────────────────────────────────

type FlowStep =
  | "question"          // pergunta inicial
  | "analyzing"         // OCR + IA (loading)
  | "manual"            // fallback manual
  | "manual-analyzing"  // processando texto manual
  | "cep"               // input de CEP
  | "cep-checking"      // consultando CEP
  | "blocked"           // região não atendida
  | "catalog";          // lista de medicamentos liberada

// ─── Props ────────────────────────────────────────────────────────────────────

interface PrescriptionMedicationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prescriptionPdfUrl?: string;
  prescriptionTitle?: string;
  consultationId?: number;
  onCartUpdated?: (count: number) => void;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS_CONFIG = [
  { key: "question",  label: "Receita"     },
  { key: "cep",       label: "Região"      },
  { key: "catalog",   label: "Medicamentos" },
];

function StepIndicator({ current }: { current: FlowStep }) {
  const activeIdx = current === "question" || current === "analyzing" || current === "manual" || current === "manual-analyzing"
    ? 0
    : current === "cep" || current === "cep-checking"
    ? 1
    : current === "catalog" || current === "blocked"
    ? 2
    : 0;

  return (
    <div className="flex items-center gap-1 justify-center mb-2">
      {STEPS_CONFIG.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            i === activeIdx
              ? "bg-emerald-600 text-white"
              : i < activeIdx
              ? "bg-emerald-100 text-emerald-700"
              : "bg-muted text-muted-foreground"
          }`}>
            {i < activeIdx && <CheckCircle2 className="h-3 w-3" />}
            {i === activeIdx && i < 2 && <span className="h-1.5 w-1.5 rounded-full bg-white inline-block" />}
            {s.label}
          </div>
          {i < STEPS_CONFIG.length - 1 && (
            <ArrowRight className={`h-3 w-3 ${i < activeIdx ? "text-emerald-500" : "text-muted-foreground/40"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PrescriptionMedicationsModal({
  open,
  onOpenChange,
  prescriptionPdfUrl,
  prescriptionTitle,
  consultationId,
  onCartUpdated,
}: PrescriptionMedicationsModalProps) {
  const { toast } = useToast();
  const cart = useCart();
  const { isPaid } = usePaidPrescriptions();
  const receitaJaPaga = consultationId !== undefined && isPaid(consultationId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<FlowStep>("question");
  const [encontrados, setEncontrados] = useState<ServerEncontrado[]>([]);
  const [naoEncontrados, setNaoEncontrados] = useState<ServerNaoEncontrado[]>([]);
  const [manualText, setManualText] = useState("");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  // IDs já no carrinho — derivado diretamente do estado global do carrinho
  const addedIds = new Set(cart.catalogItems.map(i => i.cartItemId));

  // Quantidade selecionada por item (antes de adicionar ao carrinho)
  const [qtdMap, setQtdMap] = useState<Record<string, number>>({});

  function getQtd(item: ServerEncontrado): number {
    if (qtdMap[item.medicamentoId] !== undefined) return qtdMap[item.medicamentoId];
    return parseQuantidade(item.prescrito.quantidade);
  }

  function setQtd(id: string, value: number, max: number) {
    setQtdMap(prev => ({ ...prev, [id]: Math.max(1, Math.min(max, value)) }));
  }

  // CEP state
  const [cep, setCep] = useState("");
  const [cepError, setCepError] = useState("");
  const [regionInfo, setRegionInfo] = useState<{ city: string; label: string } | null>(null);

  // ── Helpers carrinho ────────────────────────────────────────────────────────

  function addToCart(item: ServerEncontrado) {
    const qty = getQtd(item);
    const max = parseQuantidade(item.prescrito.quantidade);
    cart.addCatalogItem({
      cartItemId: item.medicamentoId,
      name: item.nome,
      dosage: item.dosagem || "",
      price: item.preco,
      quantity: qty,
      maxQuantity: max,
      principioAtivo: item.principioAtivo ?? undefined,
      receitaId: consultationId !== undefined ? String(consultationId) : undefined,
      receitaUrlPdf: prescriptionPdfUrl,
    });
    onCartUpdated?.(cart.count + 1);
    toast({ title: `${item.nome} adicionado ao carrinho` });
  }

  function addAll() {
    const available = encontrados.filter(e => e.estoque > 0 && !addedIds.has(e.medicamentoId));
    if (!available.length) return;
    for (const item of available) {
      const qty = getQtd(item);
      const max = parseQuantidade(item.prescrito.quantidade);
      cart.addCatalogItem({
        cartItemId: item.medicamentoId,
        name: item.nome,
        dosage: item.dosagem || "",
        price: item.preco,
        quantity: qty,
        maxQuantity: max,
        principioAtivo: item.principioAtivo ?? undefined,
        receitaId: consultationId !== undefined ? String(consultationId) : undefined,
        receitaUrlPdf: prescriptionPdfUrl,
      });
    }
    onCartUpdated?.(cart.count + available.length);
    toast({ title: `${available.length} medicamento${available.length > 1 ? "s" : ""} adicionado${available.length > 1 ? "s" : ""} ao carrinho` });
  }

  // ── Aplicar resultado ───────────────────────────────────────────────────────

  function applyResult(data: AnaliseResponse) {
    setEncontrados(data.encontrados ?? []);
    setNaoEncontrados(data.naoEncontrados ?? []);
    // Vai para o step de CEP (não mostra medicamentos ainda)
    setStep("cep");
  }

  function applyClientResult(matches: Awaited<ReturnType<typeof matchMedicationsInText>>) {
    setEncontrados(matches.map(m => ({
      prescrito: { nome: m.medication.name, dosagem: m.medication.dosage, forma: null, quantidade: null, posologia: null },
      medicamentoId: m.medication.id,
      nome: m.medication.name,
      principioAtivo: m.medication.active_ingredient,
      dosagem: m.medication.dosage,
      preco: m.medication.price,
      estoque: m.medication.stock,
      farmaciaId: m.medication.pharmacy_id,
      confidence: m.confidence,
      score: m.score,
    })));
    setNaoEncontrados([]);
    setStep("cep");
  }

  // ── Análise via arquivo ─────────────────────────────────────────────────────

  async function runAnalysis(file: File) {
    setStep("analyzing");
    setAnalyzeError(null);
    try {
      const data = await analyzeFile(file);
      applyResult(data);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("manual");
    }
  }

  // ── "Sim" — quero comprar: inicia análise automática ───────────────────────

  async function handleWantToBuy() {
    if (!prescriptionPdfUrl) {
      setStep("manual");
      return;
    }
    setStep("analyzing");
    setAnalyzeError(null);
    try {
      const pdfRes = await fetch(prescriptionPdfUrl);
      if (!pdfRes.ok) throw new Error("Não foi possível baixar o PDF");
      const blob = await pdfRes.blob();
      const file = new File([blob], "receita.pdf", { type: "application/pdf" });
      const data = await analyzeFile(file);
      applyResult(data);
    } catch {
      // Fallback client-side
      try {
        const text = await extractTextFromUrl(prescriptionPdfUrl!);
        if (text && text.trim().length > 20) {
          const matches = await matchMedicationsInText(text);
          applyClientResult(matches);
        } else {
          setStep("manual");
        }
      } catch {
        setStep("manual");
      }
    }
  }

  // ── Upload manual ───────────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await runAnalysis(file);
    e.target.value = "";
  }

  // ── Texto manual ────────────────────────────────────────────────────────────

  async function handleManualAnalyze() {
    if (!manualText.trim()) return;
    setStep("manual-analyzing");
    try {
      const data = await analyzeText(manualText);
      applyResult(data);
    } catch {
      const matches = await matchMedicationsInText(manualText);
      applyClientResult(matches);
    }
  }

  // ── CEP ─────────────────────────────────────────────────────────────────────

  function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    const fmt = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
    setCep(fmt);
    setCepError("");
  }

  async function handleCepValidate() {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) { setCepError("Digite um CEP válido com 8 dígitos."); return; }

    setStep("cep-checking");
    const address = await searchCep(digits);
    const allowed = isCepInDeliveryRegion(digits);
    const label = getRegionLabel(digits);
    const city = address ? `${address.city} – ${address.state}` : label;

    setRegionInfo({ city, label });

    if (allowed) {
      setStep("catalog");
    } else {
      setStep("blocked");
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────────

  function handleOpenChange(v: boolean) {
    onOpenChange(v);
    if (!v) {
      setStep("question");
      setEncontrados([]);
      setNaoEncontrados([]);
      setManualText("");
      setAnalyzeError(null);
      setCep("");
      setCepError("");
      setRegionInfo(null);
    }
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  const availableInStock = encontrados.filter(e => e.estoque > 0);
  const cartCount = cart.count;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-emerald-600 shrink-0" />
            Medicamentos da Receita
            {prescriptionTitle && (
              <span className="text-sm font-normal text-muted-foreground">— {prescriptionTitle}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} />

        {/* ═══ STEP 1: Pergunta inicial ════════════════════════════════════════ */}
        {step === "question" && (
          <div className="space-y-5 py-2">
            <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-white p-5 text-center space-y-3">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <Tag className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-base">Deseja adquirir os medicamentos com desconto?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Identificamos os medicamentos desta receita e podemos entregá-los com preço especial.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 h-12 text-base"
                onClick={handleWantToBuy}
              >
                <CheckCircle2 className="h-5 w-5" />
                Sim, quero comprar com desconto
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full gap-2 h-11"
                onClick={() => {
                  if (prescriptionPdfUrl) window.open(prescriptionPdfUrl, "_blank");
                  handleOpenChange(false);
                }}
              >
                <Download className="h-4 w-4" />
                Não, apenas baixar a receita
              </Button>
            </div>
          </div>
        )}

        {/* ═══ STEP: Analisando (loading) ════════════════════════════════════ */}
        {step === "analyzing" && (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center">
                <FileText className="h-8 w-8 text-emerald-400 animate-pulse" />
              </div>
              <Loader2 className="absolute -top-1 -right-1 h-6 w-6 animate-spin text-emerald-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-medium">Lendo sua receita...</p>
              <p className="text-sm text-muted-foreground">OCR + IA identificando medicamentos</p>
            </div>
            <div className="w-full space-y-2 pt-2">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-3/4 rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>
        )}

        {/* ═══ STEP: Manual ══════════════════════════════════════════════════ */}
        {(step === "manual" || step === "manual-analyzing") && (
          <div className="space-y-4 py-2">
            {analyzeError && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Leitura automática indisponível.</p>
                  <p className="text-xs mt-0.5">{analyzeError}</p>
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Faça upload do arquivo da receita ou cole o texto para identificarmos os medicamentos.
            </p>

            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileUpload} />
              <Button
                variant="outline"
                className="flex-1 gap-2"
                disabled={step === "manual-analyzing"}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Upload PDF ou imagem
              </Button>
              {prescriptionPdfUrl && (
                <Button variant="outline" className="gap-2" onClick={() => window.open(prescriptionPdfUrl, "_blank")}>
                  <Download className="h-4 w-4" />
                  Baixar
                </Button>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <label className="text-sm font-medium">Ou cole o texto da receita:</label>
              <Textarea
                placeholder={"Dipirona 500mg — 1 comprimido 3x ao dia\nIbuprofeno 200mg — 1 comprimido de 8/8h"}
                rows={5}
                value={manualText}
                onChange={e => setManualText(e.target.value)}
                disabled={step === "manual-analyzing"}
              />
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                disabled={!manualText.trim() || step === "manual-analyzing"}
                onClick={handleManualAnalyze}
              >
                {step === "manual-analyzing"
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Identificando...</>
                  : <><Search className="h-4 w-4" />Identificar Medicamentos</>}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground gap-1"
              onClick={() => setStep("question")}
            >
              ← Voltar
            </Button>
          </div>
        )}

        {/* ═══ STEP 2: CEP ════════════════════════════════════════════════════ */}
        {(step === "cep" || step === "cep-checking") && (
          <div className="space-y-5 py-2">
            <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-white p-5 text-center space-y-3">
              <div className="mx-auto h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center">
                <MapPin className="h-7 w-7 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-base">Qual é o seu CEP?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Precisamos verificar se entregamos na sua região.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="00000-000"
                value={cep}
                onChange={handleCepChange}
                onKeyDown={e => e.key === "Enter" && step === "cep" && handleCepValidate()}
                inputMode="numeric"
                maxLength={9}
                className="text-center text-lg tracking-widest h-12"
                disabled={step === "cep-checking"}
              />
              {cepError && <p className="text-xs text-destructive text-center">{cepError}</p>}
            </div>

            <Button
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 gap-2 text-base"
              onClick={handleCepValidate}
              disabled={cep.replace(/\D/g, "").length !== 8 || step === "cep-checking"}
            >
              {step === "cep-checking"
                ? <><Loader2 className="h-5 w-5 animate-spin" />Verificando...</>
                : <><MapPin className="h-5 w-5" />Verificar minha região</>}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground gap-1"
              onClick={() => setStep("question")}
            >
              ← Voltar
            </Button>
          </div>
        )}

        {/* ═══ STEP: Bloqueado ════════════════════════════════════════════════ */}
        {step === "blocked" && (
          <div className="space-y-5 py-2">
            <div className="rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-5 text-center space-y-3">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-7 w-7 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-base text-red-700">Região não atendida</p>
                {regionInfo && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {regionInfo.city} — {formatCep(cep.replace(/\D/g, ""))}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  No momento, a compra com desconto está disponível apenas para o{" "}
                  <strong className="text-foreground">Distrito Federal e Entorno</strong>.
                </p>
              </div>
            </div>

            <p className="text-sm text-center text-muted-foreground">
              Você ainda pode baixar a receita e adquirir os medicamentos em uma farmácia próxima.
            </p>

            {prescriptionPdfUrl && (
              <Button
                className="w-full gap-2 h-12 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => window.open(prescriptionPdfUrl, "_blank")}
              >
                <Download className="h-5 w-5" />
                Baixar receita
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1"
              onClick={() => { setCep(""); setRegionInfo(null); setStep("cep"); }}
            >
              <MapPin className="h-4 w-4" />
              Tentar outro CEP
            </Button>
          </div>
        )}

        {/* ═══ STEP 3: Catálogo (CEP válido) ══════════════════════════════════ */}
        {step === "catalog" && (
          <div className="space-y-4 py-2">
            {/* Banner: receita já paga */}
            {receitaJaPaga && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Medicamentos já adquiridos</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Você já realizou a compra dos medicamentos desta receita. Não é possível adicionar novamente.
                  </p>
                </div>
              </div>
            )}

            {/* Confirmação de região */}
            {regionInfo && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Entregamos em <strong>{regionInfo.city}</strong>!
                  <span className="ml-1 text-emerald-600 font-medium">Desconto disponível para sua região.</span>
                </span>
              </div>
            )}

            {/* Medicamentos encontrados */}
            {encontrados.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {encontrados.length} medicamento{encontrados.length > 1 ? "s" : ""} disponível{encontrados.length > 1 ? "is" : ""} com desconto
                </p>

                <div className="space-y-2">
                  {encontrados.map(item => {
                    const maxQtd = parseQuantidade(item.prescrito.quantidade);
                    const qtd = getQtd(item);
                    const jaAdicionado = addedIds.has(item.medicamentoId);
                    return (
                      <div
                        key={item.medicamentoId}
                        className="p-3 rounded-xl border bg-card hover:shadow-sm transition-all space-y-2.5"
                      >
                        {/* Linha superior: nome + badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{item.nome}</p>
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-4 gap-0.5 shrink-0">
                                <Star className="h-2.5 w-2.5" />
                                Prescrito para você
                              </Badge>
                            </div>
                            {item.principioAtivo && (
                              <p className="text-xs text-muted-foreground">{item.principioAtivo}</p>
                            )}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {item.dosagem && <span className="text-xs text-muted-foreground">{item.dosagem}</span>}
                              {item.prescrito.posologia && (
                                <span className="text-xs text-blue-600/80">· {item.prescrito.posologia}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm">R$ {item.preco.toFixed(2)}</p>
                            <p className={`text-[10px] ${item.estoque > 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {item.estoque > 0 ? "Em estoque" : "Sem estoque"}
                            </p>
                          </div>
                        </div>

                        {/* Linha inferior: quantidade + botão */}
                        <div className="flex items-center justify-between gap-3">
                          {/* Seletor de quantidade */}
                          {!jaAdicionado ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground mr-1">Qtd:</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6 rounded"
                                disabled={qtd <= 1}
                                onClick={() => setQtd(item.medicamentoId, qtd - 1, maxQtd)}
                              >
                                <Minus className="h-2.5 w-2.5" />
                              </Button>
                              <span className="w-6 text-center text-sm font-semibold tabular-nums">{qtd}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6 rounded"
                                disabled={qtd >= maxQtd}
                                onClick={() => setQtd(item.medicamentoId, qtd + 1, maxQtd)}
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </Button>
                              {item.prescrito.quantidade && (
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  (máx. {maxQtd} {maxQtd === 1 ? "embalagem" : "embalagens"} prescrita{maxQtd === 1 ? "" : "s"})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>{qtd} {qtd === 1 ? "unidade" : "unidades"} no carrinho</span>
                            </div>
                          )}

                          <Button
                            size="sm"
                            disabled={item.estoque === 0 || receitaJaPaga}
                            className={`gap-1.5 text-xs shrink-0 transition-all ${
                              jaAdicionado || receitaJaPaga
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-primary hover:bg-primary/90"
                            }`}
                            onClick={() => !receitaJaPaga && addToCart(item)}
                          >
                            {jaAdicionado || receitaJaPaga
                              ? <><CheckCircle2 className="h-3.5 w-3.5" />Adicionado</>
                              : <><ShoppingCart className="h-3.5 w-3.5" />Adicionar</>}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CTAs */}
                <div className="flex flex-col gap-2 pt-1">
                  {!receitaJaPaga && availableInStock.filter(e => !addedIds.has(e.medicamentoId)).length > 1 && (
                    <Button
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 h-11"
                      onClick={addAll}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Adicionar todos ao carrinho ({availableInStock.filter(e => !addedIds.has(e.medicamentoId)).length} itens)
                    </Button>
                  )}
                  {cartCount > 0 && (
                    <Button
                      className="w-full gap-2 h-11"
                      onClick={() => { window.location.href = "/cart"; }}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Finalizar compra ({cartCount} {cartCount === 1 ? "item" : "itens"})
                    </Button>
                  )}
                  {prescriptionPdfUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => window.open(prescriptionPdfUrl, "_blank")}
                    >
                      <Download className="h-4 w-4" />
                      Baixar receita também
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground">Nenhum medicamento encontrado no catálogo para esta receita.</p>
                {prescriptionPdfUrl && (
                  <Button variant="outline" className="gap-2 mx-auto" onClick={() => window.open(prescriptionPdfUrl, "_blank")}>
                    <Download className="h-4 w-4" />
                    Baixar receita
                  </Button>
                )}
              </div>
            )}

            {/* Não encontrados */}
            {naoEncontrados.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Não disponíveis no catálogo
                </p>
                <div className="space-y-1.5">
                  {naoEncontrados.map((med, i) => (
                    <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg border border-dashed ${med.motivo === "dosagem-diferente" ? "bg-amber-50/50 border-amber-200" : "bg-muted/30"}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-muted-foreground">{med.nome}</p>
                        {med.motivo === "dosagem-diferente" ? (
                          <div className="mt-0.5 space-y-0.5">
                            <p className="text-xs text-amber-700">
                              Receita: <span className="font-medium">{med.dosagem}</span>
                            </p>
                            {med.dosagemDisponivel && (
                              <p className="text-xs text-muted-foreground/70">
                                Disponível: {med.dosagemDisponivel}
                              </p>
                            )}
                          </div>
                        ) : (
                          med.dosagem && <p className="text-xs text-muted-foreground/70">{med.dosagem}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${med.motivo === "dosagem-diferente" ? "text-amber-700 border-amber-400" : "text-amber-600 border-amber-300"}`}>
                        {med.motivo === "dosagem-diferente" ? "Dosagem diferente" : "Indisponível"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
