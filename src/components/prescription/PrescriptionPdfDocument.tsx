/**
 * PrescriptionPdfDocument.tsx
 *
 * Template PDF da Novità para receitas médicas reformatadas.
 * Usa @react-pdf/renderer — componentes específicos do renderer PDF,
 * não são componentes React normais de DOM.
 */

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { ParsedPrescriptionData } from "@/services/prescriptionStructuredParser";

// ─── Fontes ────────────────────────────────────────────────────────────────

Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc4.woff2",
      fontWeight: 700,
    },
  ],
});

// ─── Paleta Novità ─────────────────────────────────────────────────────────

const COLORS = {
  primary: "#EDAF00",      // Dourado Novità
  primaryDark: "#B88200",  // Dourado escuro
  primaryLight: "#FDF8E8", // Fundo dourado suave
  text: "#1A1A2E",         // Azul-escuro texto
  textMuted: "#6B7280",    // Cinza para legendas
  border: "#E5E7EB",       // Borda suave
  white: "#FFFFFF",
  surface: "#F9FAFB",      // Fundo seção
  accent: "#0EA5E9",       // Azul info
  accentLight: "#E0F2FE",  // Azul claro info
};

// ─── Estilos ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    backgroundColor: COLORS.white,
    paddingTop: 0,
    paddingBottom: 48,
    paddingHorizontal: 0,
  },

  // Header
  header: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 40,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 36,
    height: 36,
    objectFit: "contain",
  },
  headerBrand: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  headerSub: {
    color: COLORS.primary,
    fontSize: 9,
    marginTop: 1,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerDate: {
    color: COLORS.textMuted,
    fontSize: 8,
    marginBottom: 2,
  },
  headerDateValue: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 700,
  },

  // Faixa dourada sob o header
  stripe: {
    backgroundColor: COLORS.primary,
    height: 4,
  },

  // Body wrapper
  body: {
    paddingHorizontal: 40,
    paddingTop: 28,
  },

  // Título principal
  titleSection: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  titleBadgeText: {
    color: COLORS.text,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  mainTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 700,
  },

  // Cards de info (paciente / médico)
  infoGrid: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 24,
  },
  infoCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 6,
  },
  infoCardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  infoCardTitle: {
    color: COLORS.primaryDark,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  infoRow: {
    marginBottom: 5,
  },
  infoLabel: {
    color: COLORS.textMuted,
    fontSize: 7.5,
    marginBottom: 1,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: 700,
  },
  infoValueNormal: {
    color: COLORS.text,
    fontSize: 9,
  },

  // Seção de medicamentos
  medSection: {
    marginBottom: 24,
  },
  medSectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  medSectionTitleLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  medSectionTitleText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
  },

  // Card de medicamento
  medCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    overflow: "hidden",
  },
  medCardHeader: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  medNumberBadge: {
    backgroundColor: COLORS.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  medNumberText: {
    color: COLORS.text,
    fontSize: 8,
    fontWeight: 700,
  },
  medNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  medName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 700,
    flex: 1,
  },
  medDosageBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  medDosageBadgeText: {
    color: COLORS.text,
    fontSize: 8,
    fontWeight: 700,
  },
  medCardBody: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 12,
  },
  medDetail: {
    flex: 1,
  },
  medDetailLabel: {
    color: COLORS.textMuted,
    fontSize: 7,
    marginBottom: 2,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  medDetailValue: {
    color: COLORS.text,
    fontSize: 9.5,
  },
  medInstructions: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  medInstructionsText: {
    color: COLORS.textMuted,
    fontSize: 8.5,
    fontStyle: "italic",
  },

  // Observações
  obsSection: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
    padding: 14,
    marginBottom: 24,
  },
  obsSectionTitle: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  obsText: {
    color: COLORS.text,
    fontSize: 9,
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 40,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
  },
  footerLeft: {
    flex: 1,
  },
  footerBrand: {
    color: COLORS.primaryDark,
    fontSize: 8,
    fontWeight: 700,
  },
  footerSub: {
    color: COLORS.textMuted,
    fontSize: 7,
    marginTop: 1,
  },
  footerRight: {
    alignItems: "flex-end",
  },
  footerValidity: {
    color: COLORS.textMuted,
    fontSize: 7.5,
  },
  footerPageNum: {
    color: COLORS.textMuted,
    fontSize: 7,
    marginTop: 2,
  },

  // Linha divisória de assinatura
  signatureSection: {
    marginTop: 32,
    marginBottom: 24,
    alignItems: "center",
  },
  signatureLine: {
    width: 200,
    height: 1,
    backgroundColor: COLORS.text,
    marginBottom: 6,
  },
  signatureText: {
    color: COLORS.text,
    fontSize: 9,
    fontWeight: 700,
  },
  signatureSubText: {
    color: COLORS.textMuted,
    fontSize: 8,
    marginTop: 2,
  },
});

