# Plano Completo de Testes em Producao - Novita

## Parte 1: Cleanup Pendente (PIX removido de assinaturas)

O `SubscriptionCheckout.tsx` ja foi limpo - PIX removido das assinaturas. Restam itens de cleanup menor:

### 1.1 Codigo morto a remover

**`src/integrations/cielo/types.ts`**
- Remover tipos `CreatePixSaleRequest` e `PixSaleResponse` (nao sao mais usados em nenhum lugar)

**`src/components/checkout/PixPaymentForm.tsx`**
- Remover props opcionais `generatePayment`, `checkStatus`, `confirmPayment` e os types `PixGenerator`, `PixStatusChecker`, `PixConfirmer`
- Hardcodar as funcoes de medicamento diretamente (`processMedicationPixPayment`, `getPixPaymentStatus`, `confirmPixPayment`)
- Componente fica mais simples e so serve para medicamentos

**`tests/e2e/cielo-checkout.spec.ts`**
- Remover test "Yearly PIX subscription generates QR and confirms" (linhas 226-275)
- Remover test "Switching from yearly to monthly hides PIX toggle" (linhas 277-317)
- Os testes de assinatura devem ser apenas cartao de credito (mensal e anual)

### 1.2 Build e validacao

```bash
npm run build   # Verificar que compila sem erros
npm run lint    # Verificar lint
```

---

## Parte 2: Plano de Testes de Producao

### Legenda de Prioridade
- **P0** = Critico (bloqueia uso da plataforma)
- **P1** = Alto (funcionalidade core afetada)
- **P2** = Medio (funcionalidade secundaria)
- **P3** = Baixo (visual/UX)

### Pre-requisitos
- Conta de paciente: `paciente01@novita.com` / `Paciente#123`
- Conta de admin: `admin@novita.com` / `Admin#123`
- Cartao de teste: `4024 0071 5376 3191` / Nome: `TESTE` / Validade: `12/2030` / CVV: `123`
- Navegador: Chrome/Firefox atualizado
- URL de producao: (definir)

---

## MODULO 1: Paginas Publicas

### TC-001 [P0] Homepage carrega corretamente
**Rota:** `/`
**Passos:**
1. Acessar URL raiz
2. Verificar que o titulo da pagina contem "Novita"
3. Verificar que secoes principais sao visiveis: Hero, Servicos, Planos, Contato
4. Clicar em "Ver Planos" no hero
**Resultado esperado:** Redireciona para `/planos`

### TC-002 [P2] Pagina Como Funciona
**Rota:** `/como-funciona`
**Passos:**
1. Acessar `/como-funciona`
2. Verificar titulo "Como funciona"
3. Verificar que as etapas do fluxo estao visiveis
**Resultado esperado:** Pagina carrega com conteudo completo

### TC-003 [P2] Pagina de Medicamentos (publica)
**Rota:** `/medicamentos`
**Passos:**
1. Acessar `/medicamentos`
2. Verificar campo de busca de receita
3. Digitar um codigo de receita invalido
4. Verificar que nao redireciona
**Resultado esperado:** Pagina carrega, busca funciona sem erro

### TC-004 [P3] Paginas legais
**Rotas:** `/termos`, `/privacidade`, `/cancelamento`
**Passos:**
1. Acessar cada rota
2. Verificar que conteudo textual e exibido
**Resultado esperado:** Paginas carregam sem erros

### TC-005 [P3] Pagina 404
**Rota:** `/rota-que-nao-existe`
**Passos:**
1. Acessar rota invalida
2. Verificar mensagem "Pagina nao encontrada"
**Resultado esperado:** Exibe 404 com link para voltar

---

## MODULO 2: Autenticacao

### TC-010 [P0] Login com credenciais validas
**Rota:** `/auth`
**Passos:**
1. Acessar `/auth`
2. Clicar na aba "Login"
3. Preencher email e senha validos
4. Clicar "Entrar"
**Resultado esperado:** Redireciona para `/dashboard`, exibe "Ola, [nome]"

### TC-011 [P0] Login com credenciais invalidas
**Passos:**
1. Acessar `/auth`
2. Preencher email valido com senha errada
3. Clicar "Entrar"
**Resultado esperado:** Exibe mensagem de erro "Email ou senha incorretos"

