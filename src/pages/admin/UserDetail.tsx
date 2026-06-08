import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminQueries, supabaseAdmin } from '@/integrations/supabase/adminClient';
import { formatOrderStatus, formatSubscriptionStatus, formatBillingCycle } from '@/lib/labels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, Crown, Stethoscope, HeartPulse } from 'lucide-react';


export default function AdminUserDetail() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [singlePurchases, setSinglePurchases] = useState([]);
  const [addingCredit, setAddingCredit] = useState(false);
  const [checkups, setCheckups] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        // Busca dados do usuário e dados locais
        const [usersRes, ordersRes] = await Promise.all([
          AdminQueries.getAllUsers(),
          AdminQueries.getOrdersByUserId(userId),
        ]);
        const userData = (usersRes.data || []).find((u) => u.id === userId);
        setUser(userData || null);
        setOrders(ordersRes.data || []);

        // Buscar plano contratado
        const { data: planData } = await supabaseAdmin
          .from('user_subscriptions')
          .select(`id, status, expires_at, billing_cycle, plan:subscription_plans(id, name, type, description, price_monthly, price_yearly)`) 
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();
        setPlan(planData || null);

        // Buscar compras avulsas (consultation_credits)
        const { data: creditsData } = await supabaseAdmin
          .from('consultation_credits')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        setSinglePurchases(creditsData || []);

        // Buscar check-ups realizados
        const { data: checkupsData } = await supabaseAdmin
          .from('checkup_usages')
          .select('*')
          .eq('user_id', userId)
          .order('performed_at', { ascending: false });
        setCheckups(checkupsData || []);

        setConsultations([]);
        setPrescriptions([]);
        setLoading(false);
      } catch (err) {
        toast({ title: 'Erro', description: 'Falha ao buscar dados do usuário', variant: 'destructive' });
        setLoading(false);
      }
    })();
  }, [userId]);

  const handleAddCredit = async (type: 'general' | 'specialist') => {
    if (!userId) return;
    setAddingCredit(true);
    try {
      const creditType = type === 'general' ? 'clinico_geral' : 'especialista';
      const { error } = await supabaseAdmin
        .from('consultation_credits')
        .insert({
          user_id: userId,
          type: creditType,
          amount: type === 'general' ? 59.90 : 119.90, // R$ 59,90 ou R$ 119,90
          status: 'available'
        });
      
      if (error) throw error;
      
      toast({ title: 'Sucesso', description: `Crédito de ${type === 'general' ? 'clínico geral' : 'especialista'} adicionado com sucesso!` });
      
      // Recarregar créditos
      const { data: creditsData } = await supabaseAdmin
        .from('consultation_credits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setSinglePurchases(creditsData || []);
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao adicionar crédito', variant: 'destructive' });
    } finally {
      setAddingCredit(false);
    }
  };

  const handleRemoveCredit = async (creditId: string) => {
    if (!userId) return;
    try {
      const { error } = await supabaseAdmin
        .from('consultation_credits')
        .delete()
        .eq('id', creditId);
      
      if (error) throw error;
      
      toast({ title: 'Sucesso', description: 'Crédito removido com sucesso!' });
      
      // Recarregar créditos
      const { data: creditsData } = await supabaseAdmin
        .from('consultation_credits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setSinglePurchases(creditsData || []);
    } catch (err) {
      toast({ title: 'Erro', description: 'Falha ao remover crédito', variant: 'destructive' });
    }
  };

  if (loading) return <div>Carregando...</div>;
  if (!user) return <div>Usuário não encontrado.</div>;

  const consultasRealizadas = consultations.filter((c: any) => {
    const status = (c.status || c.situacao || '').toString().toUpperCase();
    const desc = (c.situacaoAtendimentoDescricao || '').toLowerCase();
    return status === 'CONCLUIDO' || desc.includes('conclu') || desc.includes('finaliz');
  }).length;

  return (
    <div className="space-y-8">
      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Plano contratado</CardTitle>
            <Crown className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {plan?.plan?.name || <span className="text-muted-foreground">Sem plano ativo</span>}
            </div>
            {plan && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatSubscriptionStatus(plan.status)} · {formatBillingCycle(plan.billing_cycle)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Consultas realizadas</CardTitle>
            <Stethoscope className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consultasRealizadas}</div>
            <p className="text-xs text-muted-foreground mt-1">de {consultations.length} agendadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Check-ups realizados</CardTitle>
            <HeartPulse className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{checkups.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {checkups.length === 0 ? 'Nenhum registrado' : 'Último: ' + new Date(checkups[0].performed_at).toLocaleDateString('pt-BR')}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Usuário</CardTitle>
        </CardHeader>
        <CardContent>
          <div><b>Nome:</b> {user.full_name}</div>
          <div><b>Email:</b> {user.email}</div>
          <div><b>Papel:</b> {user.role}</div>
          <div><b>Data de criação:</b> {new Date(user.created_at).toLocaleString('pt-BR')}</div>
        </CardContent>
      </Card>

      {/* Plano Contratado */}
      <Card>
        <CardHeader>
          <CardTitle>Plano Contratado</CardTitle>
        </CardHeader>
        <CardContent>
          {plan ? (
            <div className="space-y-2">
              <div><b>Plano:</b> {plan.plan?.name || 'N/A'}</div>
              <div><b>Tipo:</b> {plan.plan?.type === 'monthly' ? 'Mensal' : 'Anual'}</div>
              <div><b>Status:</b> {formatSubscriptionStatus(plan.status)}</div>
              <div><b>Expira em:</b> {plan.expires_at ? new Date(plan.expires_at).toLocaleString('pt-BR') : 'N/A'}</div>
              <div><b>Ciclo de cobrança:</b> {formatBillingCycle(plan.billing_cycle)}</div>
            </div>
          ) : (
            <div className="text-gray-500">Nenhum plano ativo contratado</div>
          )}
        </CardContent>
      </Card>

      {/* Créditos de Consulta */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Créditos de Consulta</CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleAddCredit('general')}
              disabled={addingCredit}
            >
              {addingCredit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Clínico Geral
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => handleAddCredit('specialist')}
              disabled={addingCredit}
            >
              {addingCredit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Especialista
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {singlePurchases.length === 0 ? (
                <TableRow><TableCell colSpan={4}>Nenhum crédito encontrado</TableCell></TableRow>
              ) : singlePurchases.map((credit: any) => (
                <TableRow key={credit.id}>
                  <TableCell>
                    {credit.type === 'clinico_geral' ? 'Clínico Geral' : 
                     credit.type === 'especialista' ? 'Especialista' : 
                     credit.type}
                  </TableCell>
                  <TableCell>{credit.status === 'available' ? 'Disponível' : 
                             credit.status === 'used' ? 'Usado' : 
                             credit.status === 'expired' ? 'Expirado' : 
                             credit.status === 'refunded' ? 'Reembolsado' : 
                             credit.status}</TableCell>
                  <TableCell>{credit.created_at ? new Date(credit.created_at).toLocaleString('pt-BR') : '-'}</TableCell>
                  <TableCell>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleRemoveCredit(credit.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Histórico de Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow><TableCell colSpan={4}>Nenhum pedido encontrado</TableCell></TableRow>
              ) : orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{order.id}</TableCell>
                  <TableCell>{formatOrderStatus(order.status)}</TableCell>
                  <TableCell>{new Date(order.created_at).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>R$ {order.total?.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Consultas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Tipo Profissional</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Descrição Status</TableHead>
                <TableHead>Data Criação</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultations.length === 0 ? (
                <TableRow><TableCell colSpan={11}>Nenhuma consulta encontrada</TableCell></TableRow>
              ) : consultations.map((c) => {
                // Normaliza status
                let status = c.status || c.situacao;
                if (!status && c.situacaoAtendimentoDescricao) {
                  const desc = c.situacaoAtendimentoDescricao.toLowerCase();
                  if (desc.includes('cancelad')) status = 'CANCELADO';
                  else if (desc.includes('conclu') || desc.includes('finaliz')) status = 'CONCLUIDO';
                  else if (desc.includes('aguard') || desc.includes('espera')) status = 'AGUARDANDO';
                  else if (desc.includes('em atendimento') || desc.includes('andamento')) status = 'EM_ATENDIMENTO';
                  else status = c.situacaoAtendimentoDescricao;
                }
                return (
                  <TableRow key={c.id}>
                    <TableCell>{c.id}</TableCell>
                    <TableCell>{c.pacienteNome}</TableCell>
                    <TableCell>{c.pacienteCpf || '-'}</TableCell>
                    <TableCell>{c.profissionalNome || '-'}</TableCell>
                    <TableCell>{c.especialidadeNome || '-'}</TableCell>
                    <TableCell>{c.tipoProfissionalId || '-'}</TableCell>
                    <TableCell>{status}</TableCell>
                    <TableCell>{c.situacaoAtendimentoDescricao || '-'}</TableCell>
                    <TableCell>{c.dataHoraCriacao ? new Date(c.dataHoraCriacao).toLocaleString('pt-BR') : (c.dataCriacao ? new Date(c.dataCriacao).toLocaleString('pt-BR') : '-')}</TableCell>
                    <TableCell>{c.dataHoraInicio ? new Date(c.dataHoraInicio).toLocaleString('pt-BR') : '-'}</TableCell>
                    <TableCell>{c.dataHoraFim ? new Date(c.dataHoraFim).toLocaleString('pt-BR') : '-'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Check-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Laboratório</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Ciclo</TableHead>
                <TableHead>Registrado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checkups.length === 0 ? (
                <TableRow><TableCell colSpan={5}>Nenhum check-up realizado</TableCell></TableRow>
              ) : checkups.map((ck: any) => (
                <TableRow key={ck.id}>
                  <TableCell>{ck.performed_at ? new Date(ck.performed_at).toLocaleString('pt-BR') : '-'}</TableCell>
                  <TableCell>{ck.lab_name || '-'}</TableCell>
                  <TableCell>{ck.plan_type || '-'}</TableCell>
                  <TableCell>{ck.billing_cycle ? formatBillingCycle(ck.billing_cycle) : '-'}</TableCell>
                  <TableCell>{ck.performed_by_name || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Receitas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consulta</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prescriptions.length === 0 ? (
                <TableRow><TableCell colSpan={5}>Nenhuma receita encontrada</TableCell></TableRow>
              ) : prescriptions.map((rx: any) => (
                <TableRow key={rx.id}>
                  <TableCell>#{rx.consultationId}</TableCell>
                  <TableCell>{rx.doctor_name}</TableCell>
                  <TableCell>{rx.especialidade}</TableCell>
                  <TableCell>{rx.created_at ? new Date(rx.created_at).toLocaleString('pt-BR') : '-'}</TableCell>
                  <TableCell>
                    {rx.urlPdf ? (
                      <a href={rx.urlPdf} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        Abrir
                      </a>
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
