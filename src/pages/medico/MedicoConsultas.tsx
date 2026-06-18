import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Video, CheckCircle, XCircle, Search,
  RefreshCw, Calendar, FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type TabKey = 'andamento' | 'finalizadas' | 'canceladas';

interface Consultation {
  id: string;
  patient_name: string;
  date: string;
  status: string;
  doctor_name: string;
  created_at: string;
  updated_at?: string | null;
  number?: number | null;
}

function formatDate(d: string) {
  try { return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return d; }
}

function getInitials(name: string) {
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const TAB_META: Record<TabKey, { label: string; status: string; icon: React.ElementType; color: string; emptyMsg: string }> = {
  andamento: {
    label: 'Em andamento', status: 'in_consultation', icon: Video,
    color: 'text-blue-600', emptyMsg: 'Nenhuma consulta em andamento.',
  },
  finalizadas: {
    label: 'Finalizadas', status: 'completed', icon: CheckCircle,
    color: 'text-green-600', emptyMsg: 'Nenhuma consulta finalizada ainda.',
  },
  canceladas: {
    label: 'Canceladas', status: 'cancelled', icon: XCircle,
    color: 'text-red-500', emptyMsg: 'Nenhuma consulta cancelada.',
  },
};

export default function MedicoConsultas() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get('tab') as TabKey) || 'andamento';
  const setTab = (t: TabKey) => setSearchParams(t === 'andamento' ? {} : { tab: t });

  const [all, setAll] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('consultations')
        .select('id, patient_name, date, status, doctor_name, created_at, updated_at, number')
        .in('status', ['in_consultation', 'completed', 'cancelled'])
        .order('created_at', { ascending: false });
      setAll((data ?? []) as unknown as Consultation[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const meta = TAB_META[tab];
  const filtered = all
    .filter(c => c.status === meta.status)
    .filter(c => !search.trim() || c.patient_name.toLowerCase().includes(search.toLowerCase()));

  const counts: Record<TabKey, number> = {
    andamento: all.filter(c => c.status === 'in_consultation').length,
    finalizadas: all.filter(c => c.status === 'completed').length,
    canceladas: all.filter(c => c.status === 'cancelled').length,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Consultas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Histórico e consultas ativas</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 border border-border/40">
        {(Object.entries(TAB_META) as [TabKey, typeof meta][]).map(([key, m]) => {
          const Icon = m.icon;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-white text-foreground shadow-sm border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`h-4 w-4 ${tab === key ? m.color : ''}`} />
              <span className="hidden sm:inline">{m.label}</span>
              {counts[key] > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  tab === key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>{counts[key]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por paciente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <meta.icon className={`mx-auto h-8 w-8 mb-3 ${meta.color} opacity-40`} />
            <p className="font-medium text-foreground mb-1">{meta.emptyMsg}</p>
            {tab === 'andamento' && (
              <p className="text-sm text-muted-foreground mt-1">
                Vá para a <button className="text-primary underline" onClick={() => navigate('/medico/sala-espera')}>Sala de Espera</button> para iniciar um atendimento.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <Card key={c.id} className={`hover:shadow-md transition-shadow ${tab === 'andamento' ? 'border-blue-200 bg-blue-50/20' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {getInitials(c.patient_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{c.patient_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(c.date)}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">#{c.number ?? c.id.slice(0, 8)}</p>
                    {c.status === 'cancelled' && (
                      <p className="text-[11px] text-red-500/80 mt-1">
                        Cancelada pelo paciente{c.updated_at ? ` · ${formatDate(c.updated_at)}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {tab === 'andamento' && (
                      <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                        onClick={() => navigate(`/medico/atendimento/${c.id}`)}>
                        <Video className="h-3.5 w-3.5" /> Continuar
                      </Button>
                    )}
                    {tab === 'finalizadas' && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                          <CheckCircle className="h-3 w-3" /> Concluída
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => navigate(`/medico/atendimento/${c.id}`)}
                        >
                          <FileText className="h-3.5 w-3.5" /> Ver detalhes
                        </Button>
                      </div>
                    )}
                    {tab === 'canceladas' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                        <XCircle className="h-3 w-3" /> Cancelada
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
