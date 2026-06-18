// Regra única de validade de assinatura.
//
// `user_subscriptions.expires_at` é gravado no checkout com a HORA da
// contratação somada de N meses (ex.: contratou 12/03 14:30 → vence 12/06 14:30).
// Mas o acesso deve valer o DIA INTEIRO do vencimento — o plano que "termina
// hoje" funciona até hoje 23:59:59.999, não até a hora exata da compra.
//
// Tudo é calculado no fuso local do navegador, o mesmo usado para gerar
// `expires_at`, mantendo a noção de "dia" consistente para o usuário (Brasil).

/** Fim do dia (local) da data de expiração — limite real de validade do plano. */
export function expiryBoundary(expiresAt: string | Date): Date {
  const d = new Date(expiresAt);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** True se o plano ainda é válido no instante `at` (default: agora). */
export function isPlanValid(expiresAt: string | null | undefined, at: Date = new Date()): boolean {
  if (!expiresAt) return true; // sem data de expiração = sem prazo
  return expiryBoundary(expiresAt) >= at;
}

/** True se o plano já passou do fim do dia de expiração. */
export function isPlanExpired(expiresAt: string | null | undefined, at: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return expiryBoundary(expiresAt) < at;
}
