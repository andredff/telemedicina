import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';

export default function MedicoChat() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-foreground">Chat</h1>
        <Badge variant="secondary">Em breve</Badge>
      </div>

      <Card>
        <CardContent className="py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-foreground mb-2">Chat com pacientes</h2>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Em breve você poderá se comunicar diretamente com seus pacientes por mensagens, enviar orientações pré e pós consulta e acompanhar dúvidas em tempo real.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