### TC-012 [P0] Cadastro de novo usuario
**Passos:**
1. Acessar `/auth`
2. Clicar na aba "Cadastro"
3. Preencher: nome, CPF (valido), telefone, email (novo), senha (min 6 chars)
4. Clicar "Cadastrar"
**Resultado esperado:** Conta criada, redireciona para `/dashboard`

### TC-013 [P1] Cadastro com email duplicado
**Passos:**
1. Tentar cadastrar com email ja existente
**Resultado esperado:** Exibe erro "Este email ja esta cadastrado"

### TC-014 [P1] Validacao de formulario no cadastro
**Passos:**
1. Tentar cadastrar com campos vazios
2. Tentar cadastrar com CPF invalido (ex: 111.111.111-11)
3. Tentar cadastrar com senha de 3 caracteres
**Resultado esperado:** Mensagens de validacao para cada campo

### TC-015 [P1] Esqueci minha senha
**Passos:**
1. Acessar `/auth`
2. Clicar "Esqueci minha senha"
3. Preencher email valido
4. Clicar "Enviar link"
**Resultado esperado:** Mensagem "Link de recuperacao enviado para seu email"

### TC-016 [P1] Cadastro com redirecionamento de plano
**Passos:**
1. Acessar `/auth?plan=ouro`
2. Verificar que exibe "Plano selecionado: Ouro"
3. Fazer login
**Resultado esperado:** Redireciona para `/checkout/subscription?plan=ouro`

### TC-017 [P0] Logout
**Passos:**
1. Estar logado no dashboard
2. Clicar no botao de logout
**Resultado esperado:** Redireciona para `/auth`, sessao encerrada

---

## MODULO 3: Planos e Assinaturas

### TC-020 [P0] Pagina de planos - visualizacao
**Rota:** `/planos`
**Passos:**
1. Acessar `/planos`
2. Verificar que exibe planos individuais (Bronze, Prata, Ouro, Platina)
3. Clicar toggle "Anual"
4. Verificar que precos mudam e economia e exibida
5. Clicar aba "Familiar"
6. Verificar que planos coletivos aparecem
**Resultado esperado:** Todos os planos exibidos com precos corretos

### TC-021 [P0] Checkout de assinatura - Mensal com cartao
**Rota:** `/checkout/subscription?plan=ouro`
**Pre-condicao:** Estar logado, sem assinatura ativa
**Passos:**
1. Acessar checkout do plano Ouro
2. Verificar que "Mensal" esta selecionado por padrao
3. Verificar que NAO ha opcao de PIX (apenas cartao de credito)
4. Preencher cartao de teste: `4024 0071 5376 3191`, `TESTE`, `12/2030`, `123`
5. Clicar "Assinar por R$ XX,XX/mes"
**Resultado esperado:**
- Mensagem "Assinatura Ativada!"
- Redireciona para `/dashboard`
- Dashboard exibe plano Ouro ativo

### TC-022 [P0] Checkout de assinatura - Anual com cartao
**Passos:**
1. Acessar checkout do plano Ouro
2. Selecionar "Anual"
3. Verificar que badge "Melhor oferta" aparece
4. Verificar que economia e exibida
5. Verificar que NAO ha opcao de PIX (apenas cartao de credito)
6. Preencher cartao e submeter
**Resultado esperado:** Assinatura ativada com ciclo anual

### TC-023 [P1] Checkout de assinatura - Cartao negado
**Passos:**
1. Acessar checkout do plano Ouro
2. Preencher cartao que termina em 2 (negado): `4024 0071 5376 3192`
3. Submeter
**Resultado esperado:** Mensagem de erro "Transacao negada", botao "Tentar novamente"

### TC-024 [P1] Upgrade de plano
**Pre-condicao:** Ter assinatura Prata ativa
**Passos:**
1. Acessar `/checkout/subscription?plan=ouro`
2. Preencher cartao e submeter
**Resultado esperado:**
- Mensagem "Plano atualizado para Ouro"
- Dashboard exibe novo plano
- Banco: `user_subscriptions` atualizado com novo `plan_id` e `payment_id`

### TC-025 [P1] Tentativa de assinar plano ja ativo
**Pre-condicao:** Ter assinatura Ouro ativa
**Passos:**
1. Acessar `/checkout/subscription?plan=ouro`
**Resultado esperado:** Toast "Plano ja contratado", redireciona para `/planos`