// ─── Componente PDF ────────────────────────────────────────────────────────

interface Props {
  data: ParsedPrescriptionData;
  logoUrl?: string;
}

export function PrescriptionPdfDocument({ data, logoUrl }: Props) {
  const today = new Date().toLocaleDateString("pt-BR");
  const displayDate = data.date || today;

  return (
    <Document
      title="Receita Médica - Novità Telemedicina"
      author="Novità Telemedicina"
      subject="Receita Médica"
      creator="Novità"
    >
      <Page size="A4" style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoUrl && <Image src={logoUrl} style={styles.logo} />}
            <View>
              <Text style={styles.headerBrand}>Novità</Text>
              <Text style={styles.headerSub}>Telemedicina</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerDate}>Data da receita</Text>
            <Text style={styles.headerDateValue}>{displayDate}</Text>
          </View>
        </View>
        <View style={styles.stripe} />

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <View style={styles.body}>

          {/* Título */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <View style={styles.titleBadge}>
                <Text style={styles.titleBadgeText}>Documento Oficial</Text>
              </View>
              <Text style={styles.mainTitle}>Receita Médica</Text>
            </View>
          </View>

          {/* Info grid: Paciente + Médico */}
          <View style={styles.infoGrid}>
            {/* Paciente */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <View style={styles.infoCardDot} />
                <Text style={styles.infoCardTitle}>Dados do Paciente</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nome completo</Text>
                <Text style={styles.infoValue}>
                  {data.patientName || "Não identificado"}
                </Text>
              </View>
            </View>

            {/* Médico */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <View style={styles.infoCardDot} />
                <Text style={styles.infoCardTitle}>Profissional de Saúde</Text>
              </View>
              {data.doctorName && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Médico(a) responsável</Text>
                  <Text style={styles.infoValue}>{data.doctorName}</Text>
                </View>
              )}
              {data.doctorCRM && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Registro profissional</Text>
                  <Text style={styles.infoValueNormal}>{data.doctorCRM}</Text>
                </View>
              )}
              {data.specialty && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Especialidade</Text>
                  <Text style={styles.infoValueNormal}>{data.specialty}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Medicamentos */}
          {data.medications.length > 0 && (
            <View style={styles.medSection}>
              <View style={styles.medSectionTitle}>
                <View style={styles.medSectionTitleLine} />
                <Text style={styles.medSectionTitleText}>
                  {data.medications.length === 1
                    ? "1 Medicamento Prescrito"
                    : `${data.medications.length} Medicamentos Prescritos`}
                </Text>
                <View style={styles.medSectionTitleLine} />
              </View>

              {data.medications.map((med, i) => (
                <View key={i} style={styles.medCard}>
                  {/* Cabeçalho do card */}
                  <View style={styles.medCardHeader}>
                    <View style={styles.medNameRow}>
                      <View style={styles.medNumberBadge}>
                        <Text style={styles.medNumberText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.medName}>{med.name}</Text>
                    </View>
                    {med.dosage && (
                      <View style={styles.medDosageBadge}>
                        <Text style={styles.medDosageBadgeText}>{med.dosage}</Text>
                      </View>
                    )}
                  </View>

                  {/* Detalhes */}
                  {(med.frequency || med.duration) && (
                    <View style={styles.medCardBody}>
                      {med.frequency && (
                        <View style={styles.medDetail}>
                          <Text style={styles.medDetailLabel}>Frequência</Text>
                          <Text style={styles.medDetailValue}>{med.frequency}</Text>
                        </View>
                      )}
                      {med.duration && (
                        <View style={styles.medDetail}>
                          <Text style={styles.medDetailLabel}>Duração</Text>
                          <Text style={styles.medDetailValue}>{med.duration}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Instruções */}
                  {med.instructions && (
                    <View style={styles.medInstructions}>
                      <Text style={styles.medInstructionsText}>
                        {med.instructions}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Observações */}
          {data.observations && (
            <View style={styles.obsSection}>
              <Text style={styles.obsSectionTitle}>Observações</Text>
              <Text style={styles.obsText}>{data.observations}</Text>
            </View>
          )}

          {/* Assinatura */}
          <View style={styles.signatureSection}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureText}>
              {data.doctorName || "Profissional de Saúde"}
            </Text>
            {data.doctorCRM && (
              <Text style={styles.signatureSubText}>{data.doctorCRM}</Text>
            )}
          </View>
        </View>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerBrand}>Novità Telemedicina</Text>
            <Text style={styles.footerSub}>
              Documento gerado pela plataforma Novità · novita.migrai.com.br
            </Text>
          </View>
          <View style={styles.footerRight}>
            <Text style={styles.footerValidity}>
              Validade: 30 dias a partir da data de emissão
            </Text>
            <Text style={styles.footerPageNum}>Página 1 de 1</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
