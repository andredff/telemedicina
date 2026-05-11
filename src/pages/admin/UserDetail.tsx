import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminQueries, supabaseAdmin } from '@/integrations/supabase/adminClient';
import { formatOrderStatus, formatSubscriptionStatus, formatPrescriptionStatus, formatBillingCycle } from '@/lib/labels';
import { assemedClient } from '@/integrations/assemed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2 } from 'lucide-react';


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

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        // Busca dados do usuário e dados locais
        const [usersRes, ordersRes, prescriptionsRes] = await Promise.all([
          AdminQueries.getAllUsers(),
          AdminQueries.getOrdersByUserId(userId),
          AdminQueries.getAllPrescriptions()
        ]);
        const userData = (usersRes.data || []).find((u) => u.id === userId);
        setUser(userData || null);
        setOrders(ordersRes.data || []);
        setPrescriptions((prescriptionsRes.data || []).filter((p) => p.patient_id === userId));

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

        // Buscar histórico de consultas reais do Assemed
        let assemedConsultations = [];
        if (userData && (userData.cpf || userData.email)) {
          let cpf = userData.cpf;
          if (!cpf && userData.email && userData.email.includes('+')) {
            // Exemplo: paciente+andredff4@novitatelemedicina.com.br
            const match = userData.email.match(/\+([0-9]+)/);
            if (match) cpf = match[1];
          }
          if (cpf && cpf.length >= 8) {
            try {
              // Remove pontuação do CPF
              const cleanCpf = cpf.replace(/\D/g, "");
              // Login externo para obter accessToken
              const loginResp = await assemedClient.login(cleanCpf);
              if (loginResp && loginResp.accessToken) {
                assemedClient.setAccessToken(loginResp.accessToken);
                // Buscar consultas reais do Assemed
                const response = await assemedClient.getConsultations(50, 0);
                if (response && response.items) {
                  assemedConsultations = response.items;
                }
              }
            } catch (err) {
              // Se der erro, ignora e mostra só as locais
            }
          }
        }
        setConsultations(assemedConsultations);
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

  return (
    <div className="space-y-8">
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
          <CardTitle>Histórico de Receitas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prescriptions.length === 0 ? (
                <TableRow><TableCell colSpan={4}>Nenhuma receita encontrada</TableCell></TableRow>
              ) : prescriptions.map((rx) => (
                <TableRow key={rx.id}>
                  <TableCell>{rx.id}</TableCell>
                  <TableCell>{rx.doctor_name || rx.doctor}</TableCell>
                  <TableCell>{formatPrescriptionStatus(rx.status)}</TableCell>
                  <TableCell>{new Date(rx.created_at).toLocaleString('pt-BR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
