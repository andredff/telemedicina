# CHECKLIST DE ENTREGAS - MVP NOVITA TELEMEDICINA

**Uso Interno - Desenvolvimento**
**Contrato**: 001/2026
**Prazo**: 30 dias corridos

---

## RESUMO DE STATUS

| Modulo | Total | Concluido | Pendente | % |
|--------|-------|-----------|----------|---|
| Infraestrutura | 8 | 0 | 8 | 0% |
| Landing Page | 12 | 0 | 12 | 0% |
| Sistema de Assinaturas | 10 | 0 | 10 | 0% |
| Telemedicina | 5 | 0 | 5 | 0% |
| Medicamento em Casa | 8 | 0 | 8 | 0% |
| Painel Admin | 6 | 0 | 6 | 0% |
| Testes e Deploy | 7 | 0 | 7 | 0% |
| **TOTAL** | **56** | **0** | **56** | **0%** |

---

## SEMANA 1 - INFRAESTRUTURA E INTEGRACOES

### 1.1 Setup do Ambiente

- [ ] Configurar ambiente de desenvolvimento local
- [ ] Criar projeto no Supabase (producao)
- [ ] Criar projeto no Supabase (staging/homologacao)
- [ ] Configurar variaveis de ambiente (.env)
- [ ] Configurar CI/CD (deploy automatico)

### 1.2 Banco de Dados (Supabase)

- [ ] Criar tabela `profiles` (dados dos usuarios)
- [ ] Criar tabela `subscription_plans` (planos disponiveis)
- [ ] Criar tabela `user_subscriptions` (assinaturas ativas)
- [ ] Criar tabela `dependents` (dependentes do assinante)
- [ ] Criar tabela `prescriptions` (receitas medicas)
- [ ] Criar tabela `medications` (medicamentos)
- [ ] Criar tabela `cart_items` (carrinho de compras)
- [ ] Criar tabela `orders` (pedidos de medicamentos)
- [ ] Criar tabela `payments` (historico de pagamentos)
- [ ] Configurar Row Level Security (RLS) em todas as tabelas
- [ ] Criar funcoes e triggers necessarios

### 1.3 Autenticacao

- [ ] Configurar Supabase Auth
- [ ] Implementar registro de usuarios
- [ ] Implementar login (email/senha)
- [ ] Implementar recuperacao de senha
- [ ] Implementar verificacao de e-mail
- [ ] Criar hook `useAuth` para gerenciamento de estado

### 1.4 Integracao Gateway de Pagamento

- [ ] Configurar cliente Cielo (ou gateway escolhido)
- [ ] Implementar processamento de cartao de credito
- [ ] Implementar cobranca recorrente
- [ ] Implementar pagamento PIX
- [ ] Testar em ambiente sandbox
- [ ] Criar mock client para desenvolvimento local

### 1.5 Integracao Telemedicina White Label

- [ ] Obter credenciais da plataforma parceira
- [ ] Implementar autenticacao na plataforma parceira
- [ ] Configurar iFrame de integracao
- [ ] Testar fluxo de consulta
- [ ] Documentar processo de integracao

### 1.6 Configuracao de Dominio

- [ ] Configurar DNS apontando para Vercel/Netlify
- [ ] Configurar certificado SSL
- [ ] Testar acesso via HTTPS
- [ ] Configurar redirects (www -> non-www ou vice-versa)

---

## SEMANA 2 - PORTAL DO PACIENTE

### 2.1 Landing Page - Estrutura

- [ ] Criar componente `PublicHeader` (menu navegacao)
- [ ] Criar componente `Footer`
- [ ] Implementar navegacao responsiva (mobile menu)
- [ ] Criar layout base para paginas publicas

### 2.2 Landing Page - Secoes

