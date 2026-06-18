# Notificações Internas da Plataforma

Sistema de notificações in-app da Novità: avisa o paciente sobre o vencimento
do plano (15/10/5/1/0 dias e vencido), confirmação de pagamento e demais avisos
do sistema (consulta agendada, receita/exame/atestado disponível, avisos gerais
e alertas de segurança).

> Fonte da verdade do backend: [`supabase/migrations/20260612000000_notifications.sql`](supabase/migrations/20260612000000_notifications.sql)
> Testes: [`supabase/tests/notifications_test.sql`](supabase/tests/notifications_test.sql)

---

## 1. Fluxo da feature

### Vencimento de plano (automático)
```
pg_cron (diário 12:00 UTC ≈ 09:00 BRT)
        │
        ▼
run_plan_expiry_notifications()
        │  varre user_subscriptions ativas com expires_at
        │  calcula days_remaining → bucket (15/10/5/1/0/expired)
        │  INSERT notifications (dedup_key único por marco+vencimento)
        ▼
Supabase Realtime (postgres_changes na tabela notifications)
        │
        ▼
useNotifications (front)  ──►  Sino + contador + dropdown + Banner
```

### Pagamento confirmado (evento)
```
CheckoutSubscription.handleSuccess()
        │  cria assinatura ativa
        ▼
createNotification('payment_confirmed', …)
        │
        ▼
trigger notifications_after_insert
        │  marca como lidas as notificações plan_expiring / plan_expired /
        │  payment_pending ainda não lidas do mesmo usuário
        ▼
Banner some, sino atualiza em tempo real
```

### Documento emitido pelo médico (evento)
```
Médico emite receita/exame/atestado (MedicoAtendimento)
        │  • clinical_data (rascunho): medications/examRequests/certificate
        │      └─ trigger consultations_notify_documents (AFTER INSERT/UPDATE OF clinical_data)
        │  • receita assinada: consultation_prescriptions (PDF + medications)
        │      └─ trigger consultation_prescriptions_notify (AFTER INSERT/UPDATE)
        │  • exame/atestado assinados: consultation_documents (PDF)
        │      └─ trigger consultation_documents_notify (AFTER INSERT/UPDATE)
        ▼
INSERT notifications (1 por tipo de documento)
        │  dedup_key = consultation_doc:<consulta>:<tipo> — compartilhado pelas
        │  duas fontes → no máximo 1 notificação de receita por consulta
        ▼
Supabase Realtime → sino/contador do paciente → /consulta/:id/detalhes (documento já visível)
```

### Leitura
```
Usuário abre o sino/página → markRead / markAllRead (RPC)
        → UPDATE protegido por RLS + trigger (só is_read/read_at mudam)
        → Realtime atualiza contador em todas as abas
```

---

## 2. Estrutura de banco

### Tabela `public.notifications`
| Coluna         | Tipo          | Notas |
|----------------|---------------|-------|
| `id`           | uuid PK       | `gen_random_uuid()` |
| `user_id`      | uuid          | FK `auth.users(id) ON DELETE CASCADE` |
| `type`         | text          | CHECK com os 10 tipos (ver §3) |
| `title`        | text          | título curto |
| `body`         | text          | texto (sem PII clínica) |
| `action_label` | text null     | rótulo do botão de ação |
| `action_url`   | text null     | rota interna (ex.: `/meu-plano`) |
| `is_read`      | bool          | default `false` |
| `read_at`      | timestamptz   | carimbado pelo trigger ao ler |
| `dedup_key`    | text null     | chave de deduplicação |
| `metadata`     | jsonb         | ids/contagens p/ navegação (sem PII) |
| `created_at`   | timestamptz   | default `now()` |

**Índices**
- `notifications_dedup_key_uniq` — UNIQUE parcial `(dedup_key) WHERE dedup_key IS NOT NULL` → trava de duplicidade.
- `notifications_user_created_idx` — `(user_id, created_at DESC)` → listagem.
- `notifications_user_unread_idx` — `(user_id) WHERE is_read = false` → contagem de não lidas.

**Triggers**
- `notifications_guard_update` (BEFORE UPDATE) — congela o conteúdo; só `is_read`/`read_at` podem mudar; carimba `read_at`.
- `notifications_after_insert` (AFTER INSERT) — `payment_confirmed` encerra alertas de cobrança/vencimento não lidos.

**Realtime** — `REPLICA IDENTITY FULL` + tabela na publication `supabase_realtime`.

---

## 3. Tipos de notificação

| `type`                    | Tom     | Uso |
|---------------------------|---------|-----|
| `plan_expiring`           | warning | Plano vencendo (15/10/5/1/0 dias) |
| `plan_expired`            | danger  | Plano vencido |
| `payment_pending`         | warning | Pagamento pendente |
| `payment_confirmed`       | success | Pagamento confirmado |
| `consultation_scheduled`  | info    | Consulta agendada |
| `prescription_available`  | info    | Receita disponível (emitida pelo médico) |
| `exam_available`          | info    | Exame disponível (emitido pelo médico) |
| `certificate_available`   | info    | Atestado disponível (emitido pelo médico) |
| `general`                 | info    | Aviso geral da plataforma |
| `security_alert`          | danger  | Alerta de segurança |

