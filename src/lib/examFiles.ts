// Opens patient-uploaded exam files from the PRIVATE `consulta-exames` bucket
// (CARD-02). Access control happens at signing time via storage RLS policies;
// the signed URL is short-lived (1h).

import { supabase } from '@/integrations/supabase/client';
import type { IntakeExam } from '@/lib/consultaDraft';

const SIGNED_URL_TTL_S = 3600;

/**
 * Opens the exam file in a new tab. The window is opened synchronously
 * (before the async signing) to avoid popup blockers.
 */
export async function openExamFile(exam: IntakeExam): Promise<void> {
  const win = window.open('', '_blank');
  try {
    if (exam.path) {
      const { data, error } = await supabase.storage
        .from('consulta-exames')
        .createSignedUrl(exam.path, SIGNED_URL_TTL_S);
      if (error || !data?.signedUrl) throw error ?? new Error('sign failed');
      if (win) win.location.href = data.signedUrl;
      return;
    }
    // Legacy records stored a public URL (now 403 after the bucket went private,
    // but kept as best-effort fallback for environments not yet migrated).
    if (exam.url) {
      if (win) win.location.href = exam.url;
      return;
    }
    win?.close();
  } catch {
    win?.close();
  }
}
