import { useState, useEffect } from 'react';
import { SearchClient, type PrescriptionSearchParams, type PrescriptionSearchResults } from '@/integrations/supabase/searchClient';
import { MockSearchClient } from '@/mock-search-client';

export function usePrescriptionSearch(initialParams: PrescriptionSearchParams = {}) {
  const [searchParams, setSearchParams] = useState<PrescriptionSearchParams>(initialParams);
  const [searchResults, setSearchResults] = useState<PrescriptionSearchResults>({
    data: [],
    count: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const performSearch = async (params: PrescriptionSearchParams) => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to use the real SearchClient first
      if (SearchClient && typeof SearchClient.searchPrescriptions === 'function') {
        const results = await SearchClient.searchPrescriptions(params);
        setSearchResults(results);
      } else {
        // Fallback to mock client if real SearchClient is not available
        console.warn('SearchClient not available, using mock data');
        const results = await MockSearchClient.searchPrescriptions(params);
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Search error:', err);
      // Fallback to mock client if there's an error with the real SearchClient
      try {
        const results = await MockSearchClient.searchPrescriptions(params);
        setSearchResults(results);
      } catch (mockErr) {
        setError(mockErr instanceof Error ? mockErr.message : 'Unknown error occurred');
        setSearchResults({
          data: [],
          count: 0,
          page: 1,
          pageSize: params.pageSize || 10,
          totalPages: 0
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = setTimeout(() => {
      performSearch(searchParams);
    }, 500);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchParams, debounceTimer]);

  const getSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      // Try to use the real SearchClient first
      if (SearchClient && typeof SearchClient.getSearchSuggestions === 'function') {
        const suggestions = await SearchClient.getSearchSuggestions(query);
        setSuggestions(suggestions);
      } else {
        // Fallback to mock client if real SearchClient is not available
        console.warn('SearchClient not available for suggestions, using mock data');
        const suggestions = await MockSearchClient.getSearchSuggestions(query);
        setSuggestions(suggestions);
      }
    } catch (err) {
      console.error('Error getting suggestions:', err);
      // Fallback to mock client if there's an error with the real SearchClient
      try {
        const suggestions = await MockSearchClient.getSearchSuggestions(query);
        setSuggestions(suggestions);
      } catch (mockErr) {
        console.error('Mock suggestions error:', mockErr);
        setSuggestions([]);
      }
    }
  };

  const updateSearchParams = (newParams: Partial<PrescriptionSearchParams>) => {
    setSearchParams(prev => ({ ...prev, ...newParams, page: 1 }));
  };

  const goToPage = (page: number) => {
    setSearchParams(prev => ({ ...prev, page }));
  };

  const resetSearch = () => {
    setSearchParams(initialParams);
  };

  const adminSearch = async (params: PrescriptionSearchParams = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const results = await SearchClient.adminSearch(params);
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setSearchResults({
        data: [],
        count: 0,
        page: 1,
        pageSize: params.pageSize || 10,
        totalPages: 0
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    searchParams,
    searchResults,
    loading,
    error,
    suggestions,
    updateSearchParams,
    goToPage,
    resetSearch,
    getSuggestions,
    adminSearch,
    performSearch
  };
}

export function useRecentPrescriptions(limit: number = 5) {
  const [recentPrescriptions, setRecentPrescriptions] = useState<PrescriptionWithMedications[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentPrescriptions = async () => {
      try {
        const prescriptions = await SearchClient.getRecentPrescriptions(limit);
        setRecentPrescriptions(prescriptions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentPrescriptions();
  }, [limit]);

  return { recentPrescriptions, loading, error };
}

export function usePrescriptionById(prescriptionId: string | null) {
  const [prescription, setPrescription] = useState<PrescriptionWithMedications | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prescriptionId) {
      setPrescription(null);
      setLoading(false);
      return;
    }

    const fetchPrescription = async () => {
      try {
        const result = await SearchClient.getPrescriptionById(prescriptionId);
        setPrescription(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPrescription();
  }, [prescriptionId]);

  return { prescription, loading, error };
}
