export interface MedicationCatalog {
  id: string;
  name: string;
  active_ingredient: string | null;
  category: string | null;
  dosage: string | null;
  manufacturer: string | null;
  price: number;
  stock: number;
  pharmacy_id: string | null;
  pharmacy_name?: string;       // joined from pharmacies
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

/** Row used in Excel import preview */
export interface MedicationImportRow {
  /** Line number in the spreadsheet (1-based) */
  row: number;
  name: string;
  active_ingredient: string;
  category: string;
  dosage: string;
  manufacturer: string;
  price: number;
  stock: number;
  pharmacy_name: string;
  /** Errors found during validation */
  errors: string[];
}
