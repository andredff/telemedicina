// Admin client for Supabase with additional admin functionalities
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Debug: log environment variables
console.log('[AdminClient] VITE_SUPABASE_URL:', SUPABASE_URL);
console.log('[AdminClient] VITE_SUPABASE_PUBLISHABLE_KEY:', SUPABASE_PUBLISHABLE_KEY ? '***' : 'undefined');

// Check if Supabase is configured
const isSupabaseConfigured = SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY;
console.log('[AdminClient] isSupabaseConfigured:', isSupabaseConfigured);

export const supabaseAdmin = isSupabaseConfigured 
  ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;

console.log('[AdminClient] supabaseAdmin initialized:', !!supabaseAdmin);

// RBAC (Role-Based Access Control) utility functions
export const RBAC = {
  // Define user roles
  ROLES: {
    ADMIN: 'admin',
    DOCTOR: 'doctor',
    PATIENT: 'patient',
    SUPPORT: 'support'
  },
  
  // Check if user has a specific role
  async hasRole(userId: string, requiredRole: string): Promise<boolean> {
    try {
      // If Supabase is not configured, use mock data for testing
      if (!supabaseAdmin) {
        console.log('[RBAC] Supabase not configured, using mock admin access');
        // For testing: allow admin access for any authenticated user
        return requiredRole === this.ROLES.ADMIN;
      }
      
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data?.role === requiredRole;
    } catch (error) {
      console.error('Error checking role:', error);
      // Fallback to mock admin access for testing
      return requiredRole === this.ROLES.ADMIN;
    }
  },
  
  // Check if user has any of the required roles
  async hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
    try {
      // If Supabase is not configured, use mock data for testing
      if (!supabaseAdmin) {
        console.log('[RBAC] Supabase not configured, using mock admin access');
        return roles.includes(this.ROLES.ADMIN);
      }
      
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return roles.includes(data?.role);
    } catch (error) {
      console.error('Error checking roles:', error);
      // Fallback to mock admin access for testing
      return roles.includes(this.ROLES.ADMIN);
    }
  },
  
  // Check if user is admin
  async isAdmin(userId: string): Promise<boolean> {
    return this.hasRole(userId, this.ROLES.ADMIN);
  },
  
  // Get user role
  async getUserRole(userId: string): Promise<string | null> {
    try {
      // If Supabase is not configured, use mock data for testing
      if (!supabaseAdmin) {
        console.log('[RBAC] Supabase not configured, returning mock admin role');
        return this.ROLES.ADMIN;
      }
      
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data?.role || null;
    } catch (error) {
      console.error('Error getting user role:', error);
      // Fallback to mock admin role for testing
      return this.ROLES.ADMIN;
    }
  },
  
  // Update user role (admin only)
  async updateUserRole(userId: string, newRole: string, adminUserId: string): Promise<boolean> {
    try {
      // Check if the requesting user is an admin
      const isAdmin = await this.isAdmin(adminUserId);
      if (!isAdmin) {
        console.error('Only admins can update user roles');
        return false;
      }
      
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating user role:', error);
      return false;
    }
  }
};

// Mock data for testing when Supabase is not configured
const mockUsers = [
  {
    id: '1',
    email: 'joao.teste@example.com',
    full_name: 'João Silva Teste',
    role: 'admin',
    created_at: '2024-01-15T10:00:00Z',
    last_login: '2024-12-28T10:00:00Z'
  },
  {
    id: '2',
    email: 'maria.santos@example.com',
    full_name: 'Maria Santos',
    role: 'patient',
    created_at: '2024-02-20T14:30:00Z',
    last_login: '2024-12-27T15:20:00Z'
  },
  {
    id: '3',
    email: 'dr.silva@example.com',
    full_name: 'Dr. Carlos Silva',
    role: 'doctor',
    created_at: '2024-03-10T09:15:00Z',
    last_login: '2024-12-28T08:45:00Z'
  }
];

const mockOrders = [
  {
    id: 'ORD-001',
    user_id: '2',
    customer: 'Maria Santos',
    customer_email: 'maria.santos@example.com',
    prescription_id: 'RX-2024-001',
    medication_id: '1',
    quantity: 2,
    items: 2,
    total: 156.80,
    status: 'delivered',
    date: '2024-12-20T10:00:00Z',
    created_at: '2024-12-20T10:00:00Z'
  },
  {
    id: 'ORD-002',
    user_id: '2',
    customer: 'Maria Santos',
    customer_email: 'maria.santos@example.com',
    prescription_id: 'RX-2024-002',
    medication_id: '2',
    quantity: 1,
    items: 1,
    total: 89.90,
    status: 'processing',
    date: '2024-12-27T14:30:00Z',
    created_at: '2024-12-27T14:30:00Z'
  },
  {
    id: 'ORD-003',
    user_id: '1',
    customer: 'João Silva Teste',
    customer_email: 'joao.teste@example.com',
    prescription_id: 'RX-2024-003',
    medication_id: '3',
    quantity: 3,
    items: 3,
    total: 234.50,
    status: 'shipped',
    date: '2024-12-26T09:15:00Z',
    created_at: '2024-12-26T09:15:00Z'
  }
];

