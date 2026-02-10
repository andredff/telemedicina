import { useEffect, useState } from 'react';
import { AdminQueries } from '@/integrations/supabase/adminClient';
import { logger } from "@/lib/logger";
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, FileText, CheckCircle2, Clock, AlertCircle, Eye, Edit, X, Calendar, User, Pill } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabaseAdmin } from '@/integrations/supabase/adminClient';

interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
}

interface Prescription {
  id: string;
  patient: string;
  patient_id?: string;
  doctor: string;
  doctor_name?: string;
  doctor_crm?: string;
  date: string;
  status: string;
  medications: number | Medication[];
  expires_at?: string;
  created_at?: string;
  notes?: string;
  diagnosis?: string;
}

export default function AdminPrescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const { data, error } = await AdminQueries.getAllPrescriptions();
      
      if (error) throw error;
      
      // Format prescriptions data to match expected interface
      const formattedPrescriptions = (data || []).map((prescription: Record<string, unknown>) => ({
        id: prescription.id as string,
        patient: (prescription.patient_name as string) || (prescription.patient as string) || 'Paciente Desconhecido',
        patient_id: (prescription.user_id as string) || (prescription.patient_id as string),
        doctor: (prescription.doctor_name as string) || (prescription.doctor as string) || 'Médico Desconhecido',
        doctor_name: prescription.doctor_name as string,
        doctor_crm: prescription.doctor_crm as string,
        date: (prescription.date as string) || (prescription.created_at as string),
        status: (prescription.status as string) || 'pending',
        medications: (prescription.medications as number | Medication[]) || 0,
        expires_at: prescription.expires_at as string,
        created_at: prescription.created_at as string,
        notes: prescription.notes as string,
        diagnosis: prescription.diagnosis as string,
      }));
      
      setPrescriptions(formattedPrescriptions);
      setLoading(false);
    } catch (error) {
      logger.error('Error fetching prescriptions:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao buscar receitas',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const filteredPrescriptions = prescriptions.filter(prescription => {
    const matchesSearch = prescription.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         prescription.patient.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prescription.doctor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || prescription.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { text: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-4 w-4" /> },
      partial: { text: 'Parcial', color: 'bg-orange-100 text-orange-800', icon: <AlertCircle className="h-4 w-4" /> },
      completed: { text: 'Completa', color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-4 w-4" /> },
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
      setUpdatingStatus(prescriptionId);
      
      // Update in database if Supabase is configured
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin
          .from('prescriptions')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', prescriptionId);
        
        if (error) throw error;
      }
      
      // Update local state
      setPrescriptions(prescriptions.map(prescription => 
        prescription.id === prescriptionId ? { ...prescription, status: newStatus } : prescription
      ));
      
      toast({
        title: 'Sucesso',
        description: 'Status da receita atualizado com sucesso'
      });
    } catch (error) {
      logger.error('Error updating prescription status:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar status da receita',
        variant: 'destructive'
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleViewPrescription = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setViewDialogOpen(true);
  };

  const getMedicationCount = (medications: number | Medication[]) => {
    if (Array.isArray(medications)) {
      return medications.length;
    }
    return medications;
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
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="completed">Completa</SelectItem>
          </SelectContent>
        </Select>
        
        <Button onClick={fetchPrescriptions} variant="outline">
          Atualizar
        </Button>
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
              <TableHead>Medicamentos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                    Carregando receitas...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPrescriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4">
                  Nenhuma receita encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredPrescriptions.map((prescription) => (
                <TableRow key={prescription.id}>
                  <TableCell className="font-mono text-sm">
                    #{prescription.id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{prescription.patient}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{prescription.doctor}</div>
                    {prescription.doctor_crm && (
                      <div className="text-sm text-gray-500">CRM: {prescription.doctor_crm}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      {new Date(prescription.date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </div>
                    {prescription.expires_at && (
                      <div className="text-xs text-gray-500">
                        Expira: {new Date(prescription.expires_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {getMedicationCount(prescription.medications)} {getMedicationCount(prescription.medications) === 1 ? 'medicamento' : 'medicamentos'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(prescription.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Select
                        value={prescription.status}
                        onValueChange={(value) => handleStatusChange(prescription.id, value)}
                        disabled={updatingStatus === prescription.id}
                      >
                        <SelectTrigger className="w-[140px] text-sm">
                          <SelectValue placeholder="Alterar status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="partial">Parcial</SelectItem>
                          <SelectItem value="completed">Completa</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewPrescription(prescription)}
                      >
                        <Eye className="h-4 w-4" />
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Receitas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prescriptions.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prescriptions.filter(p => p.status === 'pending').length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parciais</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {prescriptions.filter(p => p.status === 'partial').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prescriptions.filter(p => p.status === 'completed').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* View Prescription Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes da Receita
            </DialogTitle>
            <DialogDescription>
              Visualização completa da receita médica
            </DialogDescription>
          </DialogHeader>
          
          {selectedPrescription && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ID da Receita</label>
                  <p className="font-mono text-sm mt-1">{selectedPrescription.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(selectedPrescription.status)}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Patient Info */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <User className="h-4 w-4" />
                  Informações do Paciente
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Nome</label>
                    <p className="mt-1">{selectedPrescription.patient}</p>
                  </div>
                </div>
              </div>

              {/* Doctor Info */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <User className="h-4 w-4" />
                  Informações do Médico
                </h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Nome</label>
                      <p className="mt-1">{selectedPrescription.doctor}</p>
                    </div>
                    {selectedPrescription.doctor_crm && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">CRM</label>
                        <p className="mt-1">{selectedPrescription.doctor_crm}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4" />
                  Datas
                </h3>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Data de Emissão</label>
                      <p className="mt-1">
                        {new Date(selectedPrescription.date).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                    {selectedPrescription.expires_at && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Data de Expiração</label>
                        <p className="mt-1">
                          {new Date(selectedPrescription.expires_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Medications */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Pill className="h-4 w-4" />
                  Medicamentos Prescritos
                </h3>
                <div className="space-y-3">
                  {Array.isArray(selectedPrescription.medications) ? (
                    selectedPrescription.medications.map((med, index) => (
                      <div key={index} className="bg-muted/50 rounded-lg p-4">
                        <div className="font-medium">{med.name}</div>
                        {med.dosage && (
                          <div className="text-sm text-muted-foreground mt-1">Dosagem: {med.dosage}</div>
                        )}
                        {med.frequency && (
                          <div className="text-sm text-muted-foreground">Frequência: {med.frequency}</div>
                        )}
                        {med.duration && (
                          <div className="text-sm text-muted-foreground">Duração: {med.duration}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-muted/50 rounded-lg p-4 text-center text-muted-foreground">
                      {getMedicationCount(selectedPrescription.medications)} medicamento(s) prescrito(s)
                    </div>
                  )}
                </div>
              </div>

              {/* Diagnosis & Notes */}
              {(selectedPrescription.diagnosis || selectedPrescription.notes) && (
                <div>
                  <h3 className="font-semibold mb-3">Observações</h3>
                  <div className="space-y-3">
                    {selectedPrescription.diagnosis && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <label className="text-sm font-medium text-muted-foreground">Diagnóstico</label>
                        <p className="mt-1">{selectedPrescription.diagnosis}</p>
                      </div>
                    )}
                    {selectedPrescription.notes && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <label className="text-sm font-medium text-muted-foreground">Notas Adicionais</label>
                        <p className="mt-1">{selectedPrescription.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
