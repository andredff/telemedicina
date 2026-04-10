import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, CheckCircle2, XCircle, Download, ShoppingCart } from "lucide-react";
import { searchCep, formatCep } from "@/integrations/correios/client";
import { isCepInDeliveryRegion, getRegionLabel } from "@/lib/cepRegion";

interface CepRegionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando CEP é elegível → prosseguir com carrinho */
  onAllowed: () => void;
  /** URL do PDF da receita para download quando região não permitida */
  prescriptionPdfUrl?: string;
}

type Step = "input" | "loading" | "allowed" | "blocked";

export function CepRegionModal({
  open,
  onOpenChange,
  onAllowed,
  prescriptionPdfUrl,
}: CepRegionModalProps) {
  const [cep, setCep] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [city, setCity] = useState("");
  const [regionLabel, setRegionLabel] = useState("");
  const [error, setError] = useState("");

  function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    const formatted = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
    setCep(formatted);
    setError("");
  }

  async function handleValidate() {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setError("Digite um CEP válido com 8 dígitos.");
      return;
    }

    setStep("loading");
    setError("");

    const address = await searchCep(digits);
    const allowed = isCepInDeliveryRegion(digits);
    const label = getRegionLabel(digits);

    setRegionLabel(label);
    setCity(address ? `${address.city} – ${address.state}` : label);

    setStep(allowed ? "allowed" : "blocked");
  }

  function handleReset() {
    setCep("");
    setStep("input");
    setError("");
    setCity("");
    setRegionLabel("");
  }

  function handleProceed() {
    onOpenChange(false);
    onAllowed();
    handleReset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) handleReset();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Verificar disponibilidade de entrega
          </DialogTitle>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe seu CEP para verificar se a entrega está disponível na sua região.
            </p>
            <div className="space-y-2">
              <Label htmlFor="cep-input">CEP</Label>
              <Input
                id="cep-input"
                placeholder="00000-000"
                value={cep}
                onChange={handleCepChange}
                onKeyDown={(e) => e.key === "Enter" && handleValidate()}
                maxLength={9}
                inputMode="numeric"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                className="w-full"
                onClick={handleValidate}
                disabled={cep.replace(/\D/g, "").length !== 8}
              >
                Verificar CEP
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center py-10 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verificando região...</p>
          </div>
        )}

        {step === "allowed" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <p className="text-center font-semibold text-emerald-700">
                Ótima notícia! Entregamos na sua região.
              </p>
              <p className="text-sm text-center text-muted-foreground">
                {city} <br />
                <span className="font-medium text-foreground">{formatCep(cep.replace(/\D/g, ""))}</span>
                {" · "}
                <span className="text-emerald-600">{regionLabel}</span>
              </p>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleProceed}
              >
                <ShoppingCart className="h-4 w-4" />
                Adicionar ao carrinho
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={handleReset}>
                Verificar outro CEP
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "blocked" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center font-semibold text-destructive">
                Entrega não disponível na sua região
              </p>
              <p className="text-sm text-center text-muted-foreground">
                {city && <span>{city}<br /></span>}
                No momento, a compra online está disponível apenas para a região do{" "}
                <strong>Distrito Federal e Entorno</strong>.
              </p>
            </div>
            {prescriptionPdfUrl && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => window.open(prescriptionPdfUrl, "_blank")}
              >
                <Download className="h-4 w-4" />
                Baixar receita (PDF)
              </Button>
            )}
            <DialogFooter>
              <Button variant="ghost" size="sm" className="w-full" onClick={handleReset}>
                Verificar outro CEP
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