Mapeamento ícone/cor/rótulo: [`src/types/notification.ts`](src/types/notification.ts).

---

## 4. Textos das notificações de plano

| Marco        | `type`          | Texto |
|--------------|-----------------|-------|
| 15 dias      | `plan_expiring` | Seu plano termina em 15 dias. Renove para continuar usando a plataforma sem interrupções. |
| 10 dias      | `plan_expiring` | Seu plano termina em 10 dias. Mantenha seu acesso ativo renovando antes do vencimento. |
| 5 dias       | `plan_expiring` | Faltam 5 dias para o fim do seu plano. Evite bloqueios renovando sua assinatura. |
| 1 dia        | `plan_expiring` | Seu plano termina amanhã. Renove para continuar usando a plataforma normalmente. |
| Hoje (0)     | `plan_expiring` | Seu plano vence hoje. Renove agora para evitar limitações de acesso. |
| Vencido      | `plan_expired`  | Seu plano expirou. Algumas funcionalidades podem estar indisponíveis até a renovação. |
| Pagamento OK | `payment_confirmed` | Pagamento confirmado. Seu plano está ativo novamente. |

Definidos no servidor em `run_plan_expiry_notifications()` (texto não depende do client).

---

## 5. Endpoints (RPCs Postgres)

Todas exigem JWT (usuário autenticado). Chamadas pelo front via `supabase.rpc`
encapsuladas em [`src/lib/notifications.ts`](src/lib/notifications.ts).

| Função | Args | Retorno | Autorização |
|--------|------|---------|-------------|
| `unread_notification_count()` | — | `int` | dono (auth.uid()) |
| `mark_notification_read(p_id)` | uuid | void | dono |
| `mark_all_notifications_read()` | — | `int` (qtde) | dono |
| `create_notification(p_type,p_title,p_body,p_action_label,p_action_url,p_dedup_key,p_metadata)` | … | `uuid` | cria para si mesmo |
| `admin_create_notification(p_user_id,…)` | … | `uuid` | **admin / service_role** |
| `broadcast_notification(p_type,p_title,p_body,p_action_label,p_action_url,p_dedup_tag)` | … | `int` | **admin / service_role** |
| `get_plan_status()` | — | linha (has_plan, status, plan_name, expires_at, days_remaining, bucket) | dono |
| `admin_run_plan_expiry_notifications()` | — | `int` | **admin / service_role** |
| `run_plan_expiry_notifications()` | — | `int` | só pg_cron/postgres (não exposta) |

Listagem das notificações: `SELECT` direto na tabela protegido por RLS
(`listNotifications()` no client).

---

## 6. Componentes frontend

| Arquivo | Papel |
|---------|-------|
| [`src/hooks/useNotifications.ts`](src/hooks/useNotifications.ts) | Lista + contador + realtime + markRead/markAllRead |
| [`src/hooks/usePlanStatus.ts`](src/hooks/usePlanStatus.ts) | Snapshot do plano (vencendo/vencido) via `get_plan_status()` |
| [`src/lib/notifications.ts`](src/lib/notifications.ts) | Cliente das RPCs/queries |
| [`src/types/notification.ts`](src/types/notification.ts) | Tipos + ícone/cor/rótulo por tipo |
| [`src/components/notifications/NotificationBell.tsx`](src/components/notifications/NotificationBell.tsx) | Sino + badge + dropdown (últimas 8) |
| [`src/components/notifications/NotificationItem.tsx`](src/components/notifications/NotificationItem.tsx) | Linha reutilizável (dropdown e página) |
| [`src/components/notifications/PlanStatusBanner.tsx`](src/components/notifications/PlanStatusBanner.tsx) | Banner (vencendo, dispensável) / alerta (vencido) |
| [`src/pages/Notificacoes.tsx`](src/pages/Notificacoes.tsx) | Página `/notificacoes` (todas, filtro, marcar lidas) |

**Integração:** o sino e o banner entram no topbar/shell em
[`src/components/layout/PatientLayout.tsx`](src/components/layout/PatientLayout.tsx);
rota `/notificacoes` em [`src/App.tsx`](src/App.tsx); `payment_confirmed`
emitido em [`src/pages/CheckoutSubscription.tsx`](src/pages/CheckoutSubscription.tsx).

---

## 7. Regras de negócio