### TC-026 [P2] Alternancia Mensal/Anual no checkout
**Passos:**
1. Acessar checkout de assinatura
2. Selecionar "Mensal" - verificar preco mensal
3. Selecionar "Anual" - verificar preco anual e economia
4. Voltar para "Mensal" - verificar preco mensal
**Resultado esperado:** Precos atualizam corretamente, nenhum toggle de PIX aparece em nenhum momento

---

## MODULO 4: Telemedicina

### TC-030 [P0] Acesso a telemedicina com assinatura ativa
**Pre-condicao:** Assinatura ativa, CPF cadastrado no perfil
**Passos:**
1. Acessar `/dashboard`
2. Clicar "Consulta Imediata"
3. Verificar que iframe da telemedicina abre
**Resultado esperado:** iFrame Assemed carrega em tela cheia com botao de fechar

### TC-031 [P0] Acesso a telemedicina sem assinatura
**Pre-condicao:** Sem assinatura ativa
**Passos:**
1. Acessar `/dashboard`
2. Clicar "Consulta Imediata"
**Resultado esperado:** Toast "Plano necessario", redireciona para `/planos`

### TC-032 [P1] Acesso a telemedicina sem CPF
**Pre-condicao:** Assinatura ativa, CPF NAO cadastrado
**Passos:**
1. Clicar "Consulta Imediata"
**Resultado esperado:** Toast "CPF necessario", redireciona para `/perfil`

### TC-033 [P1] Agendamento de consulta
**Passos:**
1. Clicar "Agendar Consulta" no dashboard
2. Verificar que iframe abre com tipo "agendada"
**Resultado esperado:** iFrame Assemed carrega para agendamento

### TC-034 [P1] Pagina de telemedicina dedicada
**Rota:** `/telemedicina`
**Passos:**
1. Acessar `/telemedicina`
2. Verificar status da assinatura exibido
3. Verificar cards de consulta imediata e agendada
**Resultado esperado:** Pagina carrega com opcoes de consulta

---

## MODULO 5: Receitas Medicas

### TC-040 [P1] Lista de receitas
**Rota:** `/prescriptions`
**Passos:**
1. Acessar `/prescriptions`
2. Verificar que receitas do usuario sao listadas
3. Verificar cards de estatisticas (Total, Ativas, Medicamentos)
**Resultado esperado:** Lista de receitas com paginacao

### TC-041 [P1] Filtros de receitas
**Passos:**
1. Filtrar por status "Ativa"
2. Filtrar por intervalo de datas
3. Clicar "Limpar" filtros
**Resultado esperado:** Filtros aplicados corretamente, limpar reseta tudo

### TC-042 [P1] Busca de receitas
**Passos:**
1. Digitar texto no campo de busca
2. Aguardar sugestoes (debounce 300ms)
3. Selecionar sugestao
**Resultado esperado:** Autocomplete funciona, receita encontrada

### TC-043 [P1] Detalhe da receita
**Rota:** `/prescription/:id`
**Passos:**
1. Clicar em uma receita na lista
2. Verificar: ID, status, data, medico (nome, CRM), paciente
3. Verificar lista de medicamentos com precos
4. Verificar badge de assinatura digital
**Resultado esperado:** Todos os dados da receita exibidos

### TC-044 [P0] Adicionar medicamento ao carrinho
**Passos:**
1. Na tela de detalhe da receita
2. Selecionar quantidade de um medicamento
3. Clicar "Adicionar ao Carrinho"
4. Verificar que carrinho (header) atualiza contagem
**Resultado esperado:** Item adicionado ao localStorage, icone do carrinho atualizado

---

## MODULO 6: Carrinho

### TC-050 [P0] Visualizacao do carrinho
**Rota:** `/cart`
**Pre-condicao:** Itens no carrinho
**Passos:**
1. Acessar `/cart`
2. Verificar itens listados com nome, dosagem, prescricao, quantidade, preco
3. Verificar subtotal e total
**Resultado esperado:** Carrinho exibe todos os itens corretamente

### TC-051 [P1] Alterar quantidade no carrinho
**Passos:**
1. Clicar "+" para aumentar quantidade
2. Clicar "-" para diminuir
3. Verificar que total atualiza
**Resultado esperado:** Quantidade e totais atualizados em tempo real

### TC-052 [P1] Remover item do carrinho
**Passos:**
1. Clicar botao de remover em um item
2. Verificar que item desaparece
3. Verificar que total recalcula
**Resultado esperado:** Item removido, total atualizado

