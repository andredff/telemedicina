import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type UserSubscription = Database['public']['Tables']['user_subscriptions']['Row'];
type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];

interface UseSubscriptionReturn {
  subscription: UserSubscription | null;
  plan: SubscriptionPlan | null;
  loading: boolean;
  isActive: boolean;
  isPastDue: boolean;
  canAccessTelemedicine: boolean;
  hasSpecialistConsultationsAvailable: boolean;
  hasCheckupAvailable: boolean;
  cancelSubscription: () => Promise<void>;
  reactivateSubscription: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSubscription = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch active subscription
      const { data: subData, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (subError && subError.code !== 'PGRST116') {
        throw subError;
      }

      if (subData) {
        setSubscription(subData);

        // Fetch plan details
        const { data: planData, error: planError } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', subData.plan_id)
          .single();

        if (planError) throw planError;
        setPlan(planData);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar sua assinatura.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const checkIsActive = useCallback((): boolean => {
    if (!subscription) return false;
    if (subscription.status !== 'active') return false;

    if (subscription.expires_at) {
      const endDate = new Date(subscription.expires_at);
      return endDate > new Date();
    }
    return true;
  }, [subscription]);

  const checkIsPastDue = useCallback((): boolean => {
    if (!subscription) return false;
    if (subscription.expires_at) {
      const endDate = new Date(subscription.expires_at);
      return endDate < new Date() && subscription.status === 'active';
    }
    return false;
  }, [subscription]);

  const canAccessTelemedicine = useCallback((): boolean => {
    return checkIsActive() && !checkIsPastDue();
  }, [checkIsActive, checkIsPastDue]);

  const hasSpecialistConsultationsAvailable = useCallback((): boolean => {
    if (!subscription || !plan) return false;
    const used = subscription.specialist_consultations_used ?? 0;
    const available = plan.specialist_consultations_per_year ?? 0;
    return used < available;
  }, [subscription, plan]);

  const hasCheckupAvailable = useCallback((): boolean => {
    if (!plan) return false;
    return plan.includes_checkup === true;
  }, [plan]);

  const cancelSubscription = async (): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !subscription) return;

      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (error) throw error;

      toast({
        title: 'Assinatura cancelada',
        description: 'Sua assinatura foi cancelada com sucesso.',
      });

      await fetchSubscription();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível cancelar sua assinatura.',
        variant: 'destructive',
      });
    }
  };

  const reactivateSubscription = async (): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !subscription) return;

      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          cancelled_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (error) throw error;

      toast({
        title: 'Assinatura reativada',
        description: 'Sua assinatura está ativa novamente.',
      });

      await fetchSubscription();
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível reativar sua assinatura.',
        variant: 'destructive',
      });
    }
  };

  return {
    subscription,
    plan,
    loading,
    isActive: checkIsActive(),
    isPastDue: checkIsPastDue(),
    canAccessTelemedicine: canAccessTelemedicine(),
    hasSpecialistConsultationsAvailable: hasSpecialistConsultationsAvailable(),
    hasCheckupAvailable: hasCheckupAvailable(),
    cancelSubscription,
    reactivateSubscription,
    refetch: fetchSubscription,
  };
}
