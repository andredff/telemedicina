import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderUpdate {
  id: string;
  status: OrderStatus;
  previousStatus?: OrderStatus;
  timestamp: string;
}

interface UseOrderSubscriptionOptions {
  orderId?: string;
  userId?: string;
  currentStatus?: OrderStatus | string | null;
  onStatusChange?: (update: OrderUpdate) => void;
}

export function useOrderSubscription({
  orderId,
  currentStatus,
  onStatusChange,
}: UseOrderSubscriptionOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<OrderUpdate | null>(null);
  const { toast } = useToast();

  const normalizeStatus = useCallback((status: string | null | undefined): OrderStatus => {
    if (!status) return "pending";
    if (status === "in_transit") return "shipped";
    if (status === "confirmed") return "processing";
    return status as OrderStatus;
  }, []);
  const lastKnownStatusRef = useRef<OrderStatus | null>(
    currentStatus ? normalizeStatus(currentStatus) : null
  );

  const showNotification = useCallback((update: OrderUpdate) => {
    const statusLabels: Record<OrderStatus, string> = {
      pending: 'Pedido Pago',
      processing: 'Pedido em Separação',
      shipped: 'Pedido Enviado',
      delivered: 'Pedido Entregue',
      cancelled: 'Pedido Cancelado',
    };

    toast({
      title: `Pedido ${update.id.slice(0, 8)}...`,
      description: `Status atualizado para: ${statusLabels[update.status] || update.status}`,
      duration: 5000,
    });

    onStatusChange?.(update);
  }, [onStatusChange, toast]);

  useEffect(() => {
    if (currentStatus) {
      lastKnownStatusRef.current = normalizeStatus(currentStatus);
    }
  }, [currentStatus, normalizeStatus]);

  useEffect(() => {
    if (!orderId) {
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newStatus = normalizeStatus(payload.new.status as string);
          const oldStatus = payload.old?.status
            ? normalizeStatus(payload.old.status as string)
            : lastKnownStatusRef.current || undefined;
          const statusChanged = !oldStatus || newStatus !== oldStatus;

          if (!statusChanged) return;

          const update: OrderUpdate = {
            id: payload.new.id as string,
            status: newStatus,
            previousStatus: oldStatus,
            timestamp: new Date().toISOString(),
          };

          lastKnownStatusRef.current = newStatus;
          setLastUpdate(update);
          showNotification(update);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [orderId, normalizeStatus, showNotification]);

  const refreshOrder = useCallback(async () => {
    if (!orderId) return null;

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) return null;
    return data;
  }, [orderId]);

  return {
    isConnected,
    lastUpdate,
    refreshOrder,
  };
}

export function useUserOrdersSubscription({
  userId,
  onNewOrder,
  onOrderUpdate,
}: {
  userId?: string;
  onNewOrder?: (orderId: string) => void;
  onOrderUpdate?: (orderId: string, status: OrderStatus) => void;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();

  const normalizeStatus = (status: string | null | undefined): OrderStatus => {
    if (!status) return "pending";
    if (status === "in_transit") return "shipped";
    if (status === "confirmed") return "processing";
    return status as OrderStatus;
  };

  useEffect(() => {
    if (!userId) {
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel(`user-orders-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            onNewOrder?.(payload.new.id as string);
            toast({
              title: 'Novo pedido criado!',
              description: `Pedido ${(payload.new.id as string).slice(0, 8)}...`,
            });
          } else if (payload.eventType === 'UPDATE') {
            onOrderUpdate?.(
              payload.new.id as string,
              normalizeStatus(payload.new.status as string)
            );
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [userId, onNewOrder, onOrderUpdate, toast]);

  return { isConnected };
}

export function formatOrderStatus(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending: 'Pedido Pago',
    processing: 'Pedido em Separação',
    shipped: 'Pedido Enviado',
    delivered: 'Pedido Entregue',
    cancelled: 'Pedido Cancelado',
  };
  return labels[status] || status;
}

export function getStatusColor(status: OrderStatus): string {
  const colors: Record<OrderStatus, string> = {
    pending: 'bg-slate-100 text-slate-800',
    processing: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}
