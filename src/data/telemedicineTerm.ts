// Termo de Consentimento Livre e Esclarecido — Telemedicina (CARD-03).
//
// IMPORTANTE: este texto é um rascunho técnico e DEVE ser revisado/aprovado
// pelo jurídico antes de produção. Ao alterar o texto, incremente `version` —
// o aceite registra versão + hash SHA-256 do texto vigente.

export const TELEMED_TERM = {
  id: 'telemed-consent',
  version: '2026-06-10.v1',
  title: 'Termo de Consentimento Livre e Esclarecido — Telemedicina',
  text: `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO PARA ATENDIMENTO POR TELEMEDICINA

1. Declaro que aceito, de forma livre e esclarecida, ser atendido(a) por médico na modalidade de telemedicina (consulta por vídeo), nos termos da Resolução CFM nº 2.314/2022.

2. Compreendo que a teleconsulta possui características e limitações próprias: o médico não realizará exame físico presencial e, a seu critério, poderá solicitar atendimento presencial ou exames complementares quando entender necessário.

3. Estou ciente de que devo fornecer informações verdadeiras sobre minha saúde, e que as informações que eu enviar antes da consulta (sintomas, medicamentos em uso e arquivos de exames) serão disponibilizadas ao médico responsável pelo atendimento.

4. Meus dados de saúde são tratados como dados pessoais sensíveis, nos termos da Lei nº 13.709/2018 (LGPD), com base legal na tutela da saúde (art. 11, II, "f"), e utilizados exclusivamente para: realização do atendimento, emissão de documentos médicos (receita, atestado, pedidos de exame), registro em prontuário e obrigações legais/regulatórias.

5. A videochamada NÃO é gravada. O registro do atendimento (anamnese e documentos emitidos) é mantido em prontuário eletrônico pelo prazo legal aplicável.

6. Os documentos emitidos ficarão disponíveis na minha área logada após a consulta. A receita poderá ser compartilhada com farmácia somente mediante minha ação.

7. Posso interromper a consulta a qualquer momento. Em caso de falha técnica (queda de conexão), o atendimento poderá ser retomado ou reagendado sem prejuízo.

8. Posso exercer meus direitos de titular (acesso, correção, eliminação nos limites legais, informação sobre compartilhamento) pelos canais de suporte da plataforma.

9. Este consentimento vale para a presente teleconsulta e poderá ser revogado para atendimentos futuros, sem efeito retroativo sobre tratamentos já realizados.

10. Em situação de emergência, devo procurar imediatamente um serviço de urgência presencial (SAMU 192) — a teleconsulta não substitui atendimento de emergência.`,
} as const;

/** SHA-256 (hex) do texto vigente do termo — gravado junto do aceite. */
export async function telemedTermHash(): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(TELEMED_TERM.text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null; // crypto.subtle indisponível (contexto não-seguro) — aceite segue sem hash
  }
}
