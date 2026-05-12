import { useCallback, useState } from 'react';
import { CheckCircle, Clock, Package, Truck, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  formatOrderStatus,
  getStatusColor,
  useOrderSubscription,
  type OrderStatus,
  type OrderUpdate,
} from '@/hooks/useOrderSubscription';

interface OrderTrackingProps {
  orderId: string;
  status: OrderStatus;
  onStatusChange?: (newStatus: OrderStatus) => void;
}

const statusSteps: { status: OrderStatus; label: string; icon: typeof Clock }[] = [
  { status: 'pending', label: 'Pedido Pago', icon: CheckCircle },
  { status: 'processing', label: 'Pedido em Separação', icon: Clock },
  { status: 'shipped', label: 'Saiu para Entrega', icon: Truck },
  { status: 'delivered', label: 'Pedido Entregue', icon: Home },
];

export function OrderTracking({ orderId, status, onStatusChange }: OrderTrackingProps) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const handleRealtimeStatusChange = useCallback((update: OrderUpdate) => {
    onStatusChange?.(update.status);
    setLastUpdate(new Date(update.timestamp));
  }, [onStatusChange]);

  const { isConnected: isRealtimeConnected } = useOrderSubscription({
    orderId,
    currentStatus: status,
    onStatusChange: handleRealtimeStatusChange,
  });

  const getCurrentStepIndex = () => {
    const stepIndex = statusSteps.findIndex((step) => step.status === status);
    if (status === 'cancelled') return -1;
    return stepIndex >= 0 ? stepIndex : 0;
  };

  const currentStep = getCurrentStepIndex();

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Status do Pedido</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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

        <div className="p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Entrega Própria</p>
              <p className="text-xs text-muted-foreground">
                A entrega é realizada pela equipe Novità. Você será avisado quando o pedido sair para entrega.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium">Histórico de status</h4>
          <div className="relative">
            {statusSteps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index <= currentStep;
              const isCurrent = index === currentStep;

              return (
                <div key={step.status} className="flex items-start gap-4 pb-6 last:pb-0">
                  {index < statusSteps.length - 1 && (
                    <div
                      className={`absolute left-5 w-0.5 h-6 ${
                        index <= currentStep - 1 ? 'bg-primary' : 'bg-muted'
                      }`}
                      style={{ marginTop: '2.5rem' }}
                    />
                  )}

                  <div
                    className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isCompleted
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-muted'
                    } ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

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

        <div className="flex items-center justify-between pt-4 border-t">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${isRealtimeConnected ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
            {isRealtimeConnected ? 'Tempo real ativo' : 'Tempo real aguardando conexão'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default OrderTracking;
