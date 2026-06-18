// Audit/event logging client (CARD-04 — AUDITORIA_TELECONSULTA.md).
//
// Events are written through the `log_event` RPC (SECURITY DEFINER), which
// captures ip_hash/user-agent server-side. Logging is fire-and-forget and
// must NEVER break the UX — failures are swallowed.
//
// PRIVACY RULE: payloads must not contain patient names, CPF, diagnosis,
// anamnese text, chat content, medication names or exam URLs. Reference
// records by id/counts only.

import { supabase } from '@/integrations/supabase/client';

// These RPCs are not in the generated Supabase types yet — narrow cast.
type RpcResult = { data: unknown; error: { message: string } | null };
type RpcFn = (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;
const rpc: RpcFn = (fn, args) =>
  (supabase.rpc as unknown as RpcFn)(fn, args);

// One id per app session (page load) — correlates events of the same visit.
const sessionId: string = (() => {
  try { return crypto.randomUUID(); } catch { return `s-${Date.now()}`; }
})();

function deviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile';
  return 'desktop';
}

function browserLabel(): string {
  const ua = navigator.userAgent;
  const pick = (name: string, token: string) => {
    const m = ua.match(new RegExp(`${token}/([\\d.]+)`));
    return m ? `${name} ${m[1].split('.')[0]}` : null;
  };
  return (
    pick('Edge', 'Edg') ||
    pick('Opera', 'OPR') ||
    pick('Firefox', 'Firefox') ||
    pick('Chrome', 'Chrome') ||
    pick('Safari', 'Version') ||
    'unknown'
  );
}

export interface LogEventOptions {
  consultationId?: string | null;
  status?: 'success' | 'error';
  errorCode?: string;
  payload?: Record<string, unknown>;
}

/** Fire-and-forget audit event. Safe to call anywhere. */
export function logEvent(eventName: string, opts: LogEventOptions = {}): void {
  try {
    const payload = {
      session_id: sessionId,
      device_type: deviceType(),
      browser: browserLabel(),
      ...opts.payload,
    };
    void rpc('log_event', {
      p_event_name: eventName,
      p_consultation_id: opts.consultationId ?? null,
      p_status: opts.status ?? 'success',
      p_error_code: opts.errorCode ?? null,
      p_payload: payload,
    }).then(undefined, () => { /* never break UX for telemetry */ });
  } catch { /* ignore */ }
}

/**
 * Records the patient's informed consent for telemedicine (CARD-03).
 * Returns the consent record id, or null on failure — callers MUST block
 * consultation creation when null (fail-closed compliance gate).
 */
export async function recordConsent(
  termId: string,
  termVersion: string,
  termHash: string | null
): Promise<string | null> {
  try {
    const { data, error } = await rpc('accept_telemedicine_consent', {
      p_term_id: termId,
      p_term_version: termVersion,
      p_term_hash: termHash,
    });
    if (error) return null;
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}
