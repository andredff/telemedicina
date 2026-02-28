import { useState, useEffect } from "react";
import { MapPin, Edit2, Check, Search, Loader2, ArrowRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { searchCep, isValidCepFormat } from "@/integrations/correios";

// Cidades do entorno de Brasília que são atendidas (GO)
const ENTORNO_BRASILIA_CITIES = [
  "valparaíso de goiás",
  "valparaiso de goias",
  "novo gama",
  "cidade ocidental",
  "luziânia",
  "luziania",
  "águas lindas de goiás",
  "aguas lindas de goias",
  "águas lindas",
  "aguas lindas",
  "planaltina",
  "formosa",
  "santo antônio do descoberto",
  "santo antonio do descoberto",
  "cristalina",
  "alexânia",
  "alexania",
  "padre bernardo",
  "cocalzinho de goiás",
  "cocalzinho de goias",
  "pirenópolis",
  "pirenopolis",
];

// Verifica se o endereço está em área atendida (Brasília/DF ou entorno)
function isServicedArea(state: string, city: string): boolean {
  const normalizedState = state.toLowerCase().trim();
  const normalizedCity = city.toLowerCase().trim();
  
  // DF é sempre atendido
  if (normalizedState === "df") {
    return true;
  }
  
  // GO - apenas cidades do entorno
  if (normalizedState === "go") {
    return ENTORNO_BRASILIA_CITIES.some(
      entornoCity => normalizedCity.includes(entornoCity) || entornoCity.includes(normalizedCity)
    );
  }
  
  return false;
}

interface DeliveryAddressFormProps {
  onAddressConfirm: (address: DeliveryAddress) => void;
  onCancel?: () => void;
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

export function DeliveryAddressForm({
  onAddressConfirm,
  onCancel,
}: DeliveryAddressFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [regionError, setRegionError] = useState<boolean>(false);
  const [address, setAddress] = useState<DeliveryAddress>({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [originalAddress, setOriginalAddress] = useState<DeliveryAddress | null>(null);

  useEffect(() => {
    loadProfileAddress();
  }, []);

  // Validate region when city or state changes
  useEffect(() => {
    if (address.city && address.state) {
      const isServiced = isServicedArea(address.state, address.city);
      setRegionError(!isServiced);
    }
  }, [address.city, address.state]);

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
        const loadedAddress: DeliveryAddress = {
          street: data.address || "",
          number: data.number || "",
          complement: data.complement || "",
          neighborhood: data.neighborhood || "",
          city: data.city || "",
          state: data.state || "",
          zipCode: data.zip_code || "",
        };
        setAddress(loadedAddress);
        setOriginalAddress(loadedAddress);
        
        // Check if region is serviced
        if (loadedAddress.state && loadedAddress.city) {
          const isServiced = isServicedArea(loadedAddress.state, loadedAddress.city);
          setRegionError(!isServiced);
          
          // Auto-confirm address if it has all required fields AND is in serviced area
          if (isServiced && loadedAddress.street && loadedAddress.zipCode) {
            onAddressConfirm(loadedAddress);
          }
        }
      }
    } catch (error) {
      console.error("Error loading profile address:", error);
    }
  };

  const handleInputChange = (field: keyof DeliveryAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    // Clear CEP error when user starts typing
    if (field === "zipCode") {
      setCepError(null);
    }
    // Clear region error when city or state changes
    if (field === "city" || field === "state") {
      setRegionError(false);
    }
  };

  const handleCepSearch = async () => {
    if (!isValidCepFormat(address.zipCode)) {
      setCepError("CEP inválido. Digite os 8 dígitos do CEP.");
      return;
    }

    setIsSearchingCep(true);
    setCepError(null);

    try {
      const result = await searchCep(address.zipCode);

      if (result) {
        setAddress((prev) => ({
          ...prev,
          street: result.street,
          neighborhood: result.neighborhood,
          city: result.city,
          state: result.state,
        }));
        
        // Check if region is serviced
        if (!isServicedArea(result.state, result.city)) {
          setRegionError(true);
        } else {
          setRegionError(false);
        }
      } else {
        setCepError("CEP não encontrado. Por favor, preencha o endereço manualmente.");
      }
    } catch (error) {
      console.error("Error searching CEP:", error);
      setCepError("Erro ao buscar CEP. Por favor, tente novamente.");
    } finally {
      setIsSearchingCep(false);
    }
  };

  const handleSave = async () => {
    // Check region before saving
    if (!isServicedArea(address.state, address.city)) {
      setRegionError(true);
      return;
    }
    
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save to profile
      const { error } = await supabase
        .from("profiles")
        .update({
          address: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          zip_code: address.zipCode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setOriginalAddress(address);
      setIsEditing(false);
      onAddressConfirm(address);
    } catch (error) {
      console.error("Error saving address:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEdit = () => {
    if (originalAddress) {
      setAddress(originalAddress);
    }
    setIsEditing(false);
    setCepError(null);
  };

  const hasAddress = address.street && address.city && address.state && address.zipCode;

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
              <p className="text-muted-foreground">
                {address.neighborhood}
              </p>
              <p className="text-muted-foreground">
                {address.city} - {address.state}, {address.zipCode}
              </p>
              
              {regionError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Região não atendida</AlertTitle>
                  <AlertDescription>
                    No momento, atendemos apenas Brasília (DF) e região do entorno. 
                    Em breve estaremos em outras localidades!
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex gap-3 mt-4 pt-2">
                <Button
                  onClick={() => onAddressConfirm(address)}
                  className="flex-1 gap-2"
                  disabled={regionError}
                >
                  Continuar para Pagamento
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="default"
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
              <p className="text-muted-foreground mb-4">
                Nenhum endereço cadastrado
              </p>
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5" />
          {originalAddress ? "Alterar Endereço" : "Adicionar Endereço"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
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
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCepSearch}
                disabled={isSearchingCep || !isValidCepFormat(address.zipCode)}
                className="gap-1 min-w-[100px]"
              >
                {isSearchingCep ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
            {cepError && (
              <p className="text-sm text-red-500 mt-1">{cepError}</p>
            )}
            {regionError && (
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Região não atendida</AlertTitle>
                <AlertDescription>
                  No momento, atendemos apenas Brasília (DF) e região do entorno. 
                  Em breve estaremos em outras localidades!
                </AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Digite o CEP e clique em buscar para preencher o endereço automaticamente
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="street">Rua/Avenida</Label>
            <Input
              id="street"
              value={address.street}
              onChange={(e) => handleInputChange("street", e.target.value)}
              placeholder="Nome da rua"
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="number">Número</Label>
            <Input
              id="number"
              value={address.number}
              onChange={(e) => handleInputChange("number", e.target.value)}
              placeholder="123"
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="complement">Complemento (opcional)</Label>
            <Input
              id="complement"
              value={address.complement}
              onChange={(e) => handleInputChange("complement", e.target.value)}
              placeholder="Apto, bloco, referência..."
            />
          </div>

          <div className="col-span-2">
            <Label htmlFor="neighborhood">Bairro</Label>
            <Input
              id="neighborhood"
              value={address.neighborhood}
              onChange={(e) => handleInputChange("neighborhood", e.target.value)}
              placeholder="Nome do bairro"
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={address.city}
              onChange={(e) => handleInputChange("city", e.target.value)}
              placeholder="Nome da cidade"
            />
          </div>

          <div className="col-span-2 sm:col-span-1">
            <Label htmlFor="state">Estado</Label>
            <Input
              id="state"
              value={address.state}
              onChange={(e) => handleInputChange("state", e.target.value)}
              placeholder="UF"
              maxLength={2}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={isLoading || !hasAddress || regionError}
            className="flex-1 gap-2"
          >
            <Check className="h-4 w-4" />
            {isLoading ? "Salvando..." : "Salvar e Confirmar"}
          </Button>
          {originalAddress && (
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={isLoading}
            >
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
