import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminQueries } from '@/integrations/supabase/adminClient';
import { assemedClient } from '@/integrations/assemed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';


export default function AdminUserDetail() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

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
                  <TableCell>{order.status}</TableCell>
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
                  <TableCell>{rx.status}</TableCell>
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
