// Dados dos planos conforme Briefing Novità Telemedicina
// Última atualização: Junho/2026
//
// Modelo de cobrança (contrato v3):
//   - Ciclo do plano: ANUAL (compromisso de 12 meses).
//   - Cobrança: recorrente MENSAL, no valor fechado (price_monthly), sem juros.
//   - Não há pré-pagamento anual com desconto. O valor anual é simplesmente
//     12 × price_monthly (price_yearly), usado só como referência do total.

export interface PlanData {
  id: string;
  name: string;
  type: string;
  category: 'individual' | 'coletivo';
  description: string;
  shortDescription: string;
  price_monthly: number;
  price_yearly: number;                // valor fechado anual = 12 × price_monthly (sem desconto)
  specialist_consultations_per_year: number;
  checkups_per_year: number;           // check-ups por ciclo (anual)
  max_dependents: number;
  features: string[];
  highlight?: boolean;
}

// Preços de consultas avulsas — valores fixados na Tabela IV do contrato (v3).
// check_up ainda não é comprável avulso (precisa de fluxo dedicado); o valor
// fica registrado aqui por ser a referência contratual.
export const SINGLE_CONSULTATION_PRICES = {
  clinico_geral: 150.00,
  especialista: 500.00,
  check_up: 250.00,
};

// Benefícios base do Bronze (comum a todos os planos)
const BASE_BRONZE_FEATURES = [
  'Consultas ilimitadas com clínico geral, sem agendamento',
  'Atendimento 24h por dia, 7 dias por semana',
  'Receitas e atestados médicos digitais com certificação validada pelo Conselho Federal de Medicina',
  'Descontos em medicamentos e exames',
  'Programa "Medicamento em Casa" (*)',
];

// Planos Individuais — ciclo anual, cobrança mensal recorrente
export const INDIVIDUAL_PLANS: PlanData[] = [
  {
    id: 'individual-bronze',
    name: 'Bronze',
    type: 'bronze',
    category: 'individual',
    description: 'Consultas médicas ilimitadas',
    shortDescription: 'Consultas médicas ilimitadas',
    price_monthly: 29.90,
    price_yearly: 29.90 * 12, // R$ 358,80/ano (12x de R$ 29,90)
    specialist_consultations_per_year: 0,
    checkups_per_year: 0,
    max_dependents: 0,
    features: [...BASE_BRONZE_FEATURES],
  },
  {
    id: 'individual-prata',
    name: 'Prata',
    type: 'prata',
    category: 'individual',
    description: 'Consulta garantida com especialista',
    shortDescription: 'Consulta garantida com especialista',
    price_monthly: 49.90,
    price_yearly: 49.90 * 12, // R$ 598,80/ano (12x de R$ 49,90)
    specialist_consultations_per_year: 1,
    checkups_per_year: 0,
    max_dependents: 0,
    features: [
      ...BASE_BRONZE_FEATURES,
      '1 consulta com médico especialista por ano',
    ],
  },
  {
    id: 'individual-ouro',
    name: 'Ouro',
    type: 'ouro',
    category: 'individual',
    description: 'Maiores cuidados em saúde, com check up gratuito',
    shortDescription: 'Maiores cuidados em saúde, com check up gratuito',
    price_monthly: 69.90,
    price_yearly: 69.90 * 12, // R$ 838,80/ano (12x de R$ 69,90)
    specialist_consultations_per_year: 1,
    checkups_per_year: 1,
    max_dependents: 0,
    highlight: true,
    features: [
      ...BASE_BRONZE_FEATURES,
      '1 consulta com médico especialista por ano',
      '1 check-up anual (mulher, homem ou criança)',
    ],
  },
  {
    id: 'individual-diamante',
    name: 'Diamante',
    type: 'diamante',
    category: 'individual',
    description: 'Melhor e mais avançado controle da saúde',
    shortDescription: 'Melhor e mais avançado controle da saúde',
    price_monthly: 89.90,
    price_yearly: 89.90 * 12, // R$ 1.078,80/ano (12x de R$ 89,90)
    specialist_consultations_per_year: 2,
    checkups_per_year: 1,
    max_dependents: 0,
    features: [
      ...BASE_BRONZE_FEATURES,
      '2 consultas com médico especialista por ano',
      '1 check-up anual (mulher, homem ou criança)',
    ],
  },
];

