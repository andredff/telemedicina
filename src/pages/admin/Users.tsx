import { useEffect, useState } from 'react';
import { AdminQueries, RBAC } from '@/integrations/supabase/adminClient';
import { logger } from "@/lib/logger";
import { supabase } from '@/integrations/supabase/client';
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
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Search, Edit, Trash2, UserCheck, Shield, Stethoscope, Heart, Users, RefreshCw, KeyRound } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  last_login?: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await AdminQueries.getAllUsers();
      
      if (error) throw error;
      
      const usersWithRoles = (data || []).map((user: Record<string, unknown>) => ({ 
        id: user.id as string,
        email: user.email as string,
        full_name: (user.full_name as string) || (user.email as string),
        role: (user.role as string) || 'patient',
        created_at: user.created_at as string,
        last_login: user.last_login as string | undefined,
      }));
      
      setUsers(usersWithRoles);
      setLoading(false);
    } catch (error) {
      logger.error('Error fetching users:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao buscar usuários',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleEditUser = (user: User) => {
    setEditingUser({ ...user });
    setIsDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!editingUser) return;
    setIsResettingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/users/${editingUser.id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = result.error || (response.status === 502 || response.status === 503 || response.status === 500
          ? "Servidor backend indisponível. Execute: node server/cielo-server.js"
          : "Erro ao resetar senha");
        throw new Error(msg);
      }
      toast({
        title: "E-mail enviado",
        description: `Link de redefinição enviado para ${result.email}`,
      });
    } catch (error) {
      logger.error("Error resetting password:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao enviar e-mail de recuperação",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSaveUser = async () => {
    try {
      if (!editingUser) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }
      
      // Update user role
      const success = await RBAC.updateUserRole(
        editingUser.id,
        editingUser.role,
        user.id
      );
      
      if (success) {
        toast({
          title: 'Sucesso',
          description: 'Usuário atualizado com sucesso'
        });
        fetchUsers();
        setIsDialogOpen(false);
      } else {
        toast({
          title: 'Erro',
          description: 'Falha ao atualizar usuário',
          variant: 'destructive'
        });
      }
    } catch (error) {
      logger.error('Error updating user:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar usuário',
        variant: 'destructive'
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'doctor': return <Stethoscope className="h-4 w-4" />;
      case 'support': return <Heart className="h-4 w-4" />;
      default: return <UserCheck className="h-4 w-4" />;
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'doctor': return 'Médico';
      case 'support': return 'Suporte';
      default: return 'Paciente';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'doctor': return 'bg-blue-100 text-blue-800';
      case 'support': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
        <p className="text-gray-600">Gerencie todos os usuários da plataforma Novità</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuários..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por papel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os papéis</SelectItem>
            <SelectItem value="admin">Administradores</SelectItem>
            <SelectItem value="doctor">Médicos</SelectItem>
            <SelectItem value="support">Suporte</SelectItem>
            <SelectItem value="patient">Pacientes</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" onClick={fetchUsers} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>

        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingUser(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nome</label>
                  <Input value={editingUser.full_name} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <Input value={editingUser.email} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Papel</label>
                  <Select
                    value={editingUser.role}
                    onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patient">Paciente</SelectItem>
                      <SelectItem value="doctor">Médico</SelectItem>
                      <SelectItem value="support">Suporte</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveUser} className="flex-1">
                    Salvar Alterações
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleResetPassword}
                    disabled={isResettingPassword}
                    className="gap-2"
                    title="Enviar e-mail de redefinição de senha"
                  >
                    <KeyRound className="h-4 w-4" />
                    {isResettingPassword ? "Enviando..." : "Resetar Senha"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Data de Criação</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                    Carregando usuários...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.full_name}</div>
                    <div className="text-sm text-gray-500">ID: {user.id.slice(0, 8)}...</div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-sm ${getRoleColor(user.role)}`}>
                      {getRoleIcon(user.role)}
                      {getRoleName(user.role)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/admin/usuarios/${user.id}`, '_self')}
                        title="Ver detalhes do usuário"
                      >
                        <UserCheck className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        disabled
                        title="Remoção de usuário não implementada neste MVP"
                      >
                        <Trash2 className="h-4 w-4" />
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
      <div className="flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</div>
          </CardContent>
        </Card>
        
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Médicos</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'doctor').length}</div>
          </CardContent>
        </Card>
        
        <Card className="flex-1 min-w-[200px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pacientes</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'patient').length}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
