// Dados dos planos conforme Briefing Novità Telemedicina
// Última atualização: Janeiro/2026

export interface PlanData {
  id: string;
  name: string;
  type: string;
  category: 'individual' | 'coletivo';
  description: string;
  shortDescription: string;
  price_monthly: number;
  price_yearly: number;
  specialist_consultations_per_year: number;
  checkups_per_year: number;
  max_dependents: number;
  features: string[];
  highlight?: boolean;
}

// Desconto anual conforme briefing: 10%
export const ANNUAL_DISCOUNT = 0.10;

// Preços de consultas avulsas
export const SINGLE_CONSULTATION_PRICES = {
  clinico_geral: 59.90,
  especialista: 119.90,
};

// Benefícios base do Bronze (comum a todos os planos)
const BASE_BRONZE_FEATURES = [
  'Consultas ilimitadas com clínico geral, sem agendamento',
  'Atendimento 24h por dia, 7 dias por semana',
  'Receitas e atestados médicos digitais com validade CFM',
  'Descontos em medicamentos',
  'Programa "Medicamento em Casa" (DF e entorno)',
];

// Planos Individuais
export const INDIVIDUAL_PLANS: PlanData[] = [
  {
    id: 'individual-bronze',
    name: 'Bronze',
    type: 'bronze',
    category: 'individual',
    description: 'Consultas médicas ilimitadas',
    shortDescription: 'Consultas médicas ilimitadas',
    price_monthly: 29.90,
    price_yearly: 29.90 * 12 * (1 - ANNUAL_DISCOUNT), // R$ 322,92/ano = R$ 26,91/mês
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
    price_yearly: 49.90 * 12 * (1 - ANNUAL_DISCOUNT), // R$ 538,92/ano = R$ 44,91/mês
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
    description: 'Maiores cuidados em saúde',
    shortDescription: 'Maiores cuidados em saúde',
    price_monthly: 79.90,
    price_yearly: 79.90 * 12 * (1 - ANNUAL_DISCOUNT), // R$ 862,92/ano = R$ 71,91/mês
    specialist_consultations_per_year: 2,
    checkups_per_year: 1,
    max_dependents: 0,
    highlight: true,
    features: [
      ...BASE_BRONZE_FEATURES,
      '2 consultas com médico especialista por ano',
      '1 check-up anual (sorologia)',
    ],
  },
  {
    id: 'individual-platina',
    name: 'Platina',
    type: 'platina',
    category: 'individual',
    description: 'Melhor e mais avançado controle da saúde',
    shortDescription: 'Melhor e mais avançado controle da saúde',
    price_monthly: 99.90,
    price_yearly: 99.90 * 12 * (1 - ANNUAL_DISCOUNT), // R$ 1.078,92/ano = R$ 89,91/mês
    specialist_consultations_per_year: 4,
    checkups_per_year: 1,
    max_dependents: 0,
    features: [
      ...BASE_BRONZE_FEATURES,
      '4 consultas com médico especialista por ano',
      '1 check-up anual (sorologia)',
    ],
  },
];

// Planos Coletivos (Familiar - até 3 vidas)
export const COLETIVO_PLANS: PlanData[] = [
  {
    id: 'coletivo-bronze',
    name: 'Bronze Familiar',
    type: 'bronze-coletivo',
    category: 'coletivo',
    description: 'Consultas médicas ilimitadas para toda a família',
    shortDescription: 'Consultas ilimitadas - até 3 pessoas',
    price_monthly: 79.90,
    price_yearly: 79.90 * 12 * (1 - ANNUAL_DISCOUNT), // R$ 862,92/ano = R$ 71,91/mês
    specialist_consultations_per_year: 0,
    checkups_per_year: 0,
    max_dependents: 2, // titular + 2 dependentes = 3 vidas
    features: [
      ...BASE_BRONZE_FEATURES,
      'Até 3 beneficiários (titular + 2 dependentes)',
    ],
  },
  {
    id: 'coletivo-prata',
    name: 'Prata Familiar',
    type: 'prata-coletivo',
    category: 'coletivo',
    description: 'Consultas com especialista para toda a família',
    shortDescription: 'Especialista incluído - até 3 pessoas',
    price_monthly: 109.90,
    price_yearly: 109.90 * 12 * (1 - ANNUAL_DISCOUNT), // R$ 1.186,92/ano = R$ 98,91/mês
    specialist_consultations_per_year: 2,
    checkups_per_year: 0,
    max_dependents: 2,
    features: [
      ...BASE_BRONZE_FEATURES,
      'Até 3 beneficiários (titular + 2 dependentes)',
      '2 consultas com médico especialista por ano',
    ],
  },
  {
    id: 'coletivo-ouro',
    name: 'Ouro Familiar',
    type: 'ouro-coletivo',
    category: 'coletivo',
    description: 'Maiores cuidados em saúde para toda a família',
    shortDescription: 'Check-up incluído - até 3 pessoas',
    price_monthly: 159.90,
    price_yearly: 159.90 * 12 * (1 - ANNUAL_DISCOUNT), // R$ 1.726,92/ano = R$ 143,91/mês
    specialist_consultations_per_year: 4,
    checkups_per_year: 2,
    max_dependents: 2,
    highlight: true,
    features: [
      ...BASE_BRONZE_FEATURES,
      'Até 3 beneficiários (titular + 2 dependentes)',
      '4 consultas com médico especialista por ano',
      '2 check-ups anuais (sorologia)',
    ],
  },
  {
    id: 'coletivo-platina',
    name: 'Platina Familiar',
    type: 'platina-coletivo',
    category: 'coletivo',
    description: 'O melhor plano para toda a família',
    shortDescription: 'Plano completo - até 3 pessoas',
    price_monthly: 199.90,
    price_yearly: 199.90 * 12 * (1 - ANNUAL_DISCOUNT), // R$ 2.158,92/ano = R$ 179,91/mês
    specialist_consultations_per_year: 6,
    checkups_per_year: 2,
    max_dependents: 2,
    features: [
      ...BASE_BRONZE_FEATURES,
      'Até 3 beneficiários (titular + 2 dependentes)',
      '6 consultas com médico especialista por ano',
      '2 check-ups anuais (sorologia)',
    ],
  },
];

// Todos os planos combinados
export const ALL_PLANS: PlanData[] = [...INDIVIDUAL_PLANS, ...COLETIVO_PLANS];

// Helper para calcular preço mensal no plano anual
export const getMonthlyPriceFromYearly = (yearlyPrice: number): number => {
  return yearlyPrice / 12;
};

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
  if (type.includes('platina') || type.includes('diamante')) return 'from-cyan-400 to-blue-500';
  return 'from-primary to-secondary';
};

// Helper para verificar se é plano destacado
export const isPlanHighlighted = (plan: PlanData): boolean => {
  return plan.highlight === true;
};
