import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, MessageCircle, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const FAQ = [
  {
    q: 'Como iniciar uma teleconsulta?',
    a: 'Vá até a Sala de Espera para ver os pacientes que estão aguardando. Clique em "Chamar Paciente" no primeiro da fila para iniciar o atendimento.',
  },
  {
    q: 'Como emitir uma receita médica?',
    a: 'Durante o atendimento, acesse a aba "Receita" dentro do workspace do atendimento. Adicione os medicamentos, dosagem e instruções. Você pode assinar digitalmente e imprimir.',
  },
  {
    q: 'Onde ficam guardados os documentos emitidos?',
    a: 'Prescrições, exames e atestados ficam organizados nos menus específicos no painel lateral. Todos os documentos são vinculados ao atendimento de cada paciente.',
  },
  {
    q: 'Como configurar meus horários de atendimento?',
    a: 'Acesse o menu "Agenda" no painel lateral. Lá você pode configurar os dias da semana e os blocos de horário disponíveis para consultas com especialista.',
  },
  {
    q: 'O que é o status Online/Offline?',
    a: 'O status Online indica que você está disponível para receber consultas imediatas. Quando Offline, novos pacientes não entrarão na sua fila de espera.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-3.5 text-left gap-4 hover:text-primary transition-colors"
      >
        <span className="text-sm font-medium text-foreground">{q}</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && <p className="text-sm text-muted-foreground pb-4 leading-relaxed">{a}</p>}
    </div>
  );
}

export default function MedicoSuporte() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Suporte</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Precisa de ajuda? Estamos aqui.</p>
      </div>

      {/* Contact channels */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { icon: Mail, label: 'E-mail', value: 'suporte@novita.com.br', action: () => window.open('mailto:suporte@novita.com.br') },
          { icon: MessageCircle, label: 'WhatsApp', value: '(11) 9 9999-9999', action: () => window.open('https://wa.me/5511999999999') },
          { icon: Phone, label: 'Telefone', value: '0800 000 0000', action: () => window.open('tel:08000000000') },
        ].map(({ icon: Icon, label, value, action }) => (
          <Card key={label} className="cursor-pointer hover:shadow-md hover:border-primary/20 transition-all" onClick={action}>
            <CardContent className="p-5 text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQ */}
      <Card>
        <CardContent className="p-5">
          <p className="font-semibold text-foreground mb-4">Perguntas Frequentes</p>
          {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
        </CardContent>
      </Card>

      {/* Emergency */}
      <div className="text-center text-xs text-muted-foreground">
        Horário de atendimento: <strong>Segunda a Sexta, das 8h às 18h</strong>
      </div>
    </div>
  );
}
