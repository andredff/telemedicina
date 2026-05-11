import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { RBAC } from '@/integrations/supabase/adminClient';
import { supabaseAdmin } from '@/integrations/supabase/adminClient';
import { logger } from '@/lib/logger';
import { formatLogisticsStatus } from '@/lib/labels';
import { Printer, ArrowLeft } from 'lucide-react';

interface ServiceOrderItem {
  name: string;
  quantity: number;
  prescriptionId?: string;
}

interface ServiceOrderRow {
  id: string;
  order_id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  items: ServiceOrderItem[] | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function ServiceOrderView() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [os, setOs] = useState<ServiceOrderRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth gate — só admins podem ver
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/auth');
          return;
        }
        const isAdmin = await RBAC.isAdmin(user.id);
        setAuthorized(isAdmin);
        if (!isAdmin) navigate('/');
      } catch (err) {
        logger.error('[ServiceOrderView] Auth check failed:', err);
        navigate('/auth');
      }
    })();
  }, [navigate]);

  // Carrega a OS quando autorizado
  useEffect(() => {
    if (!authorized || !orderId) return;
    (async () => {
      try {
        setLoading(true);
        const { data, error: dbError } = await supabaseAdmin
          .from('logistics_service_orders')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dbError) throw dbError;

        if (!data) {
          setError('Nenhuma ordem de serviço foi criada para este pedido.');
          return;
        }

        // items pode chegar como string (JSON) ou já parseado
        const items =
          typeof data.items === 'string'
            ? JSON.parse(data.items)
            : (data.items || []);

        setOs({ ...data, items });
      } catch (err) {
        logger.error('[ServiceOrderView] Failed to load OS:', err);
        setError('Erro ao carregar a ordem de serviço.');
      } finally {
        setLoading(false);
      }
    })();
  }, [authorized, orderId]);

  if (authorized === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex items-center gap-3 text-slate-600">
          <div className="h-5 w-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          Carregando ordem de serviço...
        </div>
      </div>
    );
  }

  if (error || !os) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-6 text-center">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">OS não encontrada</h2>
        <p className="text-slate-600 mb-6">{error || `Nenhuma ordem de serviço para o pedido ${orderId}.`}</p>
        <button
          onClick={() => navigate('/admin/pedidos')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Pedidos
        </button>
      </div>
    );
  }

  const items: ServiceOrderItem[] = Array.isArray(os.items) ? os.items : [];
  const createdAt = new Date(os.created_at).toLocaleString('pt-BR');

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Toolbar (oculta na impressão) */}
      <div className="print:hidden sticky top-0 z-10 bg-slate-800 text-white px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/pedidos')}
          className="flex items-center gap-2 text-sm opacity-90 hover:opacity-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Pedidos
        </button>
        <div className="text-sm opacity-90">
          OS do Pedido <strong className="font-mono">#{os.order_id}</strong>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 px-4 py-2 rounded-md text-sm font-semibold"
        >
          <Printer className="h-4 w-4" />
          Imprimir / Salvar como PDF
        </button>
      </div>

      {/* Documento */}
      <div className="max-w-[210mm] mx-auto my-6 bg-white shadow-lg rounded print:shadow-none print:my-0 print:max-w-none">
        <div className="p-[28mm_18mm] print:p-[16mm_14mm]">

          {/* Cabeçalho */}
          <header className="flex justify-between items-start border-b-[3px] border-emerald-700 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-emerald-700 m-0">Ordem de Serviço Logística</h1>
              <p className="text-sm text-slate-500 mt-1">Novità Health Group — Separação e Entrega de Medicamentos</p>
            </div>
            <div className="text-right text-xs text-slate-500 leading-relaxed">
              <div><strong className="text-slate-900">OS Nº</strong> <span className="font-mono">{os.id.slice(0, 8)}</span></div>
              <div><strong className="text-slate-900">Pedido</strong> <span className="font-mono">{os.order_id}</span></div>
              <div><strong className="text-slate-900">Emitida em</strong> {createdAt}</div>
              <div className="mt-1">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                  os.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                  os.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                  os.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {formatLogisticsStatus(os.status)}
                </span>
              </div>
            </div>
          </header>

          {/* Paciente */}
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200 pb-1 mb-2">Paciente</h2>
            <p className="text-sm m-1"><strong className="inline-block min-w-[110px] text-slate-700">Nome:</strong> {os.customer_name || '—'}</p>
            <p className="text-sm m-1"><strong className="inline-block min-w-[110px] text-slate-700">E-mail:</strong> {os.customer_email || '—'}</p>
            <p className="text-sm m-1"><strong className="inline-block min-w-[110px] text-slate-700">Telefone:</strong> {os.customer_phone || '—'}</p>
          </section>

          {/* Endereço */}
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200 pb-1 mb-2">Endereço de Entrega</h2>
            <p className="text-sm m-0">{os.delivery_address || '—'}</p>
          </section>

          {/* Itens */}
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200 pb-1 mb-2">
              Itens para Separação ({items.length})
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-emerald-50 text-emerald-800">
                  <th className="text-left p-2 border-b-2 border-emerald-500 text-xs uppercase tracking-wide w-12">#</th>
                  <th className="text-left p-2 border-b-2 border-emerald-500 text-xs uppercase tracking-wide">Medicamento</th>
                  <th className="text-center p-2 border-b-2 border-emerald-500 text-xs uppercase tracking-wide w-20">Qtd.</th>
                  <th className="text-left p-2 border-b-2 border-emerald-500 text-xs uppercase tracking-wide w-40">Receita</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-slate-500 p-4">Nenhum item registrado.</td></tr>
                ) : items.map((item, i) => (
                  <tr key={i}>
                    <td className="p-2 border-b border-slate-200 text-slate-500">{i + 1}</td>
                    <td className="p-2 border-b border-slate-200">{item.name}</td>
                    <td className="p-2 border-b border-slate-200 text-center">{item.quantity}</td>
                    <td className="p-2 border-b border-slate-200 font-mono text-xs">{item.prescriptionId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Aviso */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded text-amber-900 text-sm mb-8">
            <strong>⚠ Atenção:</strong> Medicamentos controlados — requer assinatura do paciente ou responsável na entrega. Conferir documento com foto antes de entregar.
          </div>

          {/* Assinaturas */}
          <div className="flex justify-around mt-12">
            <div className="w-56 border-t border-slate-800 pt-1.5 text-center text-xs text-slate-500">
              Responsável pela Separação
            </div>
            <div className="w-56 border-t border-slate-800 pt-1.5 text-center text-xs text-slate-500">
              Responsável pela Entrega
            </div>
          </div>

        </div>
      </div>

      {/* Estilos de impressão */}
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
