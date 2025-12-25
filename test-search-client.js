// Test file to check if SearchClient is working correctly
import { SearchClient } from './src/integrations/supabase/searchClient.js';

console.log('SearchClient:', SearchClient);
console.log('searchPrescriptions method:', SearchClient.searchPrescriptions);

// Test the searchPrescriptions method
SearchClient.searchPrescriptions({ query: 'test' })
  .then(results => {
    console.log('Search results:', results);
  })
  .catch(error => {
    console.error('Error:', error);
  });