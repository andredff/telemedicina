/**
 * prescriptionStructuredParser.ts
 *
 * Transforma o texto bruto extraído de um PDF de receita médica
 * em dados estruturados prontos para geração do novo PDF Novità.
 */

export interface ParsedMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
}

export interface ParsedPrescriptionData {
  patientName?: string;
  doctorName?: string;
  doctorCRM?: string;
  specialty?: string;
  date?: string;
  medications: ParsedMedication[];
  observations?: string;
  rawText: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function cleanLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function findByPattern(lines: string[], patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        const value = (match[2] ?? match[1] ?? "").trim();
        if (value.length > 1) return value;
      }
    }
  }
  return undefined;
}

// ─── Extração de data ──────────────────────────────────────────────────────

function extractDate(lines: string[]): string | undefined {
  const patterns = [
    /(?:data|emissão|emissao|emitida?(?:\s+em)?)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
  ];

  for (const line of lines) {
    for (const pat of patterns) {
      const m = line.match(pat);
      if (m) {
        // Monta data normalizada dd/mm/yyyy
        if (m[1] && m[2] && m[3]) {
          const year = m[3].length === 2 ? `20${m[3]}` : m[3];
          return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${year}`;
        }
        if (m[1]) return m[1].trim();
      }
    }
  }
  return undefined;
}

// ─── Extração de nome do paciente ──────────────────────────────────────────

function extractPatientName(lines: string[]): string | undefined {
  return findByPattern(lines, [
    /(?:paciente|para|nome do paciente)[:\s]+(.+)/i,
    /^(?:ao?\s+sr|ao?\s+sra|ao?\s+senhor|ao?\s+senhora)[:\s.]+(.+)/i,
  ]);
}

// ─── Extração de médico e CRM ──────────────────────────────────────────────

function extractDoctor(lines: string[]): { name?: string; crm?: string; specialty?: string } {
  const result: { name?: string; crm?: string; specialty?: string } = {};

  const crmPattern = /CRM[:\s\-/]*([A-Z]{2})?[\s\-]*(\d{4,7})/i;
  for (const line of lines) {
    const m = line.match(crmPattern);
    if (m) {
      const uf = m[1] ? m[1].toUpperCase() : "";
      result.crm = uf ? `CRM-${uf} ${m[2]}` : `CRM ${m[2]}`;

      // Tenta pegar o nome do médico na mesma linha ou na anterior
      const beforeCrm = line.substring(0, line.indexOf(m[0])).trim();
      const nameMatcher = beforeCrm.match(/(?:Dr\.?a?\.?\s+|Med\.?\s+)?([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+)+)/);
      if (nameMatcher) {
        result.name = cleanLine(nameMatcher[0]);
      }
      break;
    }
  }

  // Busca por padrões de nome do médico explícitos
  if (!result.name) {
    result.name = findByPattern(lines, [
      /(?:médico|medico|dr\.?a?\.?|profissional)[:\s]+(.+?)(?:\s*-\s*CRM|\s*,|\s*$)/i,
      /(?:responsável técnico|resp\.\s*técnico)[:\s]+(.+)/i,
    ]);
  }

  result.specialty = findByPattern(lines, [
    /(?:especialidade|especialização|especialista em)[:\s]+(.+)/i,
    /(?:CRM[^-\n]+[-–]\s*)(.+)/i,
  ]);

  return result;
}

// ─── Extração de medicamentos ──────────────────────────────────────────────

const MEDICATION_KEYWORDS = [
  // Formas farmacêuticas
  /\b(?:comprimido|cápsula|capsula|gotas?|solução|solucao|xarope|pomada|creme|supositório|supositorio|injetável|injetavel|ampola|spray|adesivo|gel|loção|locao|suspensão|suspensao|pastilha)\b/i,
  // Dosagens
  /\d+\s*(?:mg|mcg|g|ml|mL|UI|ui|%)\b/i,
  // Números romanos ou arábicos seguidos de ponto (listas)
  /^\s*(?:[IVX]+\.|\d+\.)\s+[A-ZÁÉÍÓÚ]/,
];

const FREQUENCY_PATTERNS = [
  /(\d+\s*(?:x|vez(?:es)?)\s*(?:ao\s*dia|por\s*dia|diári[ao]s?|\/dia))/i,
  /((?:uma|duas?|três|tres|1|2|3|4)\s*(?:vez(?:es)?|comprimido[s]?|cápsula[s]?|capsula[s]?)\s*(?:ao\s*dia|por\s*dia|diári[ao]s?|\/dia|à\s*noite|pela\s*manhã|de\s*\d+\s*em\s*\d+\s*horas?))/i,
  /(de\s*\d+\s*em\s*\d+\s*horas?)/i,
  /(1|2|3|4|uma|duas?|três)[\s-](?:ao\s*dia|vez(?:es)?\s*ao\s*dia|\/dia|por\s*dia)/i,
];

const DURATION_PATTERNS = [
  /(?:por|durante|durante\s*)\s*(\d+\s*(?:dias?|semanas?|meses?|mês|mes))/i,
  /(\d+\s*(?:dias?|semanas?|meses?|mês|mes))\s*(?:de\s*tratamento|de\s*uso)?/i,
];

function extractFrequency(text: string): string | undefined {
  for (const pat of FREQUENCY_PATTERNS) {
    const m = text.match(pat);
    if (m) return m[1].trim();
  }
  return undefined;
}

function extractDuration(text: string): string | undefined {
  for (const pat of DURATION_PATTERNS) {
    const m = text.match(pat);
    if (m) return m[1].trim();
  }
  return undefined;
}

function isMedicationLine(line: string): boolean {
  return MEDICATION_KEYWORDS.some((pat) => pat.test(line));
}

function extractMedications(lines: string[]): ParsedMedication[] {
  const medications: ParsedMedication[] = [];
  let current: ParsedMedication | null = null;
  let instructionBuffer: string[] = [];

  const flush = () => {
    if (current) {
      if (instructionBuffer.length > 0) {
        current.instructions = instructionBuffer.join(" ").replace(/\s+/g, " ").trim();
      }
      medications.push(current);
      current = null;
      instructionBuffer = [];
    }
  };

  const dosagePattern = /(\d+\s*(?:mg|mcg|g|ml|mL|UI|ui|%))/i;
  // Padrão de início de medicamento: número ou letra maiúscula com dosagem
  const medStartPattern = /^\s*(?:\d+\.\s*)?([A-ZÁÉÍÓÚ][^\n]+?(?:\d+\s*(?:mg|mcg|g|ml|mL|UI|ui|%|comprimido|cápsula|capsula))[^\n]*)/i;

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    const isMedLine = isMedicationLine(line) || medStartPattern.test(line);

    if (isMedLine) {
      flush();

      const freq = extractFrequency(line);
      const dur = extractDuration(line);
      const dosageMatch = line.match(dosagePattern);

      // Remove número de lista do início
      const nameLine = line.replace(/^\s*\d+\.\s*/, "").trim();

      // O nome do medicamento é a parte antes das instruções de uso
      let name = nameLine;
      // Tenta remover instrução de dosagem/frequência do nome
      const dashIdx = nameLine.search(/[-–]\s*(?:tomar|usar|aplicar|1|2|3|uma|duas?)/i);
      if (dashIdx > 0) {
        name = nameLine.substring(0, dashIdx).trim();
      }

      current = {
        name,
        dosage: dosageMatch ? dosageMatch[1] : undefined,
        frequency: freq,
        duration: dur,
      };
    } else if (current) {
      // Linha de continuação: pode ser instrução
      const freq = extractFrequency(line);
      const dur = extractDuration(line);
      if (freq && !current.frequency) current.frequency = freq;
      if (dur && !current.duration) current.duration = dur;
      instructionBuffer.push(line);
    }
  }

  flush();
  return medications;
}

// ─── Observações gerais ────────────────────────────────────────────────────

function extractObservations(lines: string[]): string | undefined {
  const idx = lines.findIndex((l) =>
    /^(?:obs(?:ervação|ervacoes|:)?\.?|nota:|atenção:|atencao:)/i.test(l.trim())
  );
  if (idx >= 0) {
    const obs = lines
      .slice(idx + 1, idx + 5)
      .map(cleanLine)
      .filter(Boolean)
      .join(" ");
    return obs || cleanLine(lines[idx]).replace(/^obs[^:]*:/i, "").trim();
  }
  return undefined;
}

// ─── Parser principal ──────────────────────────────────────────────────────

export function parsePrescriptionText(rawText: string): ParsedPrescriptionData {
  const lines = rawText.split(/\n|\r/).map(cleanLine).filter(Boolean);

  const { name: doctorName, crm: doctorCRM, specialty } = extractDoctor(lines);

  return {
    patientName: extractPatientName(lines),
    doctorName,
    doctorCRM,
    specialty,
    date: extractDate(lines),
    medications: extractMedications(lines),
    observations: extractObservations(lines),
    rawText,
  };
}