- [ ] **Hero Section**: Banner principal com CTA
- [ ] **Sobre a Empresa**: Texto institucional, missao, visao, valores
- [ ] **Home Care**: Cards de servicos de home care
- [ ] **Telemedicina**: Cards de servicos de telemedicina
- [ ] **Nossa Historia**: Timeline/texto da historia
- [ ] **Diferenciais**: Cards de diferenciais competitivos
- [ ] **UTI Movel**: Secao especifica (se aplicavel)
- [ ] **Planos**: Preview dos planos com CTA
- [ ] **Estatisticas**: Numeros da empresa
- [ ] **Contato**: Informacoes de contato
- [ ] **FAQ**: Accordion com perguntas frequentes

### 2.3 Landing Page - Otimizacoes

- [ ] Implementar SEO (meta tags, Open Graph)
- [ ] Otimizar imagens (lazy loading, formatos modernos)
- [ ] Garantir responsividade em todos os breakpoints
- [ ] Testar performance (Lighthouse score > 90)
- [ ] Implementar animacoes sutis (scroll reveal)

### 2.4 Pagina de Planos

- [ ] Criar pagina `/planos`
- [ ] Implementar cards de planos com precos
- [ ] Implementar toggle mensal/anual
- [ ] Destacar plano mais popular
- [ ] Implementar CTA para checkout
- [ ] Incluir secao de FAQ especifica
- [ ] Incluir opcao de consulta avulsa

### 2.5 Sistema de Assinaturas

- [ ] Criar fluxo de selecao de plano
- [ ] Criar formulario de cadastro do assinante
- [ ] Implementar validacao de dados (Zod)
- [ ] Criar pagina de checkout
- [ ] Implementar processamento de pagamento
- [ ] Criar confirmacao de assinatura
- [ ] Enviar e-mail de boas-vindas
- [ ] Redirecionar para area do usuario

### 2.6 Area do Usuario (Dashboard)

- [ ] Criar layout autenticado
- [ ] Implementar sidebar de navegacao
- [ ] **Meu Plano**: Exibir plano atual e beneficios
- [ ] **Meus Dados**: Formulario de edicao de perfil
- [ ] **Metodo de Pagamento**: Gestao de cartoes
- [ ] **Historico de Pagamentos**: Lista de transacoes
- [ ] **Dependentes**: Adicionar/remover dependentes (se aplicavel)
- [ ] Implementar logout

---

## SEMANA 3 - TELEMEDICINA E E-COMMERCE

### 3.1 Controle de Acesso Telemedicina

- [ ] Implementar verificacao de status da assinatura
- [ ] Verificar adimplencia antes de liberar acesso
- [ ] Exibir mensagem clara para inadimplentes
- [ ] Criar fluxo de regularizacao de pagamento

### 3.2 Integracao White Label

- [ ] Criar pagina `/consulta` ou `/telemedicina`
- [ ] Implementar iFrame com plataforma parceira
- [ ] Garantir experiencia visual integrada
- [ ] Testar fluxo completo de consulta
- [ ] Documentar limitacoes conhecidas

### 3.3 Modulo Medicamento em Casa - Busca

- [ ] Criar pagina `/medicamentos`
- [ ] Implementar campo de busca por codigo/token
- [ ] Criar API de busca de receitas
- [ ] Exibir dados da receita encontrada
- [ ] Tratar casos de receita nao encontrada
- [ ] Validar receitas (prazo de validade)

### 3.4 Modulo Medicamento em Casa - Carrinho

- [ ] Exibir medicamentos da receita
- [ ] Implementar adicao ao carrinho
- [ ] Criar pagina de carrinho `/carrinho`
- [ ] Implementar alteracao de quantidade
- [ ] Implementar remocao de itens
- [ ] Calcular subtotais e total
- [ ] Persistir carrinho no banco de dados

### 3.5 Modulo Medicamento em Casa - Checkout

