// Admin client for Supabase with additional admin functionalities
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Admin client with extended functionality
// Note: For full admin functionality, we would need the service role key
// but for security reasons, we'll implement admin features using the
// publishable key with proper RBAC

export const supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

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
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data?.role === requiredRole;
    } catch (error) {
      console.error('Error checking role:', error);
      return false;
    }
  },
  
  // Check if user has any of the required roles
  async hasAnyRole(userId: string, roles: string[]): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return roles.includes(data?.role);
    } catch (error) {
      console.error('Error checking roles:', error);
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
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data?.role || null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
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

// Admin-specific queries
export const AdminQueries = {
  // Get all users
  async getAllUsers() {
    return await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
  },
  
  // Get all orders
  async getAllOrders() {
    return await supabaseAdmin
      .from('cart_items')
      .select('*')
      .order('created_at', { ascending: false });
  },
  
  // Get all prescriptions
  async getAllPrescriptions() {
    return await supabaseAdmin
      .from('prescriptions')
      .select('*')
      .order('created_at', { ascending: false });
  },
  
  // Get dashboard metrics
  async getDashboardMetrics() {
    try {
      // Get user count
      const usersPromise = supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      // Get order count
      const ordersPromise = supabaseAdmin
        .from('cart_items')
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
        totalUsers: 0,
        totalOrders: 0,
        totalPrescriptions: 0,
        activeSubscriptions: 0
      };
    }
  }
};