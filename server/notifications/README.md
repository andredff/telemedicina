# Sistema de Notificações por E-mail — Novità

Arquitetura baseada em eventos com fila assíncrona e retry automático.

## Estrutura

```
server/notifications/
├── templates.js    Templates HTML para cada tipo de evento
├── queue.js        Fila em memória + worker com retry exponencial
├── dispatcher.js   Despachante de eventos (única interface pública)
├── scheduler.js    Cron de lembrete de consulta (a cada 5 min)
└── README.md       Esta documentação
```

## Eventos suportados

| Evento               | Trigger                          | Template             |
|----------------------|----------------------------------|----------------------|
| `UsuarioCadastrado`  | Cadastro via Supabase Auth       | Boas-vindas          |
| `SenhaAlterada`      | Alteração de senha               | Alerta de segurança  |
| `ConsultaAgendada`   | POST /api/notifications/consulta-agendada | Confirmação |
| `LembreteConsulta`   | Scheduler (30 min antes)         | Lembrete automático  |

## Configuração

No `.env.local`:
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx   # Deixe vazio para modo MOCK (dev)
RESEND_FROM=Novità <noreply@novita.com.br>  # Opcional
```

## Endpoints da API

### Despachar evento genérico
```http
POST /api/notifications/events
Content-Type: application/json

{
  "tipo": "UsuarioCadastrado",
  "data": {
    "nome": "Ana Silva",
    "email": "ana@email.com"
  }
}
```

### Registrar consulta agendada (confirmação + lembrete)
```http
POST /api/notifications/consulta-agendada
Content-Type: application/json

{
  "consultaId": "12345",
  "email": "paciente@email.com",
  "nome": "André Souza",
  "especialidade": "Cardiologia",
  "profissional": "Dr. Carlos Silva",
  "dataHora": "2026-03-25T17:30:00.000Z",
  "userId": "uuid-do-usuario"  // opcional
}
```

### Testar um template específico
```http
POST /api/notifications/test/UsuarioCadastrado
Content-Type: application/json

{ "email": "seu@email.com" }
```

### Métricas da fila
```http
GET /api/notifications/stats
```

## Integração com Supabase Auth

Configure um **webhook** no Supabase Dashboard:
- **URL:** `http://localhost:5174/api/notifications/events`
- **Eventos:** `user.created`, `user.updated`

Mapeamento no handler:
```
user.created  → UsuarioCadastrado
user.updated (password change) → SenhaAlterada
```

Ou dispare manualmente do frontend após cadastro:
```ts
// src/hooks/useAuth.ts (após signUp bem-sucedido)
await fetch(`${import.meta.env.VITE_LOCAL_SERVER_URL}/api/notifications/events`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tipo: "UsuarioCadastrado",
    data: { nome: user.user_metadata.full_name, email: user.email },
  }),
});
```

## Simulação local

Sem `RESEND_API_KEY`, o modo MOCK é ativado automaticamente:

```
📧 [EMAIL MOCK]
   Para:     paciente@email.com
   Assunto:  Bem-vindo à Novità Telemedicina 💙
   HTML:     ...
```

Todos os templates são renderizados — só o envio é substituído por `console.log`.

## Scheduler de lembretes

- Roda a cada **5 minutos**
- Busca consultas na tabela `consultation_reminders` com `reminder_sent = false`
- Janela de disparo: **25–30 minutos** antes da consulta
- Marca `reminder_sent = true` após despachar para evitar duplicatas
- Requer Supabase configurado com `SUPABASE_SERVICE_ROLE_KEY`

## Para produção

Para volume alto, substitua a fila em memória por **Bull + Redis**:

```bash
npm install bull ioredis
```

Veja o comentário em `queue.js` com a implementação de migração.
