/**
 * Validação de região para entrega de medicamentos.
 * Permite apenas CEPs do Distrito Federal e Entorno (GO/MG limítrofes ao DF).
 *
 * Faixas de CEP:
 * - DF:      70000-000 a 73699-999  (700xx – 736xx)
 * - Entorno: 72780-000 a 73799-999  (vários municípios GO/MG limítrofes)
 *   Incluímos os municípios principais do Entorno do DF:
 *   Águas Lindas de Goiás, Alexânia, Cidade Ocidental, Cocalzinho, Cristalina,
 *   Formosa, Luziânia, Novo Gama, Padre Bernardo, Planaltina de Goiás,
 *   Santo Antônio do Descoberto, Valparaíso de Goiás, Unaí (MG), etc.
 *
 * Referência: IBGE / Correios (faixas aprovadas pela RIDE-DF)
 */

/**
 * Prefixos (3 dígitos) de CEP liberados para entrega.
 * Cobre o DF completo + municípios do Entorno (RIDE-DF) aprovados.
 */
const ALLOWED_PREFIXES_3: number[] = [
  // Distrito Federal (700–736)
  700, 701, 702, 703, 704, 705, 706, 707, 708, 709,
  710, 711, 712, 713, 714, 715, 716, 717, 718, 719,
  720, 721, 722, 723, 724, 725, 726, 727, 728, 729,
  730, 731, 732, 733, 734, 735, 736,
  // Entorno do DF (GO / MG limítrofes)
  // Luziânia, Novo Gama, Valparaíso, Cidade Ocidental
  727, 728, 729,
  // Águas Lindas, Santo Antônio do Descoberto
  726, 725,
  // Formosa, Planaltina de Goiás, Padre Bernardo
  737, 738,
  // Cristalina, Alexânia, Cocalzinho
  754, 755,
  // Unaí (MG)
  383,
];

const ALLOWED_SET = new Set(ALLOWED_PREFIXES_3);

/**
 * Verifica se um CEP pertence à região de entrega (DF e Entorno).
 * @param cep CEP com ou sem hífen
 * @returns true se elegível para entrega
 */
export function isCepInDeliveryRegion(cep: string): boolean {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return false;
  const prefix3 = parseInt(digits.slice(0, 3), 10);
  return ALLOWED_SET.has(prefix3);
}

/**
 * Retorna o nome da região baseado no CEP, para exibição amigável.
 */
export function getRegionLabel(cep: string): string {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return "Região desconhecida";
  const prefix3 = parseInt(digits.slice(0, 3), 10);

  if (prefix3 >= 700 && prefix3 <= 736) return "Distrito Federal";
  if ([725, 726, 727, 728, 729, 737, 738].includes(prefix3)) return "Entorno do DF (Goiás)";
  if (prefix3 === 383) return "Entorno do DF (Minas Gerais)";
  if ([754, 755].includes(prefix3)) return "Entorno do DF (Goiás)";
  return "Fora da área de entrega";
}
