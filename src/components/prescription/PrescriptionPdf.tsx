// PDF da receita médica (React-PDF). Usado tanto para a PRÉ-VISUALIZAÇÃO quanto
// como o documento que vai para a assinatura digital (Bird ID / stub).

import { Document, Page, Text, View, StyleSheet, pdf, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NOVITA_LOGO_DATA_URI } from './novitaLogo';

export interface PrescriptionMedication {
  name: string;
  dosage?: string;
  quantity?: string;
  instructions?: string;
}

export interface PrescriptionSignature {
  provider: 'stub' | 'bird_id';
  signatureId: string;
  hash: string;
  signedAt: string; // ISO
}

export interface PrescriptionPdfData {
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  date: string; // ISO
  consultationRef?: string | number | null;
  medications: PrescriptionMedication[];
  guidance?: string;
  signature?: PrescriptionSignature | null;
}

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontSize: 11, color: '#1f2937', fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#1a56db' },
  logo: { width: 128, height: 55, objectFit: 'contain' },
  brandSub: { fontSize: 9, color: '#6b7280', marginTop: 6 },
  headerMeta: { fontSize: 9, color: '#6b7280', textAlign: 'right' },
  title: { fontSize: 15, fontWeight: 'bold', borderBottomWidth: 1.5, borderBottomColor: '#333', paddingBottom: 6, marginBottom: 16 },
  patientBox: { backgroundColor: '#f5f5f5', borderRadius: 4, padding: 10, marginBottom: 18, fontSize: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 8, color: '#111827' },
  item: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, padding: 8, marginBottom: 8 },
  itemName: { fontSize: 12, fontWeight: 'bold' },
  itemLine: { fontSize: 10, color: '#374151', marginTop: 2 },
  itemObs: { fontSize: 10, color: '#4b5563', marginTop: 2, fontStyle: 'italic' },
  guidance: { fontSize: 10, color: '#374151', lineHeight: 1.5, marginTop: 4 },
  sigBlock: { marginTop: 48, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10, alignItems: 'center' },
  sigName: { fontSize: 14 },
  sigCrm: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  sigStamp: { marginTop: 14, borderWidth: 1, borderColor: '#10b981', backgroundColor: '#ecfdf5', borderRadius: 4, padding: 8 },
  sigStampTitle: { fontSize: 9, fontWeight: 'bold', color: '#047857' },
  sigStampLine: { fontSize: 8, color: '#065f46', marginTop: 2 },
  draftBanner: { marginBottom: 14, borderWidth: 1, borderColor: '#f59e0b', backgroundColor: '#fffbeb', borderRadius: 4, padding: 8 },
  draftBannerText: { fontSize: 9, fontWeight: 'bold', color: '#b45309', textAlign: 'center' },
  sigUnsigned: { fontSize: 8, color: '#b45309', marginTop: 4 },
});

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'dd/MM/yyyy', { locale: ptBR }); } catch { return iso; }
}
function fmtDateTime(iso: string) {
  try { return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return iso; }
}

export function PrescriptionDocument({ data }: { data: PrescriptionPdfData }) {
  const sig = data.signature ?? null;
  return (
    <Document title={`Receita - ${data.patientName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Image src={NOVITA_LOGO_DATA_URI} style={styles.logo} />
            <Text style={styles.brandSub}>Home Care & Teleconsulta</Text>
          </View>
          <View>
            <Text style={styles.headerMeta}>{fmtDate(data.date)}</Text>
            {data.consultationRef != null && (
              <Text style={styles.headerMeta}>Atendimento #{String(data.consultationRef)}</Text>
            )}
          </View>
        </View>

        <Text style={styles.title}>Receita Médica</Text>

        {!sig && (
          <View style={styles.draftBanner}>
            <Text style={styles.draftBannerText}>
              RASCUNHO — PRÉ-VISUALIZAÇÃO SEM ASSINATURA DIGITAL · SEM VALIDADE JURÍDICA
            </Text>
          </View>
        )}

        <View style={styles.patientBox}>
          <Text>Paciente: {data.patientName}</Text>
        </View>

        <Text style={styles.sectionTitle}>Medicamentos</Text>
        {data.medications.length === 0 ? (
          <Text style={styles.itemLine}>Nenhum medicamento prescrito.</Text>
        ) : (
          data.medications.map((m, i) => (
            <View key={i} style={styles.item} wrap={false}>
              <Text style={styles.itemName}>{i + 1}. {m.name}</Text>
              {m.dosage ? <Text style={styles.itemLine}>Posologia: {m.dosage}</Text> : null}
              {m.quantity ? <Text style={styles.itemLine}>Quantidade: {m.quantity}</Text> : null}
              {m.instructions ? <Text style={styles.itemObs}>Obs: {m.instructions}</Text> : null}
            </View>
          ))
        )}

        {data.guidance?.trim() ? (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionTitle}>Orientações médicas</Text>
            <Text style={styles.guidance}>{data.guidance.trim()}</Text>
          </View>
        ) : null}

        <View style={styles.sigBlock}>
          <Text style={styles.sigName}>{data.doctorName}</Text>
          <Text style={styles.sigCrm}>{data.doctorCrm}</Text>
          {!sig && (
            <Text style={styles.sigUnsigned}>Documento não assinado digitalmente — sem validade jurídica.</Text>
          )}
          {sig && (
            <View style={styles.sigStamp}>
              <Text style={styles.sigStampTitle}>
                Assinado digitalmente via {sig.provider === 'bird_id' ? 'Bird ID (ICP-Brasil)' : 'Bird ID (simulação)'}
              </Text>
              <Text style={styles.sigStampLine}>ID da assinatura: {sig.signatureId}</Text>
              <Text style={styles.sigStampLine}>Data: {fmtDateTime(sig.signedAt)}</Text>
              <Text style={styles.sigStampLine}>Hash SHA-256: {sig.hash}</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}

/** Gera o PDF da receita. Retorna o Blob (para preview/download) e os bytes (para assinar). */
export async function buildPrescriptionPdf(
  data: PrescriptionPdfData,
): Promise<{ blob: Blob; bytes: Uint8Array }> {
  const blob = await pdf(<PrescriptionDocument data={data} />).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { blob, bytes };
}
