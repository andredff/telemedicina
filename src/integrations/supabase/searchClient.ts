import { supabase } from './client';
import { supabaseAdmin } from './adminClient';
import type { Database } from './types';
import { mockPrescriptions } from '@/data/mockPrescriptions';

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
      medicationName = '',
      page = 1,
      pageSize = 10,
      sortBy = 'date',
      sortOrder = 'desc'
    } = params;

    try {
      // Check if supabase is available (environment variables are set)
      if (!supabase || !supabase.from) {
        return this.fallbackSearch(params);
      }

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
    console.log('[SearchClient] getPrescriptionById called with:', prescriptionId);
    try {
      // Check if supabase is available (environment variables are set)
      if (!supabase || !supabase.from) {
        console.log('[SearchClient] Supabase not available, using fallback');
        return this.fallbackGetPrescriptionById(prescriptionId);
      }

      const { data, error } = await supabase
        .from('prescriptions')
        .select('*, medications(*)')
        .eq('id', prescriptionId)
        .single();

      if (error) {
        console.log('[SearchClient] Supabase error:', error);
        throw error;
      }

      // If no data found in Supabase, try fallback
      if (!data) {
        console.log('[SearchClient] No data from Supabase, using fallback');
        return this.fallbackGetPrescriptionById(prescriptionId);
      }

      console.log('[SearchClient] Found prescription in Supabase:', data);
      return data;

    } catch (error) {
      console.error('[SearchClient] Error getting prescription by ID:', error);
      // Fallback to mock data
      console.log('[SearchClient] Using fallback due to error');
      return this.fallbackGetPrescriptionById(prescriptionId);
    }
  }

  static async getSearchSuggestions(query: string): Promise<string[]> {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      // Check if supabase is available (environment variables are set)
      if (!supabase || !supabase.from) {
        return this.fallbackGetSuggestions(query);
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

  private static fallbackSearch(params: PrescriptionSearchParams): PrescriptionSearchResults {
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

    // Convert mock data to the expected format
    const mockData = mockPrescriptions.map(prescription => ({
      id: prescription.id,
      patient_name: prescription.patientName,
      doctor_name: prescription.doctorName,
      doctor_crm: prescription.doctorCRM,
      date: prescription.date,
      status: prescription.status,
      user_id: 'mock-user-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      medications: prescription.medications.map(med => ({
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        duration: med.duration,
        price: med.price,
        in_stock: med.inStock,
        image_url: med.imageUrl || null
      }))
    }));

    // Apply filters
    let filteredData = [...mockData];

    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredData = filteredData.filter(p =>
        p.id.toLowerCase().includes(lowerQuery) ||
        p.patient_name.toLowerCase().includes(lowerQuery) ||
        p.doctor_name.toLowerCase().includes(lowerQuery)
      );
    }

    if (patientName) {
      const lowerPatientName = patientName.toLowerCase();
      filteredData = filteredData.filter(p =>
        p.patient_name.toLowerCase().includes(lowerPatientName)
      );
    }

    if (doctorName) {
      const lowerDoctorName = doctorName.toLowerCase();
      filteredData = filteredData.filter(p =>
        p.doctor_name.toLowerCase().includes(lowerDoctorName)
      );
    }

    if (status && status.length > 0) {
      filteredData = filteredData.filter(p => status.includes(p.status));
    }

    if (dateFrom) {
      filteredData = filteredData.filter(p => new Date(p.date) >= new Date(dateFrom));
    }

    if (dateTo) {
      filteredData = filteredData.filter(p => new Date(p.date) <= new Date(dateTo));
    }

    // Apply sorting
    filteredData.sort((a, b) => {
      const aValue = a[sortBy as keyof PrescriptionWithMedications];
      const bValue = b[sortBy as keyof PrescriptionWithMedications];
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const startIndex = (page - 1) * pageSize;
    const paginatedData = filteredData.slice(startIndex, startIndex + pageSize);

    return {
      data: paginatedData,
      count: filteredData.length,
      page,
      pageSize,
      totalPages: Math.ceil(filteredData.length / pageSize)
    };
  }

  private static fallbackGetSuggestions(query: string): string[] {
    if (!query || query.length < 2) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const suggestions = new Set<string>();

    // Add ID suggestions
    mockPrescriptions.forEach(p => {
      if (p.id.toLowerCase().includes(lowerQuery)) {
        suggestions.add(p.id);
      }
    });

    // Add patient name suggestions
    mockPrescriptions.forEach(p => {
      if (p.patientName.toLowerCase().includes(lowerQuery)) {
        suggestions.add(p.patientName);
      }
    });

    // Add doctor name suggestions
    mockPrescriptions.forEach(p => {
      if (p.doctorName.toLowerCase().includes(lowerQuery)) {
        suggestions.add(p.doctorName);
      }
    });

    return Array.from(suggestions).slice(0, 10);
  }

  private static fallbackGetPrescriptionById(prescriptionId: string): PrescriptionWithMedications | null {
    console.log('[SearchClient] fallbackGetPrescriptionById called with:', prescriptionId);
    console.log('[SearchClient] Available mock prescriptions:', mockPrescriptions.map(p => p.id));
    
    const mockPrescription = mockPrescriptions.find(p => p.id === prescriptionId);
    
    if (!mockPrescription) {
      console.log('[SearchClient] No mock prescription found for ID:', prescriptionId);
      return null;
    }

    console.log('[SearchClient] Found mock prescription:', mockPrescription);

    const result = {
      id: mockPrescription.id,
      patient_name: mockPrescription.patientName,
      doctor_name: mockPrescription.doctorName,
      doctor_crm: mockPrescription.doctorCRM,
      date: mockPrescription.date,
      status: mockPrescription.status,
      user_id: 'mock-user-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      medications: mockPrescription.medications.map(med => ({
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        duration: med.duration,
        price: med.price,
        in_stock: med.inStock,
        image_url: med.imageUrl || null
      }))
    };

    console.log('[SearchClient] Returning result:', result);
    return result;
  }
}

export const SearchClient = PrescriptionSearchService;
