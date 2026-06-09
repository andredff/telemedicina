import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ClipboardList, CheckCircle, Clock, ArrowRight,
  User, Calendar, Plus, Video, FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConsultaSummary {
  id: string;
  patient_name: string;
  date: string;
  status: string;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function statusConfig(status: string) {
  switch (status) {
    case 'pending':
      return { label: 'Aguardando', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'in_progress':
      return { label: 'Em Atendimento', cls: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'completed':
      return { label: 'Concluída', cls: 'bg-green-100 text-green-700 border-green-200' };
    default:
      return { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  }
}

function formatDate(d: string) {
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
}

export default function MedicoDashboard() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('Médico');
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, completed: 0 });
  const [recent, setRecent] = useState<ConsultaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        const name = profile?.full_name || user.email || 'Médico';
        setFirstName(name.split(' ')[0]);

        const { data: consultations } = await supabase
          .from('consultations')
          .select('id, patient_name, date, status')
          .order('created_at', { ascending: false })
          .limit(50);

        const all = consultations ?? [];
        setStats({
          pending: all.filter(c => c.status === 'pending').length,
          inProgress: all.filter(c => c.status === 'in_progress').length,
          completed: all.filter(c => c.status === 'completed').length,
        });
        setRecent(all.slice(0, 6));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const todayStr = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-muted-foreground capitalize">{todayStr}</p>
          <h1 className="text-2xl font-bold text-foreground mt-0.5">
            {getGreeting()}, Dr(a). {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.pending > 0
              ? `Você tem ${stats.pending} paciente${stats.pending > 1 ? 's' : ''} aguardando atendimento.`
              : 'Nenhum paciente aguardando no momento.'}
          </p>
        </div>
        <Button className="gap-2 shrink-0" onClick={() => navigate('/medico/consultas')}>
          <Plus className="h-4 w-4" />
          Nova Consulta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Aguardando',
            value: stats.pending,
            icon: Clock,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            route: '/medico/consultas',
          },
          {
            label: 'Em Atendimento',
            value: stats.inProgress,
            icon: Video,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            route: '/medico/consultas',
          },
          {
            label: 'Concluídas',
            value: stats.completed,
            icon: CheckCircle,
            iconBg: 'bg-green-50',
            iconColor: 'text-green-600',
            route: '/medico/historico',
          },
        ].map(({ label, value, icon: Icon, iconBg, iconColor, route }) => (
          <Card
            key={label}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(route)}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{value}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/medico/consultas')}
          className="flex items-center gap-4 p-5 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">Ver Consultas Pendentes</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.pending > 0 ? `${stats.pending} paciente${stats.pending > 1 ? 's' : ''} aguardando` : 'Nenhuma pendente'}
            </p>
          </div>
        </button>

        <button
          onClick={() => navigate('/medico/historico')}
          className="flex items-center gap-4 p-5 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300 transition-all text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">Histórico de Atendimentos</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stats.completed} atendimento{stats.completed !== 1 ? 's' : ''} realizado{stats.completed !== 1 ? 's' : ''}</p>
          </div>
        </button>
      </div>

      {/* Recent consultations */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-semibold text-foreground">Consultas Recentes</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary h-8 px-2 gap-1 text-xs"
            onClick={() => navigate('/medico/consultas')}
          >
            Ver todas <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : recent.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Nenhuma consulta registrada ainda.</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/medico/consultas')}>
                Ir para Consultas
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recent.map((c) => {
                const { label, cls } = statusConfig(c.status);
                const canClick = c.status === 'pending' || c.status === 'in_progress';
                return (
                  <div
                    key={c.id}
                    onClick={() => canClick && navigate(`/medico/atendimento/${c.id}`)}
                    className={`flex items-center justify-between px-6 py-3.5 transition-colors ${canClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{c.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(c.date)}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
