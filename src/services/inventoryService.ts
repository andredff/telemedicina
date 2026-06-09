import { supabase } from '@/integrations/supabase/client';
import { MedicationCatalog, PharmacyFull } from '@/types/inventory';

// ── Pharmacies ─────────────────────────────────────────────────────────────

export async function getPharmacies(): Promise<PharmacyFull[]> {
  const { data, error } = await supabase
    .from('pharmacies')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as PharmacyFull[];
}

export async function getActivePharmacies(): Promise<PharmacyFull[]> {
  const { data, error } = await supabase
    .from('pharmacies')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return (data ?? []) as PharmacyFull[];
}

// ── Medication catalog ──────────────────────────────────────────────────────

export async function getMedicationCatalog(filters?: {
  pharmacyId?: string;
  category?: string;
  search?: string;
  inStockOnly?: boolean;
  limit?: number;
}): Promise<MedicationCatalog[]> {
  let query = supabase
    .from('medication_catalog')
    .select('*, pharmacies(name)')
    .order('name');

  if (filters?.pharmacyId) {
    query = query.eq('pharmacy_id', filters.pharmacyId);
  }
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.inStockOnly) {
    query = query.gt('stock', 0);
  }
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as (MedicationCatalog & { pharmacies: { name: string } | null })[]).map(
    (row) => ({
      ...row,
      pharmacy_name: row.pharmacies?.name ?? undefined,
    })
  );
}

export async function upsertMedication(
  payload: Omit<MedicationCatalog, 'id' | 'created_at' | 'updated_at' | 'pharmacy_name'>
): Promise<void> {
  const { error } = await supabase.from('medication_catalog').insert(payload);
  if (error) throw error;
}

export async function updateMedication(
  id: string,
  payload: Partial<Omit<MedicationCatalog, 'id' | 'created_at' | 'updated_at' | 'pharmacy_name'>>
): Promise<void> {
  const { error } = await supabase
    .from('medication_catalog')
    .update(payload)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteMedication(id: string): Promise<void> {
  const { error } = await supabase.from('medication_catalog').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAllMedications(): Promise<void> {
  const { error } = await supabase.from('medication_catalog').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw error;
}

/**
 * Upsert medications in bulk. Deduplicates by (name, dosage):
 * if a row with the same name+dosage already exists it is updated,
 * otherwise a new row is inserted.
 */
export async function bulkUpsertMedications(
  rows: Omit<MedicationCatalog, 'id' | 'created_at' | 'updated_at' | 'pharmacy_name'>[]
): Promise<void> {
  const { error } = await supabase
    .from('medication_catalog')
    .upsert(rows, { onConflict: 'name,dosage', ignoreDuplicates: false });
  if (error) throw error;
}

/** @deprecated use bulkUpsertMedications */
export async function bulkInsertMedications(
  rows: Omit<MedicationCatalog, 'id' | 'created_at' | 'updated_at' | 'pharmacy_name'>[]
): Promise<void> {
  return bulkUpsertMedications(rows);
}

export async function getMedicationCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('medication_catalog')
    .select('category')
    .not('category', 'is', null);
  if (error) throw error;
  const cats = [...new Set((data ?? []).map((r: { category: string | null }) => r.category).filter(Boolean))] as string[];
  return cats.sort();
}
