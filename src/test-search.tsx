// Mock the Supabase client directly
import { mockPrescriptions } from './data/mockPrescriptions';

// Import the PrescriptionSearchService class directly
import { PrescriptionSearchService } from './integrations/supabase/searchClient';

// Create a mock SearchClient
const mockSearchClient = new PrescriptionSearchService();

console.log('mockSearchClient:', mockSearchClient);
console.log('searchPrescriptions method:', mockSearchClient.searchPrescriptions);

// Test the searchPrescriptions method
mockSearchClient.searchPrescriptions({ query: 'test' })
  .then(results => {
    console.log('Search results:', results);
  })
  .catch(error => {
    console.error('Error:', error);
  });