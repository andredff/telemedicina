# Escopo Fechado - Novita Telemedicina (MVP)

## 1. Contexto e objetivo

Este documento consolida o escopo fechado do MVP conforme contrato e serve como guia de implementacao para o time de desenvolvimento. Ele tambem registra a validacao do que ja esta pronto no repositorio.

## 2. Escopo funcional do MVP

### 2.1 Portal do paciente e venda de planos

- Landing page institucional otimizada para conversao (aceite: pagina publica com apresentacao da Novita e CTA para planos).
- Sistema de assinaturas para planos Bronze, Prata, Ouro, Platina e Coletivo (aceite: usuario consegue escolher plano e seguir para checkout).
- Checkout recorrente integrado a gateway (aceite: pagamento recorrente aprovado em cartao e retorno de status para o usuario).
- Area do usuario (painel do assinante) com gestao de dados e acompanhamento do plano (aceite: usuario visualiza plano ativo e consegue atualizar dados cadastrais).

### 2.2 Core: telemedicina integrada

- Controle de acesso com verificacao de adimplencia (aceite: usuario inadimplente nao inicia consulta; usuario adimplente inicia).
- Integracao white label de telemedicina via iFrame (aceite: iFrame funcional com sala de espera/consulta).

### 2.3 Modulo Medicamento em Casa

- Busca de receita por protocolo/codigo/token (aceite: busca retorna receita valida e navega para detalhes).
- Mineracao/localizacao de receita (aceite: resultado inclui dados da receita e medicamentos).
- Carrinho de compras para medicamentos prescritos (aceite: adicionar/remover/alterar quantidade).
- Checkout de medicamentos com cartao e PIX (aceite: pagamento aprovado em cartao ou PIX, pedido confirmado).
- Notificacao logistica para ordem de servico (aceite: OS registrada e notificacao enviada para logistica).

### 2.4 Painel administrativo de gestao

- Dashboard financeiro com metricas de assinantes (aceite: MRR, churn, inadimplencia e distribuicao de planos).
- Gestao de pedidos com status e rastreio (aceite: admin atualiza status, registra rastreio e cliente visualiza).

## 3. Fluxos principais do MVP

- Assinatura: planos -> autenticacao -> checkout assinatura -> ativacao e registro da assinatura.
- Telemedicina: login -> validacao de assinatura -> escolha de especialidade -> consulta -> iFrame.
- Medicamentos: buscar receita -> selecionar medicamentos -> carrinho -> checkout -> pedido -> notificacao logistica.
- Admin pedidos: listar -> atualizar status -> notificar cliente -> registrar rastreio.

## 4. Integracoes e dependencias

- Supabase: Auth, Database, Storage (dados de perfis, prescricoes, pedidos e assinaturas).
- Cielo: pagamento recorrente e avulso (cartao). Modo mock quando nao configurado.
- Assemed (telemedicina): login, cadastro de paciente, consulta e sala de espera.
- Email/logistica: notificacoes e ordem de servico (integracao real a definir; hoje simulado).

### Variaveis de ambiente minimas

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_CIELO_MERCHANT_ID (opcional, usa mock se ausente)
- VITE_CIELO_MERCHANT_KEY (opcional, usa mock se ausente)
- VITE_CIELO_SANDBOX (opcional)

## 5. Dados e tabelas minimas

- profiles
- subscription_plans
- user_subscriptions
- prescriptions
- medications
- orders
- order_notifications
- logistics_service_orders

## 6. Requisitos nao funcionais

- Segurança: HTTPS, regras RLS no Supabase, protecao de dados pessoais.
- Observabilidade: logs estruturados e tratamento de erros.
- Performance: carregamento inicial consistente e sem erros de build.

## 7. Exclusoes (Fase 2)

- Cupons e codigos promocionais.
- Recorrencia automatica de medicamentos.
- Integracao fiscal (NF-e).
- Agendamento avancado com multiplas agendas.
- Blog dinamico com CMS e SEO.
- Qualquer item nao listado no escopo funcional do MVP.

## 8. Criterios de aceite do MVP

- Todas as funcionalidades do escopo estao operacionais.
- MVP acessivel em producao.
- Integracoes com gateway e telemedicina funcionando (dependentes de credenciais).
- Painel administrativo funcional e acessivel.

## 9. Validacao do estado atual no repositorio

Legenda de status:

- READY: implementado e funcional com dependencias configuradas.
- PARTIAL: implementacao parcial, dependencias externas ou ajustes pendentes.
- NOT READY: nao implementado.

Portal do paciente e venda de planos

- Landing page institucional: READY (src/pages/Index.tsx).
- Pagina de planos e CTA de assinatura: READY (src/pages/Plans.tsx).
- Checkout recorrente (cartao): PARTIAL (cartao via Cielo com mock; depende credenciais e persistencia completa de assinatura) (src/pages/CheckoutSubscription.tsx, src/components/checkout/SubscriptionCheckout.tsx).
- Area do usuario com gestao de dados e plano: PARTIAL (dashboard existe, mas plano e dados sao limitados e sem edicao) (src/pages/Dashboard.tsx).

Core telemedicina integrada

- Controle de acesso por assinatura: PARTIAL (checa assinatura ativa; inadimplencia real depende dados de pagamento) (src/services/telemedicineService.ts, src/pages/Telemedicine.tsx).
- Integracao white label via iFrame: PARTIAL (integ Assemed depende credenciais) (src/pages/Telemedicine.tsx, src/services/telemedicineService.ts).

Modulo Medicamento em Casa

- Busca de receita por codigo: READY (com fallback mock) (src/pages/Medications.tsx, src/integrations/supabase/searchClient.ts).
- Detalhe de receita e selecao de medicamentos: READY (src/pages/PrescriptionDetail.tsx).
- Carrinho de compras: READY (localStorage) (src/pages/Cart.tsx).
- Checkout medicamentos com cartao: PARTIAL (cartao OK; PIX nao implementado) (src/pages/CheckoutMedication.tsx, src/components/checkout/MedicationCheckout.tsx).
- Notificacao logistica/OS: PARTIAL (simulada; depende tabelas/servico real) (src/services/notificationService.ts, src/pages/admin/Orders.tsx).

Painel administrativo de gestao

- Dashboard financeiro: PARTIAL (usa supabase ou mock) (src/pages/admin/Dashboard.tsx, src/services/financialMetricsService.ts).
- Gestao de pedidos: PARTIAL (status altera apenas em memoria; persistencia e rastreio no banco pendentes) (src/pages/admin/Orders.tsx).

Outros pontos de atencao (nao bloqueiam o MVP, mas exigem ajuste)

- PIX nao implementado no checkout de medicamentos.
- Atualizacao de status/rastreio de pedidos nao persiste no banco.
- Controle de inadimplencia depende de campos e regras no Supabase.
