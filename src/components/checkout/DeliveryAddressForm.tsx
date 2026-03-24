import { useState, useEffect, useRef } from "react";
import { MapPin, Edit2, Check, Search, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { searchCep, isValidCepFormat } from "@/integrations/correios";
import { toast } from "sonner";

// ─── Regra de negócio: somente DF ────────────────────────────────────────────
function isDF(state: string): boolean {
  return state.trim().toUpperCase() === "DF";
}

// ─── Validação de campos obrigatórios ────────────────────────────────────────
type FieldErrors = Partial<Record<keyof DeliveryAddress, string>>;

function validateAddress(addr: DeliveryAddress): FieldErrors {
  const errors: FieldErrors = {};

  if (!addr.street.trim())        errors.street       = "Logradouro obrigatório";
  if (!addr.number.trim())        errors.number       = "Número obrigatório";
  if (!addr.neighborhood.trim())  errors.neighborhood = "Bairro obrigatório";
  if (!addr.city.trim())          errors.city         = "Cidade obrigatória";
  if (!addr.zipCode.trim())       errors.zipCode      = "CEP obrigatório";

  if (addr.state.trim() === "") {
    errors.state = "UF obrigatória";
  } else if (!isDF(addr.state)) {
    errors.state = "No momento, atendemos apenas o Distrito Federal (DF)";
  }

  return errors;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface DeliveryAddressFormProps {
  onAddressConfirm: (address: DeliveryAddress) => void;
  onCancel?: () => void;
  autoConfirm?: boolean;
}

export interface DeliveryAddress {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

// ─── Componente ──────────────────────────────────────────────────────────────
export function DeliveryAddressForm({
  onAddressConfirm,
  onCancel,
  autoConfirm = true,
}: DeliveryAddressFormProps) {
  const [isEditing, setIsEditing]           = useState(false);
  const [isLoading, setIsLoading]           = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepError, setCepError]             = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]       = useState<FieldErrors>({});
  const [regionBlocked, setRegionBlocked]   = useState(false);

  const [address, setAddress] = useState<DeliveryAddress>({
    street: "", number: "", complement: "",
    neighborhood: "", city: "", state: "", zipCode: "",
  });
  const [originalAddress, setOriginalAddress] = useState<DeliveryAddress | null>(null);

  // refs para scroll automático no primeiro erro
  const fieldRefs: Record<keyof DeliveryAddress, React.RefObject<HTMLDivElement>> = {
    zipCode:      useRef<HTMLDivElement>(null),
    street:       useRef<HTMLDivElement>(null),
    number:       useRef<HTMLDivElement>(null),
    complement:   useRef<HTMLDivElement>(null),
    neighborhood: useRef<HTMLDivElement>(null),
    city:         useRef<HTMLDivElement>(null),
    state:        useRef<HTMLDivElement>(null),
  };

  useEffect(() => { loadProfileAddress(); }, []);

  // Atualiza flag de região bloqueada em tempo real
  useEffect(() => {
    if (address.state.trim()) {
      setRegionBlocked(!isDF(address.state));
    } else {
      setRegionBlocked(false);
    }
  }, [address.state]);

  const loadProfileAddress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("address, number, complement, neighborhood, city, state, zip_code")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        const loaded: DeliveryAddress = {
          street:       (data.address      || "").trim(),
          number:       (data.number       || "").trim(),
          complement:   (data.complement   || "").trim(),
          neighborhood: (data.neighborhood || "").trim(),
          city:         (data.city         || "").trim(),
          state:        (data.state        || "").trim().toUpperCase(),
          zipCode:      (data.zip_code     || "").trim(),
        };
        setAddress(loaded);
        setOriginalAddress(loaded);

        const isComplete = loaded.street && loaded.number && loaded.zipCode &&
                           loaded.city   && loaded.state;

        // Auto-confirma apenas se completo E dentro do DF
        if (autoConfirm && isComplete && isDF(loaded.state)) {
          onAddressConfirm(loaded);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar endereço do perfil:", err);
    }
  };

  const handleInputChange = (field: keyof DeliveryAddress, value: string) => {
    const normalized = field === "state" ? value.toUpperCase() : value;
    setAddress((prev) => ({ ...prev, [field]: normalized }));

    // Limpa erros do campo alterado
    if (fieldErrors[field]) {
      setFieldErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
    }
    if (field === "zipCode") setCepError(null);
  };

  const handleCepSearch = async () => {
    const cep = address.zipCode.trim();
    if (!isValidCepFormat(cep)) {
      setCepError("CEP inválido. Digite os 8 dígitos.");
      return;
    }

    setIsSearchingCep(true);
    setCepError(null);

    try {
      const result = await searchCep(cep);
      if (result) {
        const state = (result.state || "").trim().toUpperCase();
        setAddress((prev) => ({
          ...prev,
          street:       result.street       || prev.street,
          neighborhood: result.neighborhood || prev.neighborhood,
          city:         result.city         || prev.city,
          state,
        }));
        // Limpa erro de UF se agora é DF
        if (isDF(state) && fieldErrors.state) {
          setFieldErrors((prev) => { const e = { ...prev }; delete e.state; return e; });
        }
      } else {
        setCepError("CEP não encontrado. Preencha o endereço manualmente.");
      }
    } catch {
      setCepError("Erro ao buscar CEP. Tente novamente.");
    } finally {
      setIsSearchingCep(false);
    }
  };

  const scrollToFirstError = (errors: FieldErrors) => {
    const order: (keyof DeliveryAddress)[] = [
      "zipCode", "street", "number", "neighborhood", "city", "state",
    ];
    for (const field of order) {
      if (errors[field]) {
        fieldRefs[field].current?.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  };

  const handleSave = async () => {
    // Normaliza antes de validar
    const normalized: DeliveryAddress = {
      street:       address.street.trim(),
      number:       address.number.trim(),
      complement:   address.complement.trim(),
      neighborhood: address.neighborhood.trim(),
      city:         address.city.trim(),
      state:        address.state.trim().toUpperCase(),
      zipCode:      address.zipCode.trim(),
    };
    setAddress(normalized);

    const errors = validateAddress(normalized);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      scrollToFirstError(errors);
      toast.error("Corrija os campos destacados antes de continuar.");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("profiles")
        .update({
          address:      normalized.street,
          number:       normalized.number,
          complement:   normalized.complement,
          neighborhood: normalized.neighborhood,
          city:         normalized.city,
          state:        normalized.state,
          zip_code:     normalized.zipCode,
          updated_at:   new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setOriginalAddress(normalized);
      setIsEditing(false);
      setFieldErrors({});
      onAddressConfirm(normalized);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar endereço";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (!isDF(address.state)) {
      toast.error("No momento, atendemos apenas o Distrito Federal (DF).");
      return;
    }
    onAddressConfirm(address);
  };

  const handleCancelEdit = () => {
    if (originalAddress) setAddress(originalAddress);
    setIsEditing(false);
    setCepError(null);
    setFieldErrors({});
  };

  const hasAddress = address.street && address.city && address.state && address.zipCode;

  // ── View: endereço já preenchido (modo leitura) ───────────────────────────
  if (!isEditing) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            Endereço de Entrega
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasAddress ? (
            <div className="space-y-2">
              <p className="font-medium">
                {address.street}, {address.number}
                {address.complement && ` - ${address.complement}`}
              </p>
              <p className="text-muted-foreground">{address.neighborhood}</p>
              <p className="text-muted-foreground">
                {address.city} - {address.state}, {address.zipCode}
              </p>

              {regionBlocked && (
                <Alert variant="destructive" className="mt-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No momento, atendemos apenas o Distrito Federal (DF).
                    Altere o endereço para continuar.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3 mt-4 pt-2">
                <Button
                  onClick={handleContinue}
                  className="flex-1 gap-2"
                  disabled={regionBlocked}
                >
                  Continuar para Pagamento
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Alterar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">Nenhum endereço cadastrado</p>
              <Button onClick={() => setIsEditing(true)} className="gap-2">
                <MapPin className="h-4 w-4" />
                Adicionar endereço
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── View: formulário de edição ────────────────────────────────────────────
  const field = (
    id: keyof DeliveryAddress,
    label: string,
    placeholder: string,
    extra?: React.InputHTMLAttributes<HTMLInputElement>
  ) => (
    <div ref={fieldRefs[id]}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={address[id]}
        onChange={(e) => handleInputChange(id, e.target.value)}
        placeholder={placeholder}
        className={fieldErrors[id] ? "border-red-500 focus-visible:ring-red-500" : ""}
        {...extra}
      />
      {fieldErrors[id] && (
        <p className="text-xs text-red-500 mt-1">{fieldErrors[id]}</p>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5" />
          {originalAddress ? "Alterar Endereço" : "Adicionar Endereço"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CEP */}
        <div ref={fieldRefs.zipCode}>
          <Label htmlFor="zipCode">CEP</Label>
          <div className="flex gap-2">
            <Input
              id="zipCode"
              value={address.zipCode}
              onChange={(e) => handleInputChange("zipCode", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValidCepFormat(address.zipCode)) {
                  e.preventDefault();
                  handleCepSearch();
                }
              }}
              placeholder="00000-000"
              className={`flex-1 ${fieldErrors.zipCode ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleCepSearch}
              disabled={isSearchingCep || !isValidCepFormat(address.zipCode)}
              className="gap-1 min-w-[100px]"
            >
              {isSearchingCep ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Buscando...</>
              ) : (
                <><Search className="h-4 w-4" />Buscar</>
              )}
            </Button>
          </div>
          {cepError && <p className="text-xs text-red-500 mt-1">{cepError}</p>}
          {fieldErrors.zipCode && <p className="text-xs text-red-500 mt-1">{fieldErrors.zipCode}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            Digite o CEP e clique em Buscar para preencher automaticamente
          </p>
        </div>

        {/* Logradouro + Número */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            {field("street", "Rua/Avenida", "Nome da rua")}
          </div>
          <div className="col-span-2 sm:col-span-1">
            {field("number", "Número", "123")}
          </div>
        </div>

        {field("complement", "Complemento (opcional)", "Apto, bloco, referência...")}
        {field("neighborhood", "Bairro", "Nome do bairro")}

        {/* Cidade + UF */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            {field("city", "Cidade", "Ex: Brasília")}
          </div>
          <div className="col-span-2 sm:col-span-1">
            {field("state", "Estado (UF)", "DF", { maxLength: 2 })}
          </div>
        </div>

        {/* Aviso de região após digitar UF */}
        {regionBlocked && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No momento, atendemos apenas o Distrito Federal (DF).
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={isLoading || regionBlocked || !hasAddress}
            className="flex-1 gap-2"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
            ) : (
              <><Check className="h-4 w-4" />Salvar e Confirmar</>
            )}
          </Button>
          {originalAddress && (
            <Button variant="outline" onClick={handleCancelEdit} disabled={isLoading}>
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
