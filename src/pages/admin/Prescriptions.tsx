import { useEffect, useState } from 'react';
import { AdminQueries } from '@/integrations/supabase/adminClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Search, FileText, CheckCircle2, Clock, AlertCircle, Eye, Edit } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function AdminPrescriptions() {
  const [prescriptions, setPrescriptions] = useState<{ id: string; patient: string; doctor: string; date: string; status: string; medications: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const { data, error } = await AdminQueries.getAllPrescriptions();
      
      if (error) throw error;
      
      // Use real status from database (remove mock status generation)
      const prescriptionsWithStatus = data.map(prescription => ({
        ...prescription,
        // Status should come from the database, not be randomly generated
        status: prescription.status || 'pending' // Default to 'pending' if no status exists
      }));
      
      setPrescriptions(prescriptionsWithStatus);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao buscar receitas',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const filteredPrescriptions = prescriptions.filter(prescription => {
    const matchesSearch = prescription.id.includes(searchTerm) || 
                         prescription.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prescription.doctor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || prescription.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { text: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-4 w-4" /> },
      approved: { text: 'Aprovada', color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-4 w-4" /> },
      rejected: { text: 'Rejeitada', color: 'bg-red-100 text-red-800', icon: <AlertCircle className="h-4 w-4" /> },
      expired: { text: 'Expirada', color: 'bg-gray-100 text-gray-800', icon: <AlertCircle className="h-4 w-4" /> }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
                   statusConfig.pending;
    
    return (
      <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${config.color}`}>
        {config.icon}
        {config.text}
      </div>
    );
  };

  const handleStatusChange = async (prescriptionId: string, newStatus: string) => {
    try {
      // In a real app, this would update the prescription status in the database
      // For now, we'll just update locally
      setPrescriptions(prescriptions.map(prescription => 
        prescription.id === prescriptionId ? { ...prescription, status: newStatus } : prescription
      ));
      
      toast({
        title: 'Sucesso',
        description: 'Status da receita atualizado'
      });
    } catch (error) {
      console.error('Error updating prescription status:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar status da receita',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gerenciamento de Receitas</h1>
        <p className="text-gray-600">Gerencie todas as receitas médicas da plataforma</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar receitas por ID, paciente ou médico..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="approved">Aprovada</SelectItem>
            <SelectItem value="rejected">Rejeitada</SelectItem>
            <SelectItem value="expired">Expirada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Prescriptions Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID da Receita</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Médico</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                    Carregando receitas...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPrescriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  Nenhuma receita encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredPrescriptions.map((prescription) => (
                <TableRow key={prescription.id}>
                  <TableCell className="font-mono text-sm">#{prescription.id.slice(0, 8)}...</TableCell>
                  <TableCell>{prescription.patient_name}</TableCell>
                  <TableCell>
                    <div>{prescription.doctor_name}</div>
                    <div className="text-sm text-gray-500">CRM: {prescription.doctor_crm}</div>
                  </TableCell>
                  <TableCell>
                    {new Date(prescription.date).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(prescription.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Select
                        value={prescription.status}
                        onValueChange={(value) => handleStatusChange(prescription.id, value)}
                      >
                        <SelectTrigger className="w-[140px] text-sm">
                          <SelectValue placeholder="Alterar status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="approved">Aprovar</SelectItem>
                          <SelectItem value="rejected">Rejeitar</SelectItem>
                          <SelectItem value="expired">Expirar</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Receitas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prescriptions.length}</div>
          </CardContent>
        </Card>
        
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prescriptions.filter(p => p.status === 'pending').length}</div>
          </CardContent>
        </Card>
        
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prescriptions.filter(p => p.status === 'approved').length}</div>
          </CardContent>
        </Card>
        
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prescriptions.filter(p => p.status === 'rejected').length}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper Card component for the summary section
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border rounded-lg p-4 ${className}`}>
      {children}
    </div>
  );
}