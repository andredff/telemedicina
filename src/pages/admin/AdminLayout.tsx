import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RBAC } from '@/integrations/supabase/adminClient';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  FileText, 
  BookOpen, 
  BarChart2, 
  Settings, 
  LifeBuoy, 
  LogOut 
} from 'lucide-react';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeMenu, setActiveMenu] = useState<string>('dashboard');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }
      
      setUser(user);
      
      // Check if user is admin
      const adminCheck = await RBAC.isAdmin(user.id);
      setIsAdmin(adminCheck);
      
      if (!adminCheck) {
        navigate('/dashboard');
        return;
      }
      
      setLoading(false);
    };
    
    checkAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const menuItems = [
    { id: 'dashboard', icon: <LayoutDashboard className="h-5 w-5" />, label: 'Dashboard', path: '/admin' },
    { id: 'users', icon: <Users className="h-5 w-5" />, label: 'Usuários', path: '/admin/usuarios' },
    { id: 'orders', icon: <ShoppingCart className="h-5 w-5" />, label: 'Pedidos', path: '/admin/pedidos' },
    { id: 'prescriptions', icon: <FileText className="h-5 w-5" />, label: 'Receitas', path: '/admin/receitas' },
    { id: 'content', icon: <BookOpen className="h-5 w-5" />, label: 'Conteúdo', path: '/admin/conteudo' },
    { id: 'reports', icon: <BarChart2 className="h-5 w-5" />, label: 'Relatórios', path: '/admin/relatorios' },
    { id: 'settings', icon: <Settings className="h-5 w-5" />, label: 'Configurações', path: '/admin/configuracoes' },
    { id: 'support', icon: <LifeBuoy className="h-5 w-5" />, label: 'Suporte', path: '/admin/suporte' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Acesso não autorizado</h2>
          <p className="text-gray-600 mb-6">Você não tem permissão para acessar esta área.</p>
          <Button onClick={() => navigate('/dashboard')}>Voltar para Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary">Novità Admin</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <nav className="p-4">
            <div className="space-y-1">
              {menuItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeMenu === item.id ? 'secondary' : 'ghost'}
                  className={`w-full justify-start ${activeMenu === item.id ? 'bg-primary/10' : 'hover:bg-gray-100'}`}
                  onClick={() => {
                    setActiveMenu(item.id);
                    navigate(item.path);
                  }}
                >
                  {item.icon}
                  <span className="ml-3">{item.label}</span>
                </Button>
              ))}
            </div>
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-medium">{user.email?.[0].toUpperCase()}</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{user.email}</p>
              <p className="text-xs text-gray-500">Administrador</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sair
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}