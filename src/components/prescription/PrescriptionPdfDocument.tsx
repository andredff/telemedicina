/**
 * PrescriptionPdfDocument.tsx
 *
 * Template PDF da Novità para receitas médicas reformatadas.
 * Usa @react-pdf/renderer — componentes específicos do renderer PDF,
 * não são componentes React normais de DOM.
 *
 * Paleta: cores suaves — verde, azul, branco.
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

// ─── Paleta suave ──────────────────────────────────────────────────────────

const C = {
  // Azul suave
  blue:        "#2563EB",
  blueMid:     "#3B82F6",
  blueLight:   "#EFF6FF",
  blueSoft:    "#DBEAFE",

  // Verde suave
  green:       "#16A34A",
  greenMid:    "#22C55E",
  greenLight:  "#F0FDF4",
  greenSoft:   "#DCFCE7",

  // Neutros
  white:       "#FFFFFF",
  bg:          "#F8FAFC",
  border:      "#E2E8F0",
  borderDark:  "#CBD5E1",

  // Texto
  text:        "#0F172A",
  textMid:     "#334155",
  textMuted:   "#64748B",
  textLight:   "#94A3B8",

  // Novità gold (acento discreto)
  gold:        "#D97706",
  goldLight:   "#FEF3C7",
};

// ─── Estilos ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    backgroundColor: C.white,
    paddingTop: 0,
    paddingBottom: 52,
    paddingHorizontal: 0,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: C.blue,
    paddingHorizontal: 40,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 32,
    height: 32,
    objectFit: "contain",
  },
  headerBrand: {
    color: C.white,
    fontSize: 17,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  headerSub: {
    color: "#BFDBFE",
    fontSize: 8,
    marginTop: 1,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerDateLabel: {
    color: "#93C5FD",
    fontSize: 7.5,
    marginBottom: 2,
  },
  headerDateValue: {
    color: C.white,
    fontSize: 10,
    fontWeight: 700,
  },

  // Faixa verde sob o header
  stripe: {
    backgroundColor: C.green,
    height: 3,
  },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: 40,
    paddingTop: 26,
  },

  // Título
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 22,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  titleBadge: {
    backgroundColor: C.greenLight,
    borderWidth: 1,
    borderColor: C.greenSoft,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  titleBadgeText: {
    color: C.green,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  mainTitle: {
    color: C.text,
    fontSize: 19,
    fontWeight: 700,
  },

  // ── Cards de info ─────────────────────────────────────────────────────────
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
  },
  infoCardPatient: {
    flex: 1,
    backgroundColor: C.greenLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.greenSoft,
    padding: 14,
  },
  infoCardDoctor: {
    flex: 1,
    backgroundColor: C.blueLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.blueSoft,
    padding: 14,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 5,
  },
  infoCardDotGreen: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.green,
  },
  infoCardDotBlue: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.blue,
  },
  infoCardTitleGreen: {
    color: C.green,
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  infoCardTitleBlue: {
    color: C.blue,
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  infoRow: {
    marginBottom: 6,
  },
  infoLabel: {
    color: C.textMuted,
    fontSize: 7,
    marginBottom: 1,
  },
  infoValueBold: {
    color: C.text,
    fontSize: 10,
    fontWeight: 700,
  },
  infoValue: {
    color: C.textMid,
    fontSize: 9,
  },

  // ── Medicamentos ──────────────────────────────────────────────────────────
  medSection: {
    marginBottom: 22,
  },
  medSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  medSectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  medSectionTitle: {
    color: C.textMid,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  medCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
    overflow: "hidden",
  },
  medCardHeader: {
    backgroundColor: C.bg,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  medNumberBadge: {
    backgroundColor: C.blue,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  medNumberText: {
    color: C.white,
    fontSize: 8,
    fontWeight: 700,
  },
  medNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  medName: {
    color: C.text,
    fontSize: 11,
    fontWeight: 700,
    flex: 1,
  },
  medDosageBadge: {
    backgroundColor: C.blueSoft,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.blue,
  },
  medDosageBadgeText: {
    color: C.blue,
    fontSize: 8,
    fontWeight: 700,
  },
  medCardBody: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    gap: 14,
  },
  medDetail: {
    flex: 1,
  },
  medDetailLabel: {
    color: C.textLight,
    fontSize: 6.5,
    marginBottom: 2,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  medDetailValue: {
    color: C.textMid,
    fontSize: 9,
  },
  medInstructions: {
    paddingHorizontal: 14,
    paddingBottom: 9,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 7,
    backgroundColor: C.goldLight,
  },
  medInstructionsText: {
    color: C.gold,
    fontSize: 8.5,
  },

  // ── Observações ───────────────────────────────────────────────────────────
  obsSection: {
    backgroundColor: C.blueLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.blueSoft,
    padding: 12,
    marginBottom: 22,
  },
  obsSectionTitle: {
    color: C.blue,
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 5,
  },
  obsText: {
    color: C.textMid,
    fontSize: 9,
    lineHeight: 1.5,
  },

  // ── Assinatura ────────────────────────────────────────────────────────────
  signatureSection: {
    marginTop: 28,
    marginBottom: 20,
    alignItems: "center",
  },
  signatureLine: {
    width: 180,
    height: 1,
    backgroundColor: C.borderDark,
    marginBottom: 6,
  },
  signatureText: {
    color: C.text,
    fontSize: 9,
    fontWeight: 700,
  },
  signatureSubText: {
    color: C.textMuted,
    fontSize: 8,
    marginTop: 2,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderTopColor: C.green,
    paddingHorizontal: 40,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.white,
  },
  footerLeft: {
    flex: 1,
  },
  footerBrand: {
    color: C.blue,
    fontSize: 8,
    fontWeight: 700,
  },
  footerSub: {
    color: C.textLight,
    fontSize: 7,
    marginTop: 1,
  },
  footerRight: {
    alignItems: "flex-end",
  },
  footerValidity: {
    color: C.textMuted,
    fontSize: 7.5,
  },
  footerPage: {
    color: C.textLight,
    fontSize: 7,
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
            <Text style={styles.headerDateLabel}>Data da receita</Text>
            <Text style={styles.headerDateValue}>{displayDate}</Text>
          </View>
        </View>
        <View style={styles.stripe} />

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <View style={styles.body}>

          {/* Título */}
          <View style={styles.titleRow}>
            <View style={styles.titleBadge}>
              <Text style={styles.titleBadgeText}>Documento Oficial</Text>
            </View>
            <Text style={styles.mainTitle}>Receita Médica</Text>
          </View>

          {/* Info grid: Paciente + Médico */}
          <View style={styles.infoGrid}>
            {/* Paciente */}
            <View style={styles.infoCardPatient}>
              <View style={styles.infoCardHeader}>
                <View style={styles.infoCardDotGreen} />
                <Text style={styles.infoCardTitleGreen}>Dados do Paciente</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nome completo</Text>
                <Text style={styles.infoValueBold}>
                  {data.patientName || "Não identificado"}
                </Text>
              </View>
            </View>

            {/* Médico */}
            <View style={styles.infoCardDoctor}>
              <View style={styles.infoCardHeader}>
                <View style={styles.infoCardDotBlue} />
                <Text style={styles.infoCardTitleBlue}>Profissional de Saúde</Text>
              </View>
              {data.doctorName && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Médico(a) responsável</Text>
                  <Text style={styles.infoValueBold}>{data.doctorName}</Text>
                </View>
              )}
              {data.doctorCRM && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Registro profissional</Text>
                  <Text style={styles.infoValue}>{data.doctorCRM}</Text>
                </View>
              )}
              {data.specialty && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Especialidade</Text>
                  <Text style={styles.infoValue}>{data.specialty}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Medicamentos */}
          {data.medications.length > 0 && (
            <View style={styles.medSection}>
              <View style={styles.medSectionHeader}>
                <View style={styles.medSectionLine} />
                <Text style={styles.medSectionTitle}>
                  {data.medications.length === 1
                    ? "1 Medicamento Prescrito"
                    : `${data.medications.length} Medicamentos Prescritos`}
                </Text>
                <View style={styles.medSectionLine} />
              </View>

              {data.medications.map((med, i) => (
                <View key={i} style={styles.medCard}>
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

                  {med.instructions && (
                    <View style={styles.medInstructions}>
                      <Text style={styles.medInstructionsText}>{med.instructions}</Text>
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
            <Text style={styles.footerPage}>Página 1 de 1</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
