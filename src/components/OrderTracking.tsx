import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Copy, CheckCircle, Clock, Package, Truck, Home, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  formatOrderStatus,
  getStatusColor,
  useOrderSubscription,
  type OrderStatus,
  type OrderUpdate,
} from '@/hooks/useOrderSubscription';
import {
  getCorreiosTrackingUrl,
  refreshOrderTracking,
  type TrackingEvent,
} from '@/services/trackingService';
import { toast } from 'sonner';

interface OrderTrackingProps {
  orderId: string;
  trackingCode?: string | null;
  trackingStatusLabel?: string | null;
  trackingLastCheckedAt?: string | null;
  trackingEvents?: TrackingEvent[] | null;
  status: OrderStatus;
  onStatusChange?: (newStatus: OrderStatus) => void;
}

const statusSteps: { status: OrderStatus; label: string; icon: typeof Clock }[] = [
  { status: 'pending', label: 'Pedido Pago', icon: CheckCircle },
  { status: 'processing', label: 'Pedido em Separação', icon: Clock },
  { status: 'shipped', label: 'Pedido Enviado', icon: Truck },
  { status: 'delivered', label: 'Pedido Entregue', icon: Home },
];

export function OrderTracking({
  orderId,
  trackingCode,
  trackingStatusLabel,
  trackingLastCheckedAt,
  trackingEvents,
  status,
  onStatusChange,
}: OrderTrackingProps) {
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(
    trackingLastCheckedAt ? new Date(trackingLastCheckedAt) : new Date()
  );
  const [correiosStatus, setCorreiosStatus] = useState(trackingStatusLabel || null);
  const [correiosEvents, setCorreiosEvents] = useState<TrackingEvent[]>(trackingEvents || []);

  const handleRealtimeStatusChange = useCallback((update: OrderUpdate) => {
    onStatusChange?.(update.status);
    setLastUpdate(new Date(update.timestamp));
  }, [onStatusChange]);

  const { isConnected: isRealtimeConnected } = useOrderSubscription({
    orderId,
    currentStatus: status,
    currentTrackingCode: trackingCode ?? null,
    onStatusChange: handleRealtimeStatusChange,
  });

  useEffect(() => {
    setCorreiosStatus(trackingStatusLabel || null);
    setCorreiosEvents(trackingEvents || []);
    if (trackingLastCheckedAt) {
      setLastUpdate(new Date(trackingLastCheckedAt));
    }
  }, [trackingStatusLabel, trackingLastCheckedAt, trackingEvents]);

  const handleRefresh = async () => {
    if (!trackingCode) {
      toast.error('Pedido ainda sem código de rastreio');
      return;
    }

    setRefreshing(true);
    try {
      const result = await refreshOrderTracking(orderId);
      const newStatus = result.order.status as OrderStatus | undefined;

      if (newStatus) {
        onStatusChange?.(newStatus);
      }

      setCorreiosStatus(result.tracking.trackingStatusLabel);
      setCorreiosEvents(result.tracking.trackingEvents);
      setLastUpdate(
        result.order.tracking_last_checked_at
          ? new Date(result.order.tracking_last_checked_at)
          : new Date()
      );

      if (result.configured) {
        toast.success('Rastreio atualizado pelos Correios');
      } else {
        toast.message('Código válido. Consulta automática aguardando credenciais dos Correios.');
      }
    } catch {
      toast.error('Erro ao atualizar status');
    } finally {
      setRefreshing(false);
    }
  };

  const copyTrackingCode = () => {
    if (trackingCode) {
      navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getCurrentStepIndex = () => {
    const stepIndex = statusSteps.findIndex((step) => step.status === status);
    if (status === 'cancelled') return -1;
    return stepIndex >= 0 ? stepIndex : 0;
  };

  const currentStep = getCurrentStepIndex();

  // Função para rastrear external (abre site dos correios)
  const trackExternal = () => {
    if (trackingCode) {
      window.open(getCorreiosTrackingUrl(trackingCode), '_blank');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Rastreamento do Pedido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status atual */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Status atual</p>
              <p className="font-semibold">{formatOrderStatus(status)}</p>
            </div>
          </div>
          <Badge className={getStatusColor(status)}>{formatOrderStatus(status)}</Badge>
        </div>

        {/* Código de rastreio */}
        {trackingCode ? (
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Código de rastreio</span>
              <Button variant="ghost" size="sm" onClick={trackExternal} className="text-blue-600">
                <ExternalLink className="h-4 w-4 mr-1" />
                Rastrear nos Correios
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-muted rounded font-mono text-sm">
                {trackingCode}
              </code>
              <Button variant="outline" size="icon" onClick={copyTrackingCode}>
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {correiosStatus && (
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Status Correios</p>
                <p className="text-sm font-medium">{correiosStatus}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Código de rastreio</p>
                <p className="text-xs text-muted-foreground">
                  O código de rastreio será disponibilizado após o envio do pedido
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Timeline de rastreamento */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Histórico de status</h4>
          <div className="relative">
            {statusSteps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index <= currentStep;
              const isCurrent = index === currentStep;

              return (
                <div key={step.status} className="flex items-start gap-4 pb-6 last:pb-0">
                  {/* Linha de conexão */}
                  {index < statusSteps.length - 1 && (
                    <div
                      className={`absolute left-5 w-0.5 h-6 ${
                        index <= currentStep - 1 ? 'bg-primary' : 'bg-muted'
                      }`}
                      style={{ marginTop: '2.5rem' }}
                    />
                  )}
                  
                  {/* Ícone */}
                  <div
                    className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isCompleted
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-muted'
                    } ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  {/* Label */}
                  <div className="flex-1 pt-1">
                    <p
                      className={`font-medium ${
                        isCompleted ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && lastUpdate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Atualizado às {lastUpdate.toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {correiosEvents.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Eventos dos Correios</h4>
            <div className="space-y-3">
              {correiosEvents.slice(0, 4).map((event, index) => (
                <div key={`${event.createdAt}-${index}`} className="border-l-2 border-primary/30 pl-3">
                  <p className="text-sm font-medium">{event.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {[event.location, event.createdAt ? new Date(event.createdAt).toLocaleString('pt-BR') : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Última atualização e botão de refresh */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="space-y-1">
            <span className="block text-xs text-muted-foreground">
              {lastUpdate
                ? `Última atualização: ${lastUpdate.toLocaleString('pt-BR')}`
                : 'Carregando...'}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${isRealtimeConnected ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
              {isRealtimeConnected ? 'Tempo real ativo' : 'Tempo real aguardando conexão'}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-muted-foreground"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default OrderTracking;
