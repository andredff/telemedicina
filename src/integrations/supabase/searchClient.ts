import { supabase } from './client';
import { supabaseAdmin } from './adminClient';

export interface PrescriptionSearchParams {
  query?: string;
  patientName?: string;
  doctorName?: string;
  status?: string[];
  dateFrom?: string;
  dateTo?: string;
  medicationName?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PrescriptionWithMedications {
  id: string;
  patient_name: string;
  doctor_name: string;
  doctor_crm: string;
  date: string;
  status: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  medications?: Array<{
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    price: number;
    in_stock: boolean;
    image_url: string | null;
  }>;
}

export interface PrescriptionSearchResults {
  data: PrescriptionWithMedications[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class PrescriptionSearchService {

  static async searchPrescriptions(
    params: PrescriptionSearchParams = {}
  ): Promise<PrescriptionSearchResults> {
    const {
      query = '',
      patientName = '',
      doctorName = '',
      status = [],
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 10,
      sortBy = 'date',
      sortOrder = 'desc'
    } = params;

    try {
      let baseQuery = supabase
        .from('prescriptions')
        .select('*, medications(*)', { count: 'exact' });

      if (query) {
        baseQuery = baseQuery.or(
          `id.ilike.%${query}%,patient_name.ilike.%${query}%,doctor_name.ilike.%${query}%`
        );
      }

      if (patientName) {
        baseQuery = baseQuery.ilike('patient_name', `%${patientName}%`);
      }

      if (doctorName) {
        baseQuery = baseQuery.ilike('doctor_name', `%${doctorName}%`);
      }

      if (status && status.length > 0) {
        baseQuery = baseQuery.in('status', status);
      }

      if (dateFrom) {
        baseQuery = baseQuery.gte('date', dateFrom);
      }

      if (dateTo) {
        baseQuery = baseQuery.lte('date', dateTo);
      }

      baseQuery = baseQuery.order(sortBy, { ascending: sortOrder === 'asc' });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      baseQuery = baseQuery.range(from, to);

      const { data, error, count } = await baseQuery;

      if (error) {
        throw error;
      }

      return {
        data: data || [],
        count: count || 0,
        page,
        pageSize,
        totalPages: count ? Math.ceil(count / pageSize) : 0
      };

    } catch (error) {
      console.error('Error searching prescriptions:', error);
      return {
        data: [],
        count: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0
      };
    }
  }

  static async getPrescriptionById(prescriptionId: string): Promise<PrescriptionWithMedications | null> {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, medications(*)')
        .eq('id', prescriptionId)
        .single();

      if (error) {
        throw error;
      }

      return data || null;

    } catch (error) {
      console.error('[SearchClient] Error getting prescription by ID:', error);
      return null;
    }
  }

  static async getPrescriptionByConsultationId(consultationId: string): Promise<PrescriptionWithMedications | null> {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, medications(*)')
        .eq('consultation_id', consultationId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data || null;

    } catch (error) {
      console.error('[SearchClient] Error getting prescription by consultation ID:', error);
      return null;
    }
  }

  static async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      const { data: idSuggestions } = await supabase
        .from('prescriptions')
        .select('id')
        .ilike('id', `%${query}%`)
        .limit(5);

      const { data: patientSuggestions } = await supabase
        .from('prescriptions')
        .select('patient_name')
        .ilike('patient_name', `%${query}%`)
        .limit(5);

      const { data: doctorSuggestions } = await supabase
        .from('prescriptions')
        .select('doctor_name')
        .ilike('doctor_name', `%${query}%`)
        .limit(5);

      const suggestions = [
        ...(idSuggestions?.map(s => s.id) || []),
        ...(patientSuggestions?.map(s => s.patient_name) || []),
        ...(doctorSuggestions?.map(s => s.doctor_name) || [])
      ];

      return Array.from(new Set(suggestions)).slice(0, 10);

    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return [];
    }
  }

  static async getRecentPrescriptions(limit: number = 5): Promise<PrescriptionWithMedications[]> {
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, medications(*)')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('Error getting recent prescriptions:', error);
      return [];
    }
  }

  static async adminSearch(
    params: PrescriptionSearchParams = {}
  ): Promise<PrescriptionSearchResults> {
    try {
      let baseQuery = supabaseAdmin
        .from('prescriptions')
        .select('*, medications(*)', { count: 'exact' });

      const {
        query = '',
        patientName = '',
        doctorName = '',
        status = [],
        dateFrom,
        dateTo,
        page = 1,
        pageSize = 10,
        sortBy = 'date',
        sortOrder = 'desc'
      } = params;

      if (query) {
        baseQuery = baseQuery.or(
          `id.ilike.%${query}%,patient_name.ilike.%${query}%,doctor_name.ilike.%${query}%`
        );
      }

      if (patientName) {
        baseQuery = baseQuery.ilike('patient_name', `%${patientName}%`);
      }

      if (doctorName) {
        baseQuery = baseQuery.ilike('doctor_name', `%${doctorName}%`);
      }

      if (status && status.length > 0) {
        baseQuery = baseQuery.in('status', status);
      }

      if (dateFrom) {
        baseQuery = baseQuery.gte('date', dateFrom);
      }

      if (dateTo) {
        baseQuery = baseQuery.lte('date', dateTo);
      }

      baseQuery = baseQuery.order(sortBy, { ascending: sortOrder === 'asc' });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      baseQuery = baseQuery.range(from, to);

      const { data, error, count } = await baseQuery;

      if (error) {
        throw error;
      }

      return {
        data: data || [],
        count: count || 0,
        page,
        pageSize,
        totalPages: count ? Math.ceil(count / pageSize) : 0
      };

    } catch (error) {
      console.error('Error in admin search:', error);
      return {
        data: [],
        count: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0
      };
    }
  }
}

export const SearchClient = PrescriptionSearchService;
