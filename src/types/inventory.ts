export interface MedicationCatalog {
  id: string;
  external_id: string | null;       // ID externo (coluna "ID" do Excel)
  name: string;
  active_ingredient: string | null;
  category: string | null;
  dosage: string | null;
  form: string | null;              // Forma Farmacêutica
  batch: string | null;             // Lote
  expiry_date: string | null;       // Validade (ISO date)
  stock: number;
  supplier: string | null;          // Fornecedor
  manufacturer: string | null;
  price: number;
  pharmacy_id: string | null;
  pharmacy_name?: string;           // joined from pharmacies
  created_at: string;
  updated_at: string;
}

export interface PharmacyFull {
  id: string;
  name: string;
  razao_social: string | null;
  cnpj: string | null;
  logo_url: string | null;
  is_premium: boolean;
  commission_rate: number;
  monthly_fee: number;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** Row used in Excel import preview (matches the required Excel model) */
export interface MedicationImportRow {
  /** Line number in the spreadsheet (1-based, skipping header) */
  row: number;
  external_id: string;
  name: string;
  active_ingredient: string;
  category: string;
  dosage: string;
  form: string;               // Forma Farmacêutica
  batch: string;              // Lote
  expiry_date: string;        // ISO date string or '' if invalid
  stock: number;
  price: number;              // Preço unitário (R$)
  supplier: string;           // Fornecedor
  /** Validation errors found during parsing */
  errors: string[];
}
