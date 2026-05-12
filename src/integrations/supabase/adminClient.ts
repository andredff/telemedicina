// Admin client for Supabase with additional admin functionalities
import { supabase } from './client';
import { logger } from "@/lib/logger";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

// IMPORTANTE: service role key NUNCA deve usar prefixo VITE_ (não pode ir para o bundle).
// O adminClient usa o supabase normal com RLS — operações admin são protegidas
// pelo middleware requireAdmin no backend (cielo-server.js).
export const supabaseAdmin = supabase;

if (import.meta.env.DEV) {
  logger.info("[AdminClient] init", { isSupabaseConfigured });
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
        return false;
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
      return false;
    }
  },
  
  // Check if user has any of the required roles
  async hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
    try {
      // If Supabase is not configured, use mock data for testing
      if (!supabaseAdmin) {
        return false;
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
      return false;
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
        return null;
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
      return null;
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

// Admin-specific queries
export const AdminQueries = {
    // Get consultations by user ID
    async getConsultationsByUserId(userId: string) {
      try {
        // Busca na tabela de consultas (ajuste o nome da tabela conforme o schema real)
        const result = await supabaseAdmin
          .from('consultations')
          .select('*')
          .eq('user_id', userId)
          .order('started_at', { ascending: false });
        return { data: result.data || [], error: result.error };
      } catch (error) {
        logger.error('[AdminQueries] Error fetching user consultations', error);
        return { data: [], error };
      }
    },
  // Get all users
  async getAllUsers() {
    try {
      const result = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (result.error) return { data: [], error: result.error };
      return { data: result.data || [], error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error fetching users", error);
      return { data: [], error: error as Error };
    }
  },
  
  // Get all orders
  async getAllOrders() {
    try {
      // Left join para não perder pedidos sem perfil correspondente
      const result = await supabaseAdmin
        .from('orders')
        .select(`
          *,
          profiles (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      logger.info("[AdminQueries] getAllOrders result", { count: result.data?.length, error: result.error });

      if (result.error) return { data: [], error: result.error };

      // Transform the data to include customer and customer_email from profiles
      const ordersWithCustomer = (result.data || []).map((order: Record<string, unknown>) => ({
        ...order,
        customer: (order as { profiles?: { full_name?: string } }).profiles?.full_name || (order.customer_name as string) || 'Cliente Desconhecido',
        customer_email: (order as { profiles?: { email?: string } }).profiles?.email || (order.customer_email as string) || null,
      }));

      return { data: ordersWithCustomer, error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error fetching orders", error);
      return { data: [], error: error as Error };
    }
  },

  // Get order by ID
  async getOrderById(orderId: string) {
    
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
      return { data: null, error: null };
    }
  },

  // Update order status
  async updateOrderStatus(orderId: string, status: string) {
    
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

  // Save pharmacist review decision on an order
  async reviewOrder(orderId: string, decision: 'approved' | 'rejected', notes: string) {
    try {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({
          receita_review_status: decision,
          receita_review_notes: notes,
          receita_reviewed_at: new Date().toISOString(),
          status: decision === 'approved' ? 'processing' : 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error saving order review", error);
      return { error };
    }
  },

  // Update payment_status after refund
  async updateOrderPaymentStatus(orderId: string, paymentStatus: string) {
    try {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error updating payment status", error);
      return { error };
    }
  },

  // Get orders by user ID
  async getOrdersByUserId(userId: string) {
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
    try {
      const result = await supabaseAdmin
        .from('prescriptions')
        .select('*, medications(*)')
        .order('created_at', { ascending: false });

      if (result.error) return { data: [], error: result.error };
      return { data: result.data || [], error: null };
    } catch (error) {
      logger.error("[AdminQueries] Error fetching prescriptions", error);
      return { data: [], error: error as Error };
    }
  },
  
  // Get dashboard metrics
  async getDashboardMetrics() {
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
      
      // Get consultation credits (compras avulsas)
      const creditsPromise = supabaseAdmin
        .from('consultation_credits')
        .select('*', { count: 'exact', head: true });
      
      // Get available consultation credits
      const availableCreditsPromise = supabaseAdmin
        .from('consultation_credits')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'available');
      
      // Get total revenue from consultation credits
      const creditsRevenuePromise = supabaseAdmin
        .from('consultation_credits')
        .select('amount');
      
      const [users, orders, prescriptions, subscriptions, credits, availableCredits, creditsRevenue] = await Promise.all([
        usersPromise,
        ordersPromise,
        prescriptionsPromise,
        subscriptionsPromise,
        creditsPromise,
        availableCreditsPromise,
        creditsRevenuePromise
      ]);
      
      // Calculate total credits revenue
      const totalCreditsRevenue = creditsRevenue.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      
      return {
        totalUsers: users.count || 0,
        totalOrders: orders.count || 0,
        totalPrescriptions: prescriptions.count || 0,
        activeSubscriptions: subscriptions.count || 0,
        totalConsultationCredits: credits.count || 0,
        availableConsultationCredits: availableCredits.count || 0,
        consultationCreditsRevenue: totalCreditsRevenue
      };
    } catch (error) {
      logger.error("[AdminQueries] Error getting dashboard metrics", error);
      return {
        totalUsers: 0,
        totalOrders: 0,
        totalPrescriptions: 0,
        activeSubscriptions: 0,
        totalConsultationCredits: 0,
        availableConsultationCredits: 0,
        consultationCreditsRevenue: 0
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
    featured_image?: string;
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
    featured_image: string | null;
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
        .select('*, profiles!support_tickets_user_id_fkey(full_name, email)')
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
        .upsert({ key, value, updated_by: updatedBy }, { onConflict: 'key' })
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