- [ ] Criar pagina de checkout `/checkout/medication`
- [ ] Implementar formulario de endereco de entrega
- [ ] Integrar pagamento (Cartao e PIX)
- [ ] Criar tela de confirmacao de pedido
- [ ] Gerar numero do pedido
- [ ] Enviar e-mail de confirmacao

### 3.6 Notificacao de Logistica

- [ ] Implementar disparo de ordem de servico
- [ ] Criar webhook/API para integracao logistica
- [ ] Enviar notificacao para equipe de separacao
- [ ] Criar template de e-mail para cliente

### 3.7 Painel Administrativo - Dashboard

- [ ] Criar layout administrativo (`/admin`)
- [ ] Implementar autenticacao de admin
- [ ] **Metricas de Assinantes**: Total, por plano, novos
- [ ] **Metricas de Inadimplencia**: Taxa, valor
- [ ] **Receita (MRR)**: Mensal recorrente
- [ ] **Graficos**: Evolucao temporal
- [ ] Implementar filtros por periodo

### 3.8 Painel Administrativo - Gestao de Pedidos

- [ ] Criar listagem de pedidos
- [ ] Implementar filtros (status, data, cliente)
- [ ] Criar visualizacao detalhada do pedido
- [ ] Implementar atualizacao de status
- [ ] Exibir informacoes de pagamento
- [ ] Exibir informacoes de entrega

---

## SEMANA 4 - TESTES E GO-LIVE

### 4.1 Testes Funcionais

- [ ] Testar fluxo de cadastro de usuario
- [ ] Testar fluxo de assinatura completo
- [ ] Testar cobranca recorrente (simulado)
- [ ] Testar acesso a telemedicina (adimplente)
- [ ] Testar bloqueio telemedicina (inadimplente)
- [ ] Testar busca de receita
- [ ] Testar carrinho de medicamentos
- [ ] Testar checkout de medicamentos
- [ ] Testar painel administrativo

### 4.2 Testes de Integracao

- [ ] Testar integracao gateway de pagamento
- [ ] Testar integracao plataforma telemedicina
- [ ] Testar envio de e-mails
- [ ] Testar webhooks de pagamento

### 4.3 Testes de Performance e Seguranca

- [ ] Executar Lighthouse (score > 90)
- [ ] Testar em dispositivos moveis reais
- [ ] Verificar headers de seguranca
- [ ] Testar protecao contra CSRF
- [ ] Verificar sanitizacao de inputs
- [ ] Testar rate limiting (se implementado)

### 4.4 Migracao para Producao

- [ ] Atualizar variaveis de ambiente de producao
- [ ] Configurar gateway em modo producao
- [ ] Verificar configuracoes de Supabase producao
- [ ] Realizar deploy para producao
- [ ] Testar todos os fluxos em producao
- [ ] Monitorar logs de erro

### 4.5 Documentacao

- [ ] Criar documentacao de acesso ao sistema
- [ ] Documentar credenciais e acessos
- [ ] Criar guia de uso do painel admin
- [ ] Documentar APIs e integracoes
- [ ] Entregar codigo fonte ao cliente

### 4.6 Treinamento

- [ ] Agendar sessao de treinamento
- [ ] Treinar equipe no painel administrativo
- [ ] Treinar equipe no fluxo de pedidos
- [ ] Documentar procedimentos operacionais
- [ ] Definir canais de suporte

### 4.7 Go-Live

- [ ] Obter aceite formal do cliente
- [ ] Publicar versao final em producao
- [ ] Monitorar primeiras horas/dias
- [ ] Resolver bugs criticos rapidamente
- [ ] Formalizar inicio do periodo de garantia

---

## PAGINAS DO SISTEMA

### Paginas Publicas

| Rota | Descricao | Status |
|------|-----------|--------|
| `/` | Landing Page | ( ) |
| `/planos` | Pagina de Planos | ( ) |
| `/como-funciona` | Como Funciona | ( ) |
| `/blog` | Blog (estatico no MVP) | ( ) |
| `/blog/:id` | Post do Blog | ( ) |
| `/auth` | Login/Cadastro | ( ) |
| `/reset-password` | Recuperar Senha | ( ) |