1. **Marcos de vencimento:** notifica exatamente em 15, 10, 5, 1 e 0 dias e quando vencido.
2. **Sem duplicatas:** `dedup_key = plan_expiry:<sub_id>:<expires_date>:<bucket>` + índice único. Rodar a varredura N vezes no mesmo dia cria no máximo 1 por marco.
3. **Renovação reabre o ciclo:** como a `dedup_key` inclui a data de vencimento, uma assinatura renovada (novo `expires_at`) volta a gerar os avisos do novo ciclo.
4. **Pagamento confirmado limpa alertas:** ao inserir `payment_confirmed`, alertas `plan_expiring`/`plan_expired`/`payment_pending` não lidos do usuário viram lidos.
5. **Conteúdo imutável:** usuário só alterna lida/não lida; nunca reescreve título/corpo/tipo (trigger).
6. **Banner:** vencido = alerta vermelho fixo; vencendo = banner âmbar dispensável na sessão.
7. **Documento do médico → paciente:** ao emitir receita/exame/atestado (gravação em `consultations.clinical_data`, durante ou após a consulta), o trigger `consultations_notify_documents` cria 1 notificação por tipo de documento para o paciente. `dedup_key = consultation_doc:<consulta>:<tipo>` impede duplicatas nos vários saves debounced. A ação leva a `/consulta/:id/detalhes`, onde o documento é exibido.

---

## 8. Segurança e LGPD

- **RLS:** `notifications_own_read` / `notifications_own_update` restringem a `auth.uid() = user_id`; admins têm leitura via `notifications_admin_read`.
- **Sem INSERT/DELETE para o client:** linhas só nascem por funções `SECURITY DEFINER` → impossível forjar notificação de terceiros.
- **Escopo de criação:** `create_notification` cria só para si; `admin_create_notification`/`broadcast_notification` exigem admin/service_role.
- **Sem PII clínica:** textos não contêm CPF, diagnóstico, receita, nome de medicamento nem URL de exame. IDs ficam em `metadata` apenas para navegação.
- **Autenticação:** toda RPC valida `auth.uid()`; sweep diário não é exposto a `authenticated`.
- **Auditoria:** criação/leitura importantes registram evento sem PII em `audit_events` via `notifications_audit()` (tolerante à ausência da tabela).

---

## 9. Cenários de teste

Arquivo executável (transação + ROLLBACK, não persiste dados):
[`supabase/tests/notifications_test.sql`](supabase/tests/notifications_test.sql).

| # | Cenário | Resultado esperado |
|---|---------|--------------------|
| 1 | Varredura com 15/10/5/1/0 dias | 6 notificações com textos corretos |
| 2 | Rodar a varredura de novo | 0 novas (idempotente) |
| 3 | Marcar uma como lida | contador de não lidas cai; `read_at` carimbado |
| 4 | Marcar todas como lidas | não lidas = 0 |
| 5 | Usuário acessa/altera notificação de outro | RLS bloqueia (0 linhas) |
| 6 | Plano vencido | gera `plan_expired` |
| 7 | Pagamento confirmado | encerra alerta de vencimento |
| + | Tentar reescrever conteúdo | trigger rejeita |

Como rodar: cole o arquivo no SQL Editor do Supabase e execute → `✅ TODOS OS TESTES PASSARAM`.

---

## 10. Cards técnicos

- **NOTIF-01 — Migration base.** Tabela `notifications`, índices (incl. único parcial de dedup), RLS, triggers de guarda e de pagamento, realtime. _DoD: migration idempotente aplicada; RLS verificada._
- **NOTIF-02 — RPCs.** `unread_notification_count`, `mark_notification_read`, `mark_all_notifications_read`, `create_notification`, `admin_create_notification`, `broadcast_notification`, `get_plan_status`. _DoD: grants corretos; admin-only protegidas._
- **NOTIF-03 — Rotina diária.** `run_plan_expiry_notifications()` + agendamento pg_cron guardado + wrapper admin. _DoD: marcos corretos; dedup ok; cron agendado OU fallback documentado._
- **NOTIF-04 — Cliente + hooks.** `src/lib/notifications.ts`, `useNotifications`, `usePlanStatus`. _DoD: realtime atualiza contador; sem erro de tipo._
- **NOTIF-05 — UI.** Sino, item, banner, página `/notificacoes`; wiring no PatientLayout/App. _DoD: badge, dropdown, marcar lidas, banner vencendo/vencido._
- **NOTIF-06 — Evento de pagamento.** Emitir `payment_confirmed` no sucesso do checkout. _DoD: alerta de vencimento some após pagar._
- **NOTIF-07 — Testes.** `supabase/tests/notifications_test.sql` cobrindo os 7 cenários. _DoD: suíte passa do zero._

---

## 11. Deploy

1. Aplicar as migrations `20260612000000_notifications.sql` e `20260617000000_notify_patient_documents.sql` (SQL Editor ou `supabase db push`).
2. **(rotina diária)** Habilitar pg_cron: Dashboard → Database → Extensions → `pg_cron`. O bloco guardado na migration agenda o job automaticamente quando a extensão existe. Sem pg_cron, agende um chamador externo (cron/edge) para `admin_run_plan_expiry_notifications()` ou `run_plan_expiry_notifications()`.
3. Publicar o front. O sino/banner aparecem na área logada do paciente; `/notificacoes` lista todas.
4. Validar com `supabase/tests/notifications_test.sql`.