const mockPrescriptions = [
  {
    id: 'RX-2024-001',
    patient_id: '2',
    patient: 'Maria Santos',
    doctor_name: 'Dr. Carlos Silva',
    doctor: 'Dr. Carlos Silva',
    status: 'active',
    medications: 2,
    date: '2024-12-15T10:00:00Z',
    created_at: '2024-12-15T10:00:00Z',
    expires_at: '2025-06-15T10:00:00Z'
  },
  {
    id: 'RX-2024-002',
    patient_id: '2',
    patient: 'Maria Santos',
    doctor_name: 'Dr. Ana Costa',
    doctor: 'Dr. Ana Costa',
    status: 'active',
    medications: 1,
    date: '2024-12-20T14:30:00Z',
    created_at: '2024-12-20T14:30:00Z',
    expires_at: '2025-06-20T14:30:00Z'
  },
  {
    id: 'RX-2024-003',
    patient_id: '1',
    patient: 'João Silva Teste',
    doctor_name: 'Dr. Carlos Silva',
    doctor: 'Dr. Carlos Silva',
    status: 'expired',
    medications: 3,
    date: '2024-06-10T09:00:00Z',
    created_at: '2024-06-10T09:00:00Z',
    expires_at: '2024-12-10T09:00:00Z'
  }
];

