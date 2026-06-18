// PDFs de Pedido de Exame e Atestado Médico (React-PDF), no mesmo padrão visual
// da receita (PrescriptionPdf.tsx). Usados pelos botões "Gerar Exame" / "Gerar
// Atestado" no atendimento.

import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ExamItem {
  name: string;
  priority: 'routine' | 'urgent' | 'emergency';
  justification?: string;
}

export interface ExamRequestPdfData {
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  date: string; // ISO
  consultationRef?: string | number | null;
  exams: ExamItem[];
  /** Pré-visualização não assinada — estampa tarja de rascunho. */
  draft?: boolean;
}

export interface CertificatePdfData {
  patientName: string;
  doctorName: string;
  doctorCrm: string;
  date: string; // ISO
  consultationRef?: string | number | null;
  days: string;
  startDate: string; // yyyy-MM-dd
  cidCode?: string;
  reason: string;
  notes?: string;
  /** Pré-visualização não assinada — estampa tarja de rascunho. */
  draft?: boolean;
}

const PRIORITY_LABEL: Record<ExamItem['priority'], string> = {
  routine: 'Rotina',
  urgent: 'Urgente',
  emergency: 'Emergência',
};

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 48, fontSize: 11, color: '#1f2937', fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  brand: { fontSize: 16, fontWeight: 'bold', color: '#1a56db' },
  brandSub: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  headerMeta: { fontSize: 9, color: '#6b7280', textAlign: 'right' },
  title: { fontSize: 15, fontWeight: 'bold', borderBottomWidth: 1.5, borderBottomColor: '#333', paddingBottom: 6, marginBottom: 16 },
  patientBox: { backgroundColor: '#f5f5f5', borderRadius: 4, padding: 10, marginBottom: 18, fontSize: 10 },
  item: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4, padding: 8, marginBottom: 8 },
  itemName: { fontSize: 12, fontWeight: 'bold' },
  itemLine: { fontSize: 10, color: '#374151', marginTop: 2 },
  body: { fontSize: 11, color: '#374151', lineHeight: 1.6 },
  bodyLine: { fontSize: 11, color: '#374151', marginTop: 6 },
  sigBlock: { marginTop: 56, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10, alignItems: 'center' },
  sigName: { fontSize: 14 },
  sigCrm: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  sigUnsigned: { fontSize: 8, color: '#b45309', marginTop: 4 },
  draftBanner: { marginBottom: 14, borderWidth: 1, borderColor: '#f59e0b', backgroundColor: '#fffbeb', borderRadius: 4, padding: 8 },
  draftBannerText: { fontSize: 9, fontWeight: 'bold', color: '#b45309', textAlign: 'center' },
});

function DraftBanner() {
  return (
    <View style={styles.draftBanner}>
      <Text style={styles.draftBannerText}>
        RASCUNHO — PRÉ-VISUALIZAÇÃO SEM ASSINATURA DIGITAL · SEM VALIDADE JURÍDICA
      </Text>
    </View>
  );
}

function fmtDate(iso: string) {
  try { return format(new Date(iso), 'dd/MM/yyyy', { locale: ptBR }); } catch { return iso; }
}

function DocHeader({ date, consultationRef }: { date: string; consultationRef?: string | number | null }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>Novità Telemedicina</Text>
        <Text style={styles.brandSub}>Home Care & Teleconsulta</Text>
      </View>
      <View>
        <Text style={styles.headerMeta}>{fmtDate(date)}</Text>
        {consultationRef != null && <Text style={styles.headerMeta}>Atendimento #{String(consultationRef)}</Text>}
      </View>
    </View>
  );
}

function SignatureBlock({ doctorName, doctorCrm, draft }: { doctorName: string; doctorCrm: string; draft?: boolean }) {
  return (
    <View style={styles.sigBlock}>
      <Text style={styles.sigName}>{doctorName}</Text>
      <Text style={styles.sigCrm}>{doctorCrm}</Text>
      {draft && (
        <Text style={styles.sigUnsigned}>Documento não assinado digitalmente — sem validade jurídica.</Text>
      )}
    </View>
  );
}

export function ExamRequestDocument({ data }: { data: ExamRequestPdfData }) {
  return (
    <Document title={`Pedido de Exames - ${data.patientName}`}>
      <Page size="A4" style={styles.page}>
        <DocHeader date={data.date} consultationRef={data.consultationRef} />
        <Text style={styles.title}>Pedido de Exames</Text>
        {data.draft && <DraftBanner />}
        <View style={styles.patientBox}>
          <Text>Paciente: {data.patientName}</Text>
        </View>
        {data.exams.map((e, i) => (
          <View key={i} style={styles.item} wrap={false}>
            <Text style={styles.itemName}>{i + 1}. {e.name}</Text>
            <Text style={styles.itemLine}>Prioridade: {PRIORITY_LABEL[e.priority]}</Text>
            {e.justification ? <Text style={styles.itemLine}>Justificativa: {e.justification}</Text> : null}
          </View>
        ))}
        <SignatureBlock doctorName={data.doctorName} doctorCrm={data.doctorCrm} draft={data.draft} />
      </Page>
    </Document>
  );
}

export function CertificateDocument({ data }: { data: CertificatePdfData }) {
  const days = Number(data.days) || 0;
  let endText = '';
  try {
    const end = new Date(data.startDate);
    end.setDate(end.getDate() + days - 1);
    endText = format(end, 'dd/MM/yyyy', { locale: ptBR });
  } catch { /* ignore */ }

  return (
    <Document title={`Atestado - ${data.patientName}`}>
      <Page size="A4" style={styles.page}>
        <DocHeader date={data.date} consultationRef={data.consultationRef} />
        <Text style={styles.title}>Atestado Médico</Text>
        {data.draft && <DraftBanner />}
        <View style={styles.patientBox}>
          <Text>Paciente: {data.patientName}</Text>
        </View>
        <Text style={styles.body}>
          Atesto, para os devidos fins, que o(a) paciente {data.patientName} necessita de afastamento de
          suas atividades pelo período de {days} dia{days > 1 ? 's' : ''}, a partir de {fmtDate(data.startDate)}
          {endText ? ` até ${endText}` : ''}.
        </Text>
        {data.cidCode ? <Text style={styles.bodyLine}>CID-10: {data.cidCode}</Text> : null}
        <Text style={styles.bodyLine}>Diagnóstico / Motivo: {data.reason}</Text>
        {data.notes ? <Text style={styles.bodyLine}>Observações: {data.notes}</Text> : null}
        <SignatureBlock doctorName={data.doctorName} doctorCrm={data.doctorCrm} draft={data.draft} />
      </Page>
    </Document>
  );
}

async function toResult(node: React.ReactElement): Promise<{ blob: Blob; bytes: Uint8Array }> {
  const blob = await pdf(node).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { blob, bytes };
}

export function buildExamRequestPdf(data: ExamRequestPdfData) {
  return toResult(<ExamRequestDocument data={data} />);
}

export function buildCertificatePdf(data: CertificatePdfData) {
  return toResult(<CertificateDocument data={data} />);
}
