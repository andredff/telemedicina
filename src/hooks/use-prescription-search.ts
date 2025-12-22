import { useState, useEffect } from 'react';
import { SearchClient, type PrescriptionSearchParams, type PrescriptionSearchResults } from '@/integrations/supabase/searchClient';

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
      const results = await SearchClient.searchPrescriptions(params);
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
  }, [searchParams]);

  const getSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const suggestions = await SearchClient.getSearchSuggestions(query);
      setSuggestions(suggestions);
    } catch (err) {
      console.error('Error getting suggestions:', err);
      setSuggestions([]);
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
  const [recentPrescriptions, setRecentPrescriptions] = useState<any[]>([]);
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
  const [prescription, setPrescription] = useState<any | null>(null);
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
