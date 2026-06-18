// Seam de assinatura digital de documentos médicos.
//
// Hoje roda em modo STUB (assinatura simulada) — gera um hash SHA-256 do PDF e um
// identificador de transação, sem validade jurídica. A interface já está pronta
// para plugar o Bird ID (Soluti / ICP-Brasil) em produção.
//
// IMPORTANTE: a assinatura em nuvem real do Bird ID (PSC/PAdES) é server-side
// (OAuth + certificado do médico). Quando as credenciais existirem, `signWithBirdId`
// deve chamar um endpoint de backend (ex.: rota no server/cielo-server.js, análogo
// ao proxy da Cielo) que conversa com a API do Bird ID. NÃO embutir segredos no front.

export type SignatureProvider = 'stub' | 'bird_id';

export interface SignPrescriptionInput {
  /** Bytes do PDF (não assinado) que será assinado. */
  pdfBytes: Uint8Array;
  consultationId: string;
  doctor: { name: string; crm: string };
}

export interface SignatureResult {
  provider: SignatureProvider;
  /** Id da transação de assinatura (Bird ID) ou STUB-* no modo simulado. */
  signatureId: string;
  /** SHA-256 (hex) do documento assinado. */
  hash: string;
  signedAt: string; // ISO
}

/** Provider ativo. Em produção, habilitar com VITE_BIRDID_ENABLED=true. */
function activeProvider(): SignatureProvider {
  const enabled = String(import.meta.env.VITE_BIRDID_ENABLED ?? '').toLowerCase() === 'true';
  return enabled ? 'bird_id' : 'stub';
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Bird ID real — TODO. Deve fazer POST para um endpoint de backend que executa o
 * fluxo OAuth + assinatura em nuvem (PAdES) e devolve o id da transação. Enquanto
 * não houver credenciais/endpoint, lança erro claro para o chamador tratar.
 */
async function signWithBirdId(_input: SignPrescriptionInput, _hash: string): Promise<SignatureResult> {
  // Exemplo do contrato esperado quando o backend existir:
  //   const res = await fetch(`${import.meta.env.VITE_LOCAL_SERVER_URL}/api/sign/birdid`, {
  //     method: 'POST', headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ consultationId, pdfBase64, doctor }),
  //   });
  //   const { signatureId, signedAt } = await res.json();
  //   return { provider: 'bird_id', signatureId, hash, signedAt };
  throw new Error('Integração com Bird ID ainda não configurada neste ambiente.');
}

/** Assina o PDF da receita. Retorna os metadados da assinatura. */
export async function signPrescription(input: SignPrescriptionInput): Promise<SignatureResult> {
  const hash = await sha256Hex(input.pdfBytes);

  if (activeProvider() === 'bird_id') {
    return signWithBirdId(input, hash);
  }

  // Modo simulação (stub): sem validade jurídica.
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    provider: 'stub',
    signatureId: `STUB-${Date.now()}-${rand}`,
    hash,
    signedAt: new Date().toISOString(),
  };
}

/**
 * Alias genérico do mesmo seam de assinatura — assina os bytes de QUALQUER PDF
 * de documento médico (pedido de exame, atestado, etc.). Mesmo fluxo da receita.
 */
export type SignDocumentInput = SignPrescriptionInput;
export const signDocument = signPrescription;