### TC-053 [P2] Carrinho vazio
**Passos:**
1. Acessar `/cart` sem itens
**Resultado esperado:** Mensagem "Carrinho vazio" com link para dashboard

---

## MODULO 7: Checkout de Medicamentos

### TC-060 [P0] Endereco de entrega e calculo de frete
**Rota:** `/checkout/medication`
**Pre-condicao:** Itens no carrinho, logado
**Passos:**
1. Acessar `/checkout/medication`
2. Verificar titulo "Finalizar Compra"
3. Preencher CEP valido (ex: 01001-000)
4. Verificar auto-preenchimento de cidade/estado
5. Preencher rua, numero, bairro
6. Verificar opcoes de frete (PAC e SEDEX com precos e prazos)
7. Selecionar uma opcao de frete
8. Clicar "Confirmar e Continuar"
**Resultado esperado:** Frete calculado, avancar para pagamento

### TC-061 [P1] Frete gratis para pedidos >= R$ 100
**Pre-condicao:** Carrinho com total >= R$ 100
**Passos:**
1. Preencher endereco
2. Verificar que aparece badge "Frete Gratis"
**Resultado esperado:** Frete zerado automaticamente

### TC-062 [P0] Pagamento com cartao de credito - Aprovado
**Passos:**
1. Completar etapa de endereco
2. Selecionar "Cartao de Credito"
3. Preencher cartao de teste (termina em 1 = aprovado)
4. Selecionar parcelas (ex: 3x)
5. Clicar "Pagar R$ XX,XX"
**Resultado esperado:**
- Tela de sucesso com order ID
- Pedido salvo no banco (`orders` table, status: "processing")
- Email enviado ao cliente (via Resend)
- Ordem de servico logistica criada
- Carrinho limpo (localStorage vazio)

### TC-063 [P0] Pagamento com PIX - Geracao e confirmacao
**Passos:**
1. Completar etapa de endereco
2. Selecionar "PIX"
3. Clicar "Gerar QR Code PIX"
4. Verificar: QR code exibido, timer de 30 min, valor correto
5. Clicar "Copiar codigo PIX" - verificar clipboard
6. Clicar "Simular confirmacao do pagamento"
**Resultado esperado:**
- QR code gerado com timer
- Apos confirmacao: tela de sucesso
- Pedido salvo no banco com `payment_method: "pix"`
- Carrinho limpo

### TC-064 [P1] Pagamento com cartao negado
**Passos:**
1. Preencher cartao que termina em 2 (negado)
2. Submeter
**Resultado esperado:** Mensagem "Transacao negada", opcao de tentar novamente

### TC-065 [P1] Pagamento com cartao expirado
**Passos:**
1. Preencher cartao que termina em 3 (expirado)
2. Submeter
**Resultado esperado:** Mensagem "Cartao expirado"

### TC-066 [P2] Deteccao automatica de bandeira
**Passos:**
1. Digitar `4024...` → Verificar icone Visa
2. Limpar e digitar `5425...` → Verificar icone Mastercard
**Resultado esperado:** Bandeira detectada automaticamente

### TC-067 [P2] Parcelamento
**Passos:**
1. Verificar opcoes de parcelas disponiveis conforme total:
   - Total < R$ 50 → Max 3x
   - Total >= R$ 50 < R$ 100 → Max 6x
   - Total >= R$ 100 → Max 12x
**Resultado esperado:** Numero de parcelas correto

---

## MODULO 8: Pedidos

### TC-070 [P1] Lista de pedidos
**Rota:** `/orders`
**Passos:**
1. Acessar `/orders`
2. Verificar cards de estatisticas (Total, Pendentes, Em Transito, Entregues)
3. Verificar tabs de filtro (Todos, Pendentes, Processando, Em Transito, Entregues)
4. Clicar em cada tab e verificar filtragem
**Resultado esperado:** Pedidos listados e filtrados corretamente

### TC-071 [P1] Detalhe do pedido
**Rota:** `/order/:id`
**Passos:**
1. Clicar "Ver Detalhes" em um pedido
2. Verificar: ID, status, itens, endereco, pagamento, rastreio
**Resultado esperado:** Todos os dados do pedido exibidos

### TC-072 [P2] Rastreamento de pedido
**Pre-condicao:** Pedido com tracking_code
**Passos:**
1. Clicar "Rastrear Pedido"
**Resultado esperado:** Abre nova aba com busca do codigo de rastreio

---

## MODULO 9: Perfil e Configuracoes