// Planos Coletivos (Familiar - até 3 vidas) — ciclo anual, cobrança mensal recorrente
export const COLETIVO_PLANS: PlanData[] = [
  {
    id: 'coletivo-bronze',
    name: 'Bronze Familiar',
    type: 'bronze-coletivo',
    category: 'coletivo',
    description: 'Consultas médicas ilimitadas para até 3 vidas no total',
    shortDescription: 'Até 3 vidas no total',
    price_monthly: 79.90,
    price_yearly: 79.90 * 12, // R$ 958,80/ano (12x de R$ 79,90)
    specialist_consultations_per_year: 0,
    checkups_per_year: 0,
    max_dependents: 2, // titular + 2 dependentes = 3 vidas
    features: [
      ...BASE_BRONZE_FEATURES,
      'Até 3 beneficiários no total',
    ],
  },
  {
    id: 'coletivo-prata',
    name: 'Prata Familiar',
    type: 'prata-coletivo',
    category: 'coletivo',
    description: 'Consultas com especialista para toda a família',
    shortDescription: 'Especialista incluído - até 3 pessoas',
    price_monthly: 139.90,
    price_yearly: 139.90 * 12, // R$ 1.678,80/ano (12x de R$ 139,90)
    specialist_consultations_per_year: 2,
    checkups_per_year: 0,
    max_dependents: 2,
    features: [
      ...BASE_BRONZE_FEATURES,
      '2 consultas com médico especialista por ano',
      'Até 3 beneficiários no total',
    ],
  },
  {
    id: 'coletivo-ouro',
    name: 'Ouro Familiar',
    type: 'ouro-coletivo',
    category: 'coletivo',
    description: 'Maiores cuidados em saúde para toda a família',
    shortDescription: 'Check-up incluído - até 3 pessoas',
    price_monthly: 199.90,
    price_yearly: 199.90 * 12, // R$ 2.398,80/ano (12x de R$ 199,90)
    specialist_consultations_per_year: 2,
    checkups_per_year: 1,
    max_dependents: 2,
    highlight: true,
    features: [
      ...BASE_BRONZE_FEATURES,
      '2 consultas com médico especialista por ano',
      '1 check-up anual',
      'Até 3 beneficiários no total',
    ],
  },
  {
    id: 'coletivo-diamante',
    name: 'Diamante Familiar',
    type: 'diamante-coletivo',
    category: 'coletivo',
    description: 'O melhor plano para toda a família',
    shortDescription: 'Plano completo - até 3 pessoas',
    price_monthly: 259.90,
    price_yearly: 259.90 * 12, // R$ 3.118,80/ano (12x de R$ 259,90)
    specialist_consultations_per_year: 4,
    checkups_per_year: 1,
    max_dependents: 2,
    features: [
      ...BASE_BRONZE_FEATURES,
      '4 consultas com médico especialista por ano',
      '1 check-up anual',
      'Até 3 beneficiários no total',
    ],
  },
];

// Todos os planos combinados
export const ALL_PLANS: PlanData[] = [...INDIVIDUAL_PLANS, ...COLETIVO_PLANS];

// Helper para formatar preço em BRL
export const formatPrice = (price: number): string => {
  return price.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Helper para obter cor do plano
export const getPlanColor = (type: string): string => {
  if (type.includes('bronze')) return 'from-amber-700 to-amber-500';
  if (type.includes('prata')) return 'from-slate-400 to-slate-300';
  if (type.includes('ouro')) return 'from-yellow-500 to-yellow-400';
  if (type.includes('diamante')) return 'from-cyan-400 to-blue-500';
  return 'from-primary to-secondary';
};

// Helper para verificar se é plano destacado
export const isPlanHighlighted = (plan: PlanData): boolean => {
  return plan.highlight === true;
};