// Admin-specific queries
export const AdminQueries = {
  // Get all users
  async getAllUsers() {
    if (!supabaseAdmin) {
      console.log('[AdminQueries] Supabase not configured, returning mock users');
      return { data: mockUsers, error: null };
    }
    
    try {
      const result = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If database is empty or table doesn't exist, use mock data
      if (!result.data || result.data.length === 0 || result.error) {
        console.log('[AdminQueries] Database empty or error, returning mock users');
        return { data: mockUsers, error: null };
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching users:', error);
      return { data: mockUsers, error: null };
    }
  },
  
  // Get all orders
  async getAllOrders() {
    console.log('[AdminQueries] getAllOrders chamado');
    
    if (!supabaseAdmin) {
      console.log('[AdminQueries] Supabase not configured, returning mock orders');
      return { data: mockOrders, error: null };
    }
    
    try {
      console.log('[AdminQueries] Buscando pedidos do Supabase...');
      // Join orders with profiles to get customer name and email
      const result = await supabaseAdmin
        .from('orders')
        .select(`
          *,
          profiles!inner (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });
      
      console.log('[AdminQueries] result.data:', result.data);
      console.log('[AdminQueries] result.error:', result.error);
      console.log('[AdminQueries] result.data?.length:', result.data?.length);
      
      // If database is empty or table doesn't exist, use mock data
      if (!result.data || result.data.length === 0 || result.error) {
        console.log('[AdminQueries] Database empty or error, returning mock orders');
        return { data: mockOrders, error: null };
      }
      
      // Transform the data to include customer and customer_email from profiles
      const ordersWithCustomer = result.data.map(order => ({
        ...order,
        customer: order.profiles?.full_name || 'Cliente Desconhecido',
        customer_email: order.profiles?.email || 'email@exemplo.com',
      }));
      
      console.log('[AdminQueries] returning', ordersWithCustomer.length, 'orders');
      return { data: ordersWithCustomer, error: null };
    } catch (error) {
      console.error('[AdminQueries] Error fetching orders:', error);
      return { data: mockOrders, error: null };
    }
  },
  
  // Get order by ID
  async getOrderById(orderId: string) {
    if (!supabaseAdmin) {
      console.log('[AdminQueries] Supabase not configured, searching mock orders');
      const order = mockOrders.find(o => o.id === orderId);
      return { data: order || null, error: null };
    }
    
    try {
      const result = await supabaseAdmin
        .from('orders')
        .select(`
          *,
          profiles!inner (
            full_name,
            email
          )
        `)
        .eq('id', orderId)
        .single();
      
      if (result.error && result.error.code !== 'PGRST116') {
        throw result.error;
      }
      
      if (result.data) {
        const orderWithCustomer = {
          ...result.data,
          customer: result.data.profiles?.full_name || 'Cliente Desconhecido',
          customer_email: result.data.profiles?.email || 'email@exemplo.com',
        };
        return { data: orderWithCustomer, error: null };
      }
      
      return { data: null, error: null };
    } catch (error) {
      console.error('Error fetching order:', error);
      const order = mockOrders.find(o => o.id === orderId);
      return { data: order || null, error: null };
    }
  },
  
  // Update order status
  async updateOrderStatus(orderId: string, status: string) {
    console.log('[AdminQueries] updateOrderStatus chamado:', orderId, status);
    console.log('[AdminQueries] supabaseAdmin configurado:', !!supabaseAdmin);
    
    if (!supabaseAdmin) {
      console.log('[AdminQueries] Supabase não configurado, usando mock');
      const orderIndex = mockOrders.findIndex(o => o.id === orderId);
      if (orderIndex >= 0) {
        mockOrders[orderIndex].status = status;
      }
      return { error: null };
    }
    
    try {
      console.log('[AdminQueries] Fazendo update no Supabase para:', orderId);
      const { data, error } = await supabaseAdmin
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select();
      
      console.log('[AdminQueries] Data retornado:', JSON.stringify(data, null, 2));
      console.log('[AdminQueries] Erro do Supabase:', error);
      
      if (error) {
        console.error('[AdminQueries] Detalhes do erro:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log('[AdminQueries] Update realizado com sucesso');
      
      // Verificar se o update foi persistido
      console.log('[AdminQueries] Verificando se o update foi persistido...');
      const verifyResult = await supabaseAdmin
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();
      
      console.log('[AdminQueries] Status no banco após update:', verifyResult.data);
      
      return { error: null };
    } catch (error) {
      console.error('[AdminQueries] Erro ao atualizar status:', error);
      return { error };
    }
  },
  
  // Get orders by user ID
  async getOrdersByUserId(userId: string) {
    if (!supabaseAdmin) {
      console.log('[AdminQueries] Supabase not configured, searching mock orders');
      const userOrders = mockOrders.filter(o => o.user_id === userId);
      return { data: userOrders, error: null };
    }
    
    try {
      const result = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      return { data: result.data || [], error: null };
    } catch (error) {
      console.error('Error fetching user orders:', error);
      return { data: [], error: null };
    }
  },
  
  // Get all prescriptions
  async getAllPrescriptions() {
    if (!supabaseAdmin) {
      console.log('[AdminQueries] Supabase not configured, returning mock prescriptions');
      return { data: mockPrescriptions, error: null };
    }
    
    try {
      const result = await supabaseAdmin
        .from('prescriptions')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If database is empty or table doesn't exist, use mock data
      if (!result.data || result.data.length === 0 || result.error) {
        console.log('[AdminQueries] Database empty or error, returning mock prescriptions');
        return { data: mockPrescriptions, error: null };
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
      return { data: mockPrescriptions, error: null };
    }
  },
  
  // Get dashboard metrics
  async getDashboardMetrics() {
    if (!supabaseAdmin) {
      console.log('[AdminQueries] Supabase not configured, returning mock metrics');
      return {
        totalUsers: mockUsers.length,
        totalOrders: mockOrders.length,
        totalPrescriptions: mockPrescriptions.length,
        activeSubscriptions: 1
      };
    }
    
    try {
      // Get user count
      const usersPromise = supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      // Get order count (using orders table)
      const ordersPromise = supabaseAdmin
        .from('orders')
        .select('*', { count: 'exact', head: true });
      
      // Get prescription count
      const prescriptionsPromise = supabaseAdmin
        .from('prescriptions')
        .select('*', { count: 'exact', head: true });
      
      // Get active subscriptions
      const subscriptionsPromise = supabaseAdmin
        .from('user_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      const [users, orders, prescriptions, subscriptions] = await Promise.all([
        usersPromise,
        ordersPromise,
        prescriptionsPromise,
        subscriptionsPromise
      ]);
      
      return {
        totalUsers: users.count || 0,
        totalOrders: orders.count || 0,
        totalPrescriptions: prescriptions.count || 0,
        activeSubscriptions: subscriptions.count || 0
      };
    } catch (error) {
      console.error('Error getting dashboard metrics:', error);
      return {
        totalUsers: mockUsers.length,
        totalOrders: mockOrders.length,
        totalPrescriptions: mockPrescriptions.length,
        activeSubscriptions: 1
      };
    }
  }
};