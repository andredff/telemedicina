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
  prescriptionId: string;
  quantity: number;
}
