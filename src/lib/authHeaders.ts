import { supabase } from "@/integrations/supabase/client";

/**
 * Returns an Authorization header with the current Supabase session token.
 * Used for authenticating requests to the backend (cielo-server.js).
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  return {};
}