### Paginas do Usuario

| Rota | Descricao | Status |
|------|-----------|--------|
| `/dashboard` | Dashboard do Usuario | ( ) |
| `/prescriptions` | Minhas Receitas | ( ) |
| `/prescriptions/:id` | Detalhe da Receita | ( ) |
| `/medications` | Buscar Medicamentos | ( ) |
| `/cart` | Carrinho | ( ) |
| `/checkout/subscription` | Checkout Assinatura | ( ) |
| `/checkout/medication` | Checkout Medicamentos | ( ) |
| `/orders` | Meus Pedidos | ( ) |
| `/telemedicine` | Acesso Telemedicina | ( ) |

### Paginas Admin

| Rota | Descricao | Status |
|------|-----------|--------|
| `/admin` | Dashboard Admin | ( ) |
| `/admin/users` | Gestao de Usuarios | ( ) |
| `/admin/orders` | Gestao de Pedidos | ( ) |
| `/admin/prescriptions` | Gestao de Receitas | ( ) |
| `/admin/reports` | Relatorios | ( ) |
| `/admin/content` | Gestao de Conteudo | ( ) |
| `/admin/settings` | Configuracoes | ( ) |

---

## COMPONENTES PRINCIPAIS

### UI Components (shadcn/ui)

- [ ] Button
- [ ] Card
- [ ] Input
- [ ] Form
- [ ] Dialog
- [ ] Sheet (sidebar mobile)
- [ ] Tabs
- [ ] Accordion
- [ ] Badge
- [ ] Avatar
- [ ] Toast/Sonner
- [ ] Table
- [ ] Select
- [ ] Switch
- [ ] Skeleton (loading)

### Custom Components

- [ ] PublicHeader
- [ ] Footer
- [ ] PlanCard
- [ ] PrescriptionCard
- [ ] MedicationCard
- [ ] CartItem
- [ ] OrderCard
- [ ] PaymentForm
- [ ] AddressForm
- [ ] StatsCard
- [ ] ChartCard

---

## INTEGRACAO COM SUPABASE

### Tabelas Existentes (verificar/atualizar)

| Tabela | Status | Observacoes |
|--------|--------|-------------|
| profiles | ( ) | |
| subscription_plans | ( ) | |
| user_subscriptions | ( ) | |
| dependents | ( ) | |
| prescriptions | ( ) | |
| medications | ( ) | |
| cart_items | ( ) | |
| orders | ( ) | |
| order_items | ( ) | |
| payments | ( ) | |

### Funcoes RPC (se necessario)

| Funcao | Descricao | Status |
|--------|-----------|--------|
| get_user_subscription | Retorna assinatura ativa | ( ) |
| check_payment_status | Verifica adimplencia | ( ) |
| create_order | Cria pedido de medicamentos | ( ) |

---

## NOTAS DE IMPLEMENTACAO

### Prioridades

1. **Critico**: Checkout de assinaturas funcionando
2. **Critico**: Integracao telemedicina funcionando
3. **Alto**: Landing page completa
4. **Alto**: Modulo medicamentos
5. **Medio**: Painel admin
6. **Baixo**: Otimizacoes de performance

### Pontos de Atencao

- Garantir que o gateway funcione em modo recorrente
- Validar fluxo de inadimplencia antes de liberar telemedicina
- Testar iFrame em dispositivos moveis
- Garantir que e-mails sejam enviados corretamente
- Manter codigo limpo e documentado

---

## LOG DE ALTERACOES

| Data | Alteracao | Responsavel |
|------|-----------|-------------|
| ___/___/2026 | Documento criado | Migrai |
| | | |
| | | |

---

*Documento de uso interno - Migrai Tecnologia*
*Ultima atualizacao: ___/___/2026*
