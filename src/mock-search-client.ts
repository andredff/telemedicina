import { mockPrescriptions } from './data/mockPrescriptions';

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

export class MockPrescriptionSearchService {
  
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

    // Convert mock data to the expected format
    const mockData = mockPrescriptions.map(prescription => ({
      id: prescription.code,
      patient_name: prescription.patientName,
      doctor_name: prescription.doctorName,
      doctor_crm: prescription.doctorCRM,
      date: prescription.issueDate,
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
        image_url: med.imageUrl
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

  static async getSearchSuggestions(query: string): Promise<string[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const suggestions = new Set<string>();

    // Add ID suggestions
    mockPrescriptions.forEach(p => {
      if (p.code.toLowerCase().includes(lowerQuery)) {
        suggestions.add(p.code);
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

  static async getRecentPrescriptions(limit: number = 5): Promise<PrescriptionWithMedications[]> {
    const mockData = mockPrescriptions.map(prescription => ({
      id: prescription.code,
      patient_name: prescription.patientName,
      doctor_name: prescription.doctorName,
      doctor_crm: prescription.doctorCRM,
      date: prescription.issueDate,
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
        image_url: med.imageUrl
      }))
    }));

    return mockData.slice(0, limit);
  }

  static async getPrescriptionById(prescriptionId: string): Promise<PrescriptionWithMedications | null> {
    const prescription = mockPrescriptions.find(p => p.code === prescriptionId);
    
    if (!prescription) {
      return null;
    }

    return {
      id: prescription.code,
      patient_name: prescription.patientName,
      doctor_name: prescription.doctorName,
      doctor_crm: prescription.doctorCRM,
      date: prescription.issueDate,
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
        image_url: med.imageUrl
      }))
    };
  }

  static async adminSearch(
    params: PrescriptionSearchParams = {}
  ): Promise<PrescriptionSearchResults> {
    return this.searchPrescriptions(params);
  }
}

export const MockSearchClient = new MockPrescriptionSearchService();