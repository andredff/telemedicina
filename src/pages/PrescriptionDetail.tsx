import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { CartItem } from "@/types/prescription";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, FileText, User, Calendar, AlertCircle, Store, Truck, Star, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { usePrescriptionById } from "@/hooks/use-prescription-search";

type PharmacyOption = {
  id: string;
  name: string;
  logo_url: string | null;
  is_premium: boolean;
  delivery_days: number;
  total: number;
  matchedCount: number;
};

const PrescriptionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addItems: addCartItems } = useCart();
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState<'select' | 'pharmacy'>('select');
  const [pharmacyOptions, setPharmacyOptions] = useState<PharmacyOption[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacyOption | null>(null);
  const [allPrices, setAllPrices] = useState<{ pharmacy_id: string; medication_name: string; price: number }[]>([]);

  const { prescription, loading: prescriptionLoading, error: prescriptionError } = usePrescriptionById(id);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading || prescriptionLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (prescriptionError || !prescription || !prescription.medications || prescription.medications.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAuthenticated onLogout={handleLogout} />
        <div className="container mx-auto px-4 py-8">
          <BackLink to="/prescriptions" label="Receituários" />
          <div className="text-center">
            <p className="text-muted-foreground">
              {prescriptionError ? `Erro: ${prescriptionError}` :
               !prescription ? "Receituário não encontrado" :
               "Receituário sem medicamentos"}
            </p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Voltar ao dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSelectAll = () => {
    if (selectedMeds.size === prescription.medications.length) {
      setSelectedMeds(new Set());
    } else {
      setSelectedMeds(new Set(prescription.medications.map((m) => m.id)));
    }
  };

  const toggleMedication = (medId: string) => {
    const newSelected = new Set(selectedMeds);
    if (newSelected.has(medId)) {
      newSelected.delete(medId);
    } else {
      newSelected.add(medId);
    }
    setSelectedMeds(newSelected);
  };

  const calculateTotal = () => {
    return prescription.medications
      .filter((med) => selectedMeds.has(med.id))
      .reduce((sum, med) => sum + med.price, 0);
  };

  const handleComparePharmacies = async () => {
    if (selectedMeds.size === 0) {
      toast({
        title: "Nenhum medicamento selecionado",
        description: "Selecione ao menos um medicamento para continuar",
        variant: "destructive",
      });
      return;
    }

    setLoadingPharmacies(true);
    setStep('pharmacy');

    const selectedNames = prescription.medications
      .filter((m) => selectedMeds.has(m.id))
      .map((m) => m.name.toLowerCase());

    // Load active pharmacies and their prices
    const { data: pharmacies } = await supabase
      .from('pharmacies')
      .select('id, name, logo_url, is_premium')
      .eq('active', true)
      .order('is_premium', { ascending: false });

    const { data: allPricesData } = await supabase
      .from('pharmacy_prices')
      .select('pharmacy_id, medication_name, price, delivery_days, in_stock')
      .eq('in_stock', true);

    const allPrices = allPricesData ?? [];
    setAllPrices(allPrices);

    const options: PharmacyOption[] = (pharmacies ?? []).map((ph) => {
      const phPrices = allPrices.filter(
        (p) =>
          p.pharmacy_id === ph.id &&
          selectedNames.some((name) =>
            p.medication_name.toLowerCase().includes(name) ||
            name.includes(p.medication_name.toLowerCase())
          )
      );

      const total = phPrices.reduce((sum, p) => sum + Number(p.price), 0);
      const maxDelivery = phPrices.length > 0
        ? Math.max(...phPrices.map((p) => p.delivery_days))
        : 5;

      return {
        id: ph.id,
        name: ph.name,
        logo_url: ph.logo_url,
        is_premium: ph.is_premium,
        delivery_days: maxDelivery,
        total,
        matchedCount: phPrices.length,
      };
    });

    // Sort: premium first, then by matched count desc, then by price asc
    options.sort((a, b) => {
      if (a.is_premium !== b.is_premium) return a.is_premium ? -1 : 1;
      if (b.matchedCount !== a.matchedCount) return b.matchedCount - a.matchedCount;
      return a.total - b.total;
    });

    setPharmacyOptions(options);
    setLoadingPharmacies(false);
  };

  const handleAddToCart = () => {
    const cartItems: CartItem[] = prescription.medications
      .filter((med) => selectedMeds.has(med.id))
      .map((med) => {
        // Usa o preço da farmácia escolhida, se disponível
        const pharmacyPrice = selectedPharmacy
          ? allPrices.find(
              (p) =>
                p.pharmacy_id === selectedPharmacy.id &&
                (p.medication_name.toLowerCase().includes(med.name.toLowerCase()) ||
                  med.name.toLowerCase().includes(p.medication_name.toLowerCase()))
            )
          : null;

        return {
          id: med.id,
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          price: pharmacyPrice ? Number(pharmacyPrice.price) : med.price,
          inStock: med.in_stock,
          imageUrl: med.image_url,
          cartItemId: `${prescription.id}-${med.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          prescriptionId: prescription.id,
          quantity: 1,
          pharmacyId: selectedPharmacy?.id,
          pharmacyName: selectedPharmacy?.name,
        };
      });

    addCartItems(cartItems);

    toast({
      title: "Medicamentos adicionados!",
      description: `${cartItems.length} ${cartItems.length === 1 ? "item adicionado" : "itens adicionados"} ao carrinho${selectedPharmacy ? ` via ${selectedPharmacy.name}` : ''}`,
    });

    navigate("/cart");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={handleLogout} />

      <main className="page-container">
        <BackLink />

        {step === 'select' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl font-heading">{prescription.id}</CardTitle>
                  </div>
                  <CardDescription className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{prescription.patient_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(prescription.date).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Médico responsável</p>
                    <p className="font-semibold">{prescription.doctor_name}</p>
                    <p className="text-sm text-muted-foreground">{prescription.doctor_crm}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-heading">Medicamentos Prescritos</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      {selectedMeds.size === prescription.medications.length
                        ? "Desmarcar todos"
                        : "Selecionar todos"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {prescription.medications.map((medication) => (
                    <div
                      key={medication.id}
                      className="flex items-start gap-4 p-4 border border-border/50 rounded-xl hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedMeds.has(medication.id)}
                        onCheckedChange={() => toggleMedication(medication.id)}
                        disabled={!medication.in_stock}
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-foreground">{medication.name}</h3>
                            <p className="text-sm text-muted-foreground">{medication.dosage}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-heading font-bold text-primary text-lg">
                              R$ {medication.price.toFixed(2)}
                            </p>
                            {medication.in_stock ? (
                              <Badge variant="outline" className="text-accent border-accent">
                                Em estoque
                              </Badge>
                            ) : (
                              <Badge variant="destructive">Indisponível</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm space-y-1">
                          <p><span className="font-medium">Posologia:</span> {medication.frequency}</p>
                          <p><span className="font-medium">Duração:</span> {medication.duration}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-20 border-border/50 shadow-card">
                <CardHeader>
                  <CardTitle className="font-heading">Resumo do Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Itens selecionados:</span>
                      <span className="font-semibold">{selectedMeds.size}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total de medicamentos:</span>
                      <span className="font-semibold">{prescription.medications.length}</span>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold">Total:</span>
                      <span className="text-2xl font-heading font-bold text-primary">
                        R$ {calculateTotal().toFixed(2)}
                      </span>
                    </div>

                    {selectedMeds.size === 0 && (
                      <Alert className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Selecione os medicamentos que deseja comprar
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      className="w-full gap-2 gradient-hero text-primary-foreground"
                      onClick={handleComparePharmacies}
                      disabled={selectedMeds.size === 0}
                    >
                      <Store className="h-4 w-4" />
                      Comparar Farmácias
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'pharmacy' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('select')}
                className="gap-1"
              >
                ← Voltar
              </Button>
              <div>
                <h2 className="text-xl font-bold font-heading">Escolha a Farmácia</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedMeds.size} medicamento{selectedMeds.size !== 1 ? 's' : ''} selecionado{selectedMeds.size !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {loadingPharmacies ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            ) : pharmacyOptions.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center">
                  <Store className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-semibold mb-1">Nenhuma farmácia parceira disponível</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Sem farmácias cadastradas no marketplace por enquanto.
                  </p>
                  <Button onClick={handleAddToCart} className="gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Adicionar sem farmácia parceira
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-3">
                  {pharmacyOptions.map((ph) => (
                    <Card
                      key={ph.id}
                      className={`border-2 cursor-pointer transition-all ${
                        selectedPharmacy?.id === ph.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border/50 hover:border-primary/40'
                      }`}
                      onClick={() => setSelectedPharmacy(ph)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex-shrink-0">
                          {ph.logo_url ? (
                            <img
                              src={ph.logo_url}
                              alt={ph.name}
                              className="h-12 w-12 rounded-lg object-contain border border-border/30"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Store className="h-6 w-6 text-primary" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{ph.name}</p>
                            {ph.is_premium && (
                              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 flex items-center gap-1">
                                <Star className="h-3 w-3" />
                                Premium
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              Entrega em {ph.delivery_days} dias
                            </span>
                            {ph.matchedCount > 0 && (
                              <span>
                                {ph.matchedCount}/{selectedMeds.size} item{selectedMeds.size !== 1 ? 'ns' : ''} disponíve{selectedMeds.size !== 1 ? 'is' : 'l'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {ph.total > 0 ? (
                            <p className="text-xl font-bold text-primary font-heading">
                              R$ {ph.total.toFixed(2)}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Consultar preço</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button
                  className="w-full gap-2 gradient-hero text-primary-foreground"
                  onClick={handleAddToCart}
                  disabled={!selectedPharmacy}
                >
                  <ShoppingCart className="h-4 w-4" />
                  {selectedPharmacy
                    ? `Comprar na ${selectedPharmacy.name}`
                    : 'Selecione uma farmácia'}
                </Button>

                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={handleAddToCart}
                >
                  Continuar sem farmácia parceira
                </Button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default PrescriptionDetail;