### TC-080 [P1] Visualizacao do perfil
**Rota:** `/perfil`
**Passos:**
1. Acessar `/perfil`
2. Verificar dados pre-preenchidos (nome, email)
3. Se tem assinatura: verificar card de plano ativo
**Resultado esperado:** Dados do perfil exibidos corretamente

### TC-081 [P1] Edicao do perfil
**Passos:**
1. Alterar nome
2. Adicionar/alterar telefone (auto-formata para (99) 99999-9999)
3. Adicionar/alterar CPF (auto-formata para 999.999.999-99)
4. Clicar "Salvar alteracoes"
**Resultado esperado:** Toast de sucesso, dados persistidos

### TC-082 [P2] Alteracao de email
**Passos:**
1. Alterar email
2. Salvar
**Resultado esperado:** Mensagem sobre confirmacao por email

---

## MODULO 10: Admin

### TC-090 [P0] Acesso admin ao painel
**Rota:** `/admin`
**Pre-condicao:** Logado como admin
**Passos:**
1. Acessar `/admin`
2. Verificar dashboard com metricas (usuarios, pedidos, receita)
**Resultado esperado:** Painel carrega com dados

### TC-091 [P0] Admin - negar acesso a usuario comum
**Pre-condicao:** Logado como paciente (nao admin)
**Passos:**
1. Acessar `/admin/pedidos`
**Resultado esperado:** Redireciona para `/dashboard` ou exibe "Acesso negado"

### TC-092 [P1] Admin - gerenciamento de pedidos
**Rota:** `/admin/pedidos`
**Passos:**
1. Acessar lista de pedidos
2. Filtrar por status
3. Clicar em um pedido
4. Atualizar status (processing → shipped)
5. Adicionar codigo de rastreio
**Resultado esperado:**
- Status atualizado no banco
- Email de notificacao enviado ao cliente
- Codigo de rastreio salvo

### TC-093 [P1] Admin - gerenciamento de usuarios
**Rota:** `/admin/usuarios`
**Passos:**
1. Listar usuarios
2. Buscar por nome ou email
3. Visualizar detalhes de um usuario (assinatura, pedidos)
**Resultado esperado:** Lista de usuarios com funcionalidades de busca

### TC-094 [P2] Admin - receitas
**Rota:** `/admin/receitas`
**Passos:**
1. Listar receitas
2. Verificar detalhes de uma receita
**Resultado esperado:** Receitas listadas

### TC-095 [P2] Admin - relatorios
**Rota:** `/admin/relatorios`
**Passos:**
1. Verificar graficos e metricas financeiras
2. Verificar dados de assinaturas ativas, churn, receita
**Resultado esperado:** Relatorios exibidos com dados

---

## MODULO 11: Emails (Resend)

### TC-100 [P1] Email de pedido recebido
**Trigger:** Apos pagamento de medicamento aprovado
**Verificar:**
- Email enviado para o cliente
- Template "Pedido Recebido" com itens, total, endereco
- Registro em `order_notifications` table

### TC-101 [P1] Email de pedido enviado
**Trigger:** Admin muda status para "shipped"
**Verificar:**
- Email enviado com codigo de rastreio
- Template "Pedido Enviado"

### TC-102 [P2] Email de pedido entregue
**Trigger:** Admin muda status para "delivered"
**Verificar:**
- Email de confirmacao de entrega

### TC-103 [P1] Email de recuperacao de senha
**Trigger:** "Esqueci minha senha" no login
**Verificar:**
- Email recebido com link de reset
- Link funciona e redireciona para `/reset-password`

---

## MODULO 12: Integracoes Externas

### TC-110 [P0] Supabase - conexao e auth
**Verificar:**
- Login/logout funcionam
- Dados persistem entre sessoes
- RLS: usuario so ve seus proprios dados

### TC-111 [P0] Cielo - pagamento cartao (mock vs real)
**Verificar:**
- Mock: funciona sem credenciais (cartao teste → aprovado/negado)
- Local server: funciona via proxy (porta 3002)
- Producao: Edge Function `cielo-payment` funciona

### TC-112 [P1] Cielo - webhook de pagamento
**Verificar:**
- Edge Function `cielo-webhook` recebe notificacoes
- Atualiza `orders.payment_status` e `user_subscriptions.status`
- Log salvo em `cielo_webhooks` table

