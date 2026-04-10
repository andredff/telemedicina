export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  price: number;
  inStock: boolean;
  imageUrl?: string;
}

export interface Prescription {
  id: string;
  patientName: string;
  doctorName: string;
  doctorCRM: string;
  date: string;
  medications: Medication[];
  status: "pending" | "partial" | "completed";
}

export interface CartItem extends Medication {
  cartItemId: string;
  prescriptionId: string;
  quantity: number;
  pharmacyId?: string;
  pharmacyName?: string;
}

/** Item de catálogo adicionado via receita (sem FK em medications) */
export interface CatalogCartItem {
  cartItemId: string;  // medicamentoId do catálogo
  name: string;
  dosage: string;
  price: number;
  quantity: number;
  maxQuantity?: number;  // limite prescrito na receita
  principioAtivo?: string;
  receitaId?: string;      // consultationId da receita de origem (para rastreabilidade)
  receitaUrlPdf?: string;  // URL do PDF da receita
}
