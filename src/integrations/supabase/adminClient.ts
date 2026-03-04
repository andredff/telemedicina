// Admin client for Supabase with additional admin functionalities
import { supabase } from './client';
import { logger } from "@/lib/logger";

const CAN_USE_MOCKS = import.meta.env.DEV;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

// Use the same supabase client to share auth session
export const supabaseAdmin = supabase;
if (import.meta.env.DEV) {
  logger.info("[AdminClient] init - using shared supabase client", { isSupabaseConfigured });
}

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
        return CAN_USE_MOCKS ? requiredRole === this.ROLES.ADMIN : false;
      }
      
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data?.role === requiredRole;
    } catch (error) {
      logger.error("[RBAC] Error checking role", error);
      return CAN_USE_MOCKS ? requiredRole === this.ROLES.ADMIN : false;
    }
  },
  
  // Check if user has any of the required roles
  async hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
    try {
      // If Supabase is not configured, use mock data for testing
      if (!supabaseAdmin) {
        return CAN_USE_MOCKS ? roles.includes(this.ROLES.ADMIN) : false;
      }
      
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return roles.includes(data?.role);
    } catch (error) {
      logger.error("[RBAC] Error checking roles", error);
      return CAN_USE_MOCKS ? roles.includes(this.ROLES.ADMIN) : false;
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
        return CAN_USE_MOCKS ? this.ROLES.ADMIN : null;
      }
      
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data?.role || null;
    } catch (error) {
      logger.error("[RBAC] Error getting user role", error);
      return CAN_USE_MOCKS ? this.ROLES.ADMIN : null;
    }
  },
  
  // Update user role (admin only)
  async updateUserRole(userId: string, newRole: string, adminUserId: string): Promise<boolean> {
    try {
      if (!supabaseAdmin) {
        return false;
      }

      // Check if the requesting user is an admin
      const isAdmin = await this.isAdmin(adminUserId);
      if (!isAdmin) {
        logger.error("[RBAC] Only admins can update user roles");
        return false;
      }
      
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      logger.error("[RBAC] Error updating user role", error);
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
    tracking_code: undefined,
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
    tracking_code: undefined,
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
    tracking_code: undefined,
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
      return CAN_USE_MOCKS
        ? { data: mockUsers, error: null }
        : { data: [], error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (result.error) return { data: [], error: result.error };
      return { data: result.data || [], error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error fetching users", error);
      return CAN_USE_MOCKS ? { data: mockUsers, error: null } : { data: [], error: error as Error };
    }
  },
  
  // Get all orders
  async getAllOrders() {
    if (!supabaseAdmin) {
      return CAN_USE_MOCKS
        ? { data: mockOrders, error: null }
        : { data: [], error: new Error("Supabase admin client not configured") };
    }
    
    try {
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
      
      if (result.error) return { data: [], error: result.error };
      
      // Transform the data to include customer and customer_email from profiles
      const ordersWithCustomer = (result.data || []).map((order: Record<string, unknown>) => ({
        ...order,
        customer: (order as { profiles?: { full_name?: string } }).profiles?.full_name || 'Cliente Desconhecido',
        customer_email: (order as { profiles?: { email?: string } }).profiles?.email || null,
      }));
      
      return { data: ordersWithCustomer, error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error fetching orders", error);
      return CAN_USE_MOCKS ? { data: mockOrders, error: null } : { data: [], error: error as Error };
    }
  },
  
  // Get order by ID
  async getOrderById(orderId: string) {
    if (!supabaseAdmin) {
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
      logger.error("[AdminQueries] Error fetching order", error);
      const order = mockOrders.find(o => o.id === orderId);
      return { data: order || null, error: null };
    }
  },
  
  // Update order status
  async updateOrderStatus(orderId: string, status: string) {
    if (!supabaseAdmin) {
      const orderIndex = mockOrders.findIndex(o => o.id === orderId);
      if (orderIndex >= 0) {
        mockOrders[orderIndex].status = status;
      }
      return { error: null };
    }
    
    try {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select("id");

      if (error) throw error;
      return { error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error updating order status", error);
      return { error };
    }
  },

  // Update tracking code for an order
  async updateOrderTracking(orderId: string, trackingCode: string | null) {
    if (!supabaseAdmin) {
      const orderIndex = mockOrders.findIndex(o => o.id === orderId);
      if (orderIndex >= 0) {
        mockOrders[orderIndex].tracking_code = trackingCode || undefined;
      }
      return { error: null };
    }

    try {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({
          tracking_code: trackingCode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error updating tracking", error);
      return { error };
    }
  },
  
  // Get orders by user ID
  async getOrdersByUserId(userId: string) {
    if (!supabaseAdmin) {
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
      logger.error("[AdminQueries] Error fetching user orders", error);
      return { data: [], error: null };
    }
  },
  
  // Get all prescriptions
  async getAllPrescriptions() {
    if (!supabaseAdmin) {
      return CAN_USE_MOCKS
        ? { data: mockPrescriptions, error: null }
        : { data: [], error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('prescriptions')
        .select('*, medications(*)')
        .order('created_at', { ascending: false });
      
      if (result.error) return { data: [], error: result.error };
      return { data: result.data || [], error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error fetching prescriptions", error);
      return CAN_USE_MOCKS ? { data: mockPrescriptions, error: null } : { data: [], error: error as Error };
    }
  },
  
  // Get dashboard metrics
  async getDashboardMetrics() {
    if (!supabaseAdmin) {
      return CAN_USE_MOCKS
        ? {
            totalUsers: mockUsers.length,
            totalOrders: mockOrders.length,
            totalPrescriptions: mockPrescriptions.length,
            activeSubscriptions: 1
          }
        : {
            totalUsers: 0,
            totalOrders: 0,
            totalPrescriptions: 0,
            activeSubscriptions: 0
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
      logger.error("[AdminQueries] Error getting dashboard metrics", error);
      return CAN_USE_MOCKS
        ? {
            totalUsers: mockUsers.length,
            totalOrders: mockOrders.length,
            totalPrescriptions: mockPrescriptions.length,
            activeSubscriptions: 1
          }
        : {
            totalUsers: 0,
            totalOrders: 0,
            totalPrescriptions: 0,
            activeSubscriptions: 0
          };
    }
  },

  // =====================
  // Blog Posts
  // =====================
  async getAllBlogPosts() {
    if (!supabaseAdmin) {
      return { data: [], error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('blog_posts')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false });
      
      if (result.error) return { data: [], error: result.error };
      
      const posts = (result.data || []).map((post: Record<string, unknown>) => ({
        ...post,
        author: (post.profiles as { full_name?: string })?.full_name || 'Admin'
      }));
      
      return { data: posts, error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error fetching blog posts", error);
      return { data: [], error: error as Error };
    }
  },

  async createBlogPost(post: {
    title: string;
    slug: string;
    content?: string;
    excerpt?: string;
    category: string;
    status: string;
    author_id?: string;
  }) {
    if (!supabaseAdmin) {
      return { data: null, error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('blog_posts')
        .insert(post)
        .select()
        .single();
      
      return { data: result.data, error: result.error };
    } catch (error) {
      logger.error("[AdminQueries] Error creating blog post", error);
      return { data: null, error: error as Error };
    }
  },

  async updateBlogPost(id: string, updates: Partial<{
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    category: string;
    status: string;
    published_at: string;
  }>) {
    if (!supabaseAdmin) {
      return { data: null, error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('blog_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      return { data: result.data, error: result.error };
    } catch (error) {
      logger.error("[AdminQueries] Error updating blog post", error);
      return { data: null, error: error as Error };
    }
  },

  async deleteBlogPost(id: string) {
    if (!supabaseAdmin) {
      return { error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('blog_posts')
        .delete()
        .eq('id', id);
      
      return { error: result.error };
    } catch (error) {
      logger.error("[AdminQueries] Error deleting blog post", error);
      return { error: error as Error };
    }
  },

  // =====================
  // Support Tickets
  // =====================
  async getAllTickets() {
    if (!supabaseAdmin) {
      return { data: [], error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('support_tickets')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });
      
      if (result.error) return { data: [], error: result.error };
      return { data: result.data || [], error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error fetching tickets", error);
      return { data: [], error: error as Error };
    }
  },

  async updateTicketStatus(id: string, status: string, assignedTo?: string) {
    if (!supabaseAdmin) {
      return { data: null, error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const updates: Record<string, unknown> = { status };
      if (assignedTo) updates.assigned_to = assignedTo;
      if (status === 'closed') updates.resolved_at = new Date().toISOString();
      
      const result = await supabaseAdmin
        .from('support_tickets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      return { data: result.data, error: result.error };
    } catch (error) {
      logger.error("[AdminQueries] Error updating ticket", error);
      return { data: null, error: error as Error };
    }
  },

  async getTicketMessages(ticketId: string) {
    if (!supabaseAdmin) {
      return { data: [], error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('support_ticket_messages')
        .select('*, profiles(full_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      
      if (result.error) return { data: [], error: result.error };
      return { data: result.data || [], error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error fetching ticket messages", error);
      return { data: [], error: error as Error };
    }
  },

  async addTicketMessage(ticketId: string, message: string, senderId?: string, senderType: 'customer' | 'support' | 'system' = 'support') {
    if (!supabaseAdmin) {
      return { data: null, error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticketId,
          message,
          sender_id: senderId,
          sender_type: senderType
        })
        .select()
        .single();
      
      return { data: result.data, error: result.error };
    } catch (error) {
      logger.error("[AdminQueries] Error adding ticket message", error);
      return { data: null, error: error as Error };
    }
  },

  // =====================
  // Site Settings
  // =====================
  async getSettings() {
    if (!supabaseAdmin) {
      return { data: [], error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('site_settings')
        .select('*');
      
      if (result.error) return { data: [], error: result.error };
      return { data: result.data || [], error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error fetching settings", error);
      return { data: [], error: error as Error };
    }
  },

  async updateSetting(key: string, value: Record<string, unknown>, updatedBy?: string) {
    if (!supabaseAdmin) {
      return { data: null, error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('site_settings')
        .update({ value, updated_by: updatedBy })
        .eq('key', key)
        .select()
        .single();
      
      return { data: result.data, error: result.error };
    } catch (error) {
      logger.error("[AdminQueries] Error updating setting", error);
      return { data: null, error: error as Error };
    }
  },

  // =====================
  // Knowledge Base Articles
  // =====================
  async getAllKnowledgeArticles() {
    if (!supabaseAdmin) {
      return { data: [], error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('knowledge_articles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (result.error) return { data: [], error: result.error };
      return { data: result.data || [], error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error fetching knowledge articles", error);
      return { data: [], error: error as Error };
    }
  },

  async createKnowledgeArticle(article: {
    title: string;
    slug: string;
    content: string;
    excerpt?: string;
    category?: string;
    status?: string;
    author_id?: string;
  }) {
    if (!supabaseAdmin) {
      return { data: null, error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('knowledge_articles')
        .insert(article)
        .select()
        .single();
      
      return { data: result.data, error: result.error };
    } catch (error) {
      logger.error("[AdminQueries] Error creating knowledge article", error);
      return { data: null, error: error as Error };
    }
  },

  async updateKnowledgeArticle(id: string, updates: Partial<{
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    category: string;
    status: string;
  }>) {
    if (!supabaseAdmin) {
      return { data: null, error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('knowledge_articles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      return { data: result.data, error: result.error };
    } catch (error) {
      logger.error("[AdminQueries] Error updating knowledge article", error);
      return { data: null, error: error as Error };
    }
  },

  async deleteKnowledgeArticle(id: string) {
    if (!supabaseAdmin) {
      return { error: new Error("Supabase admin client not configured") };
    }
    
    try {
      const result = await supabaseAdmin
        .from('knowledge_articles')
        .delete()
        .eq('id', id);
      
      return { error: result.error };
    } catch (error) {
      logger.error("[AdminQueries] Error deleting knowledge article", error);
      return { error: error as Error };
    }
  }
};
