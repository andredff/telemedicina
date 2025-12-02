import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import { mockPrescriptions } from "@/data/mockPrescriptions";
import { CartItem } from "@/types/prescription";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, FileText, User, Calendar, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PrescriptionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedMeds, setSelectedMeds] = useState<Set<string>>(new Set());
  
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
  const prescription = mockPrescriptions.find((p) => p.id === id);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  if (!prescription) {
    return (
      <div className="min-h-screen bg-background">
        <Header isAuthenticated onLogout={() => navigate("/auth")} />
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">Receituário não encontrado</p>
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

  const handleAddToCart = () => {
    if (selectedMeds.size === 0) {
      toast({
        title: "Nenhum medicamento selecionado",
        description: "Selecione ao menos um medicamento para continuar",
        variant: "destructive",
      });
      return;
    }

    const cartItems: CartItem[] = prescription.medications
      .filter((med) => selectedMeds.has(med.id))
      .map((med) => ({
        ...med,
        prescriptionId: prescription.id,
        quantity: 1,
      }));

    const existingCart = JSON.parse(localStorage.getItem("cart") || "[]");
    localStorage.setItem("cart", JSON.stringify([...existingCart, ...cartItems]));

    toast({
      title: "Medicamentos adicionados!",
      description: `${cartItems.length} ${cartItems.length === 1 ? "item adicionado" : "itens adicionados"} ao carrinho`,
    });

    navigate("/cart");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated onLogout={() => navigate("/auth")} />
      
      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          ← Voltar aos receituários
        </Button>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-6 w-6 text-primary" />
                  <CardTitle className="text-2xl">{prescription.id}</CardTitle>
                </div>
                <CardDescription className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{prescription.patientName}</span>
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
                  <p className="font-semibold">{prescription.doctorName}</p>
                  <p className="text-sm text-muted-foreground">{prescription.doctorCRM}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Medicamentos Prescritos</CardTitle>
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
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedMeds.has(medication.id)}
                      onCheckedChange={() => toggleMedication(medication.id)}
                      disabled={!medication.inStock}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{medication.name}</h3>
                          <p className="text-sm text-muted-foreground">{medication.dosage}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary text-lg">
                            R$ {medication.price.toFixed(2)}
                          </p>
                          {medication.inStock ? (
                            <Badge variant="outline" className="text-medical-green border-medical-green">
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
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
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

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-primary">
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
                    className="w-full gap-2"
                    onClick={handleAddToCart}
                    disabled={selectedMeds.size === 0}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Adicionar ao carrinho
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrescriptionDetail;