### TC-113 [P1] Correios - calculo de frete
**Verificar:**
- CEP valido retorna opcoes PAC e SEDEX
- Precos e prazos corretos
- Fallback funciona se API indisponivel

### TC-114 [P1] Assemed - telemedicina
**Verificar:**
- Autenticacao com CPF funciona
- iFrame carrega corretamente
- Consulta imediata e agendada funcionam

### TC-115 [P1] Resend - envio de emails
**Verificar:**
- Emails sao enviados e recebidos
- Templates HTML com identidade visual Novita
- Fallback gracioso se API indisponivel

---

## MODULO 13: Edge Cases e Erros

### TC-120 [P1] Sessao expirada
**Passos:**
1. Fazer login
2. Aguardar expiracao da sessao (ou limpar token manualmente)
3. Tentar acessar `/dashboard`
**Resultado esperado:** Redireciona para `/auth`

### TC-121 [P1] Navegacao sem auth em rotas protegidas
**Passos:**
1. Sem estar logado, acessar diretamente:
   - `/dashboard`
   - `/prescriptions`
   - `/orders`
   - `/cart`
   - `/checkout/medication`
   - `/checkout/subscription?plan=ouro`
   - `/perfil`
   - `/telemedicina`
**Resultado esperado:** Todas redirecionam para `/auth`

### TC-122 [P2] Checkout de medicamento com carrinho vazio
**Passos:**
1. Limpar localStorage
2. Acessar `/checkout/medication`
**Resultado esperado:** Redireciona para `/cart` ou exibe mensagem

### TC-123 [P2] Checkout de assinatura sem plano na URL
**Passos:**
1. Acessar `/checkout/subscription` (sem `?plan=`)
**Resultado esperado:** Redireciona para `/planos`

### TC-124 [P2] Checkout de assinatura com plano invalido
**Passos:**
1. Acessar `/checkout/subscription?plan=inexistente`
**Resultado esperado:** Redireciona para `/planos`

---

## MODULO 14: Responsividade e UX

### TC-130 [P2] Mobile - homepage
**Passos:** Acessar `/` em viewport 375x667 (iPhone SE)
**Verificar:** Menu hamburger, layout responsivo, botoes acessiveis

### TC-131 [P2] Mobile - checkout
**Passos:** Acessar checkout em mobile
**Verificar:** Formularios empilhados, botoes full-width, teclado nao sobrepoe

### TC-132 [P2] Mobile - dashboard
**Passos:** Acessar dashboard em mobile
**Verificar:** Cards empilhados, navegacao funcional

### TC-133 [P3] Tablet - layout geral
**Passos:** Acessar em viewport 768x1024
**Verificar:** Layout intermediario correto

---

## Resumo de Cobertura

| Modulo | Testes | P0 | P1 | P2 | P3 |
|--------|--------|----|----|----|----|
| Paginas Publicas | 5 | 1 | 0 | 3 | 1 |
| Autenticacao | 8 | 3 | 4 | 0 | 0 |
| Planos/Assinaturas | 7 | 3 | 3 | 1 | 0 |
| Telemedicina | 5 | 2 | 3 | 0 | 0 |
| Receitas | 5 | 1 | 3 | 0 | 0 |
| Carrinho | 4 | 1 | 2 | 1 | 0 |
| Checkout Medicamentos | 8 | 2 | 3 | 3 | 0 |
| Pedidos | 3 | 0 | 2 | 1 | 0 |
| Perfil | 3 | 0 | 2 | 1 | 0 |
| Admin | 6 | 2 | 2 | 2 | 0 |
| Emails | 4 | 0 | 3 | 1 | 0 |
| Integracoes | 6 | 2 | 4 | 0 | 0 |
| Edge Cases | 5 | 0 | 2 | 3 | 0 |
| Responsividade | 4 | 0 | 0 | 3 | 1 |
| **TOTAL** | **73** | **17** | **33** | **21** | **2** |

### Ordem de Execucao Sugerida
1. **P0** primeiro (17 testes) - Bloqueia deploy se falhar
2. **P1** em seguida (33 testes) - Funcionalidades core
3. **P2/P3** por ultimo (23 testes) - UX e edge cases

### Regra PIX
- PIX **APENAS** para compra de medicamentos (`/checkout/medication`)
- Assinaturas de planos (`/checkout/subscription`) = **SOMENTE cartao de credito**
- Nenhum toggle PIX deve aparecer no checkout de assinatura (nem mensal, nem anual)
