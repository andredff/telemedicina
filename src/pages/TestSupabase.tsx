import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SearchClient } from '@/integrations/supabase/searchClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TestSupabase = () => {
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testSupabaseConnection = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Testing Supabase connection...');
      
      // Test 1: Basic connection
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      // Test 2: Prescriptions table
      const { data: prescriptions, error: prescriptionsError } = await supabase
        .from('prescriptions')
        .select('*')
        .limit(5);
      
      // Test 3: Medications table
      const { data: medications, error: medicationsError } = await supabase
        .from('medications')
        .select('*')
        .limit(5);
      
      // Test 4: Profiles table
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .limit(5);
      
      // Test 5: SearchClient
      const searchResults = await SearchClient.searchPrescriptions({ pageSize: 5 });
      const prescriptionById = await SearchClient.getPrescriptionById('RX-2024-001');
      const suggestions = await SearchClient.getSearchSuggestions('RX');
      const recentPrescriptions = await SearchClient.getRecentPrescriptions(3);

      setTestResults({
        auth: { user, error: authError },
        prescriptions: { data: prescriptions, error: prescriptionsError },
        medications: { data: medications, error: medicationsError },
        profiles: { data: profiles, error: profilesError },
        searchClient: {
          searchResults,
          prescriptionById,
          suggestions,
          recentPrescriptions
        }
      });
      
    } catch (err) {
      console.error('Supabase test failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Run test automatically when page loads
    testSupabaseConnection();
  }, []);

  const renderTableData = (data: any[]) => {
    if (!data || data.length === 0) return <p className="text-sm text-muted-foreground">No data found</p>;
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              {Object.keys(data[0]).map((key) => (
                <th key={key} className="px-2 py-1 text-left font-medium">{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 3).map((item, index) => (
              <tr key={index} className="border-b">
                {Object.values(item).map((value, i) => (
                  <td key={i} className="px-2 py-1">{String(value).substring(0, 50)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Supabase Connection Test</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Testing Supabase connection...</p>
          ) : error ? (
            <div className="text-red-500">
              <p>Error: {error}</p>
              <Button onClick={testSupabaseConnection} className="mt-4">Retry Test</Button>
            </div>
          ) : testResults ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Auth Test</h3>
                <p>User: {testResults.auth.user ? 'Authenticated' : 'No user'}</p>
                <p>Error: {testResults.auth.error ? testResults.auth.error.message : 'None'}</p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Prescriptions Table</h3>
                <p>Count: {testResults.prescriptions.data?.length || 0}</p>
                <p>Error: {testResults.prescriptions.error ? testResults.prescriptions.error.message : 'None'}</p>
                {testResults.prescriptions.data && testResults.prescriptions.data.length > 0 && (
                  <div className="mt-2">
                    {renderTableData(testResults.prescriptions.data)}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Medications Table</h3>
                <p>Count: {testResults.medications.data?.length || 0}</p>
                <p>Error: {testResults.medications.error ? testResults.medications.error.message : 'None'}</p>
                {testResults.medications.data && testResults.medications.data.length > 0 && (
                  <div className="mt-2">
                    {renderTableData(testResults.medications.data)}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Profiles Table</h3>
                <p>Count: {testResults.profiles.data?.length || 0}</p>
                <p>Error: {testResults.profiles.error ? testResults.profiles.error.message : 'None'}</p>
                {testResults.profiles.data && testResults.profiles.data.length > 0 && (
                  <div className="mt-2">
                    {renderTableData(testResults.profiles.data)}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">SearchClient Tests</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-medium">Search Prescriptions:</p>
                    <p>Count: {testResults.searchClient.searchResults.count}</p>
                    <p>Data: {testResults.searchClient.searchResults.data.length} items</p>
                  </div>
                  <div>
                    <p className="font-medium">Get Prescription by ID:</p>
                    <p>Result: {testResults.searchClient.prescriptionById ? 'Found' : 'Not found'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Get Suggestions:</p>
                    <p>Count: {testResults.searchClient.suggestions.length}</p>
                  </div>
                  <div>
                    <p className="font-medium">Get Recent Prescriptions:</p>
                    <p>Count: {testResults.searchClient.recentPrescriptions.length}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-semibold mb-2">Analysis:</h4>
                {testResults.prescriptions.data?.length === 0 && (
                  <p className="text-yellow-700">⚠️ Prescriptions table is empty - using mock data</p>
                )}
                {testResults.medications.data?.length === 0 && (
                  <p className="text-yellow-700">⚠️ Medications table is empty - using mock data</p>
                )}
                {testResults.profiles.data?.length === 0 && (
                  <p className="text-yellow-700">⚠️ Profiles table is empty - using mock data</p>
                )}
                {testResults.searchClient.searchResults.data.length > 0 && testResults.prescriptions.data?.length === 0 && (
                  <p className="text-green-700">✅ SearchClient is working with fallback to mock data</p>
                )}
              </div>

              <Button onClick={testSupabaseConnection} className="mt-4">
                Run Test Again
              </Button>
            </div>
          ) : (
            <p>Click the button below to test Supabase connection</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TestSupabase;