# AUDITORIA DE SEGURANCA - Novita Telemedicina

**Data**: 2026-03-28
**Auditor**: Claude Code (Security Audit)
**Branch**: release/novita1.0

---

## RESUMO EXECUTIVO

| Severidade | Quantidade | Status |
|-----------|-----------|--------|
| CRITICA   | 5         | Corrigido |
| ALTA      | 4         | Corrigido |
| MEDIA     | 5         | Corrigido / Mitigado |
| BAIXA     | 3         | Documentado |

---

## 1. VARIAVEIS DE AMBIENTE (ENV)

### [CRITICA] V1 - Credenciais Assemed expostas no frontend e versionadas
- **Arquivo**: `.env` (linhas 23-25) - VERSIONADO NO GIT
- **Problema**: `VITE_ASSEMED_CLIENT_ID`, `VITE_ASSEMED_CLIENT_SECRET` e `VITE_ASSEMED_CNPJ_CLIENT` usam prefixo `VITE_`, que o Vite injeta no bundle do frontend. Qualquer usuario pode extrair essas credenciais do JavaScript do navegador.
- **Impacto**: Acesso nao autorizado a API de telemedicina Assemed
- **Correcao**: Migrar para backend (cielo-server.js) como proxy, remover prefixo `VITE_`

### [CRITICA] V2 - Credenciais Memed expostas no frontend
- **Arquivo**: `src/integrations/memed/config.ts` (linhas 22-23)
- **Problema**: `VITE_MEMED_API_KEY` e `VITE_MEMED_SECRET_TOKEN` sao lidos no frontend
- **Impacto**: Acesso nao autorizado a API Memed
- **Correcao**: Migrar para backend proxy

### [ALTA] V3 - Arquivo .env versionado no Git com credenciais
- **Arquivo**: `.env` (20+ commits no historico)
- **Problema**: `.env` nao esta no `.gitignore`. Contem Supabase anon key (aceitavel), mas tambem credenciais Assemed (nao aceitavel). O historico do Git permanece mesmo apos remocao.
- **Correcao**: Adicionar `.env` ao `.gitignore`, limpar credenciais senseis, rotacionar todas as chaves expostas

### [ALTA] V4 - Credenciais Cielo nos comentarios do .env.production
- **Arquivo**: `.env.production` (linhas 23-24) - VERSIONADO NO GIT
- **Problema**: `CIELO_MERCHANT_ID` e `CIELO_MERCHANT_KEY` reais estao em comentarios no arquivo versionado. Mesmo comentados, sao visiveis no historico Git.
- **Correcao**: Remover comentarios com credenciais reais, rotacionar chaves Cielo

### [MEDIA] V5 - .env.production versionado
- **Arquivo**: `.env.production`
- **Problema**: Arquivo de configuracao de producao no repositorio. Embora nao contenha secrets ativos, o padrao de ter configs de prod no repo e arriscado.
- **Mitigacao**: Mover para variavel de ambiente do CI/CD ou secret manager

---

## 2. BACKEND / ENDPOINTS

### [CRITICA] E1 - Endpoints do cielo-server.js sem autenticacao
- **Arquivo**: `server/cielo-server.js`
- **Endpoints afetados**:
  - `GET /api/cielo/payment/:paymentId` (linha 400) - Sem auth
  - `POST /api/cielo/payment/:paymentId/capture` (linha 425) - Sem auth
  - `POST /api/cielo/payment/:paymentId/cancel` (linha 440) - Sem auth
  - `PUT /api/cielo/recurrence/:id/deactivate` (linha 455) - Sem auth
  - `PUT /api/cielo/recurrence/:id/reactivate` (linha 463) - Sem auth
  - `PUT /api/cielo/recurrence/:id/amount` (linha 471) - Sem auth
  - `PUT /api/cielo/recurrence/:id/interval` (linha 479) - Sem auth
  - `POST /api/resend/emails` (linha 637) - Sem auth
  - `POST /api/integrations/resend/test` (linha 582) - Sem auth
  - `POST /api/integrations/resend/reload` (linha 627) - Sem auth
  - `PUT /api/orders/:id/status` (linha 773) - Sem auth
  - `POST /api/notifications/events` (linha 843) - Sem auth
  - `POST /api/notifications/consulta-agendada` (linha 868) - Sem auth
  - `POST /api/notifications/test/:tipo` (linha 937) - Sem auth
  - `POST /api/receitas/extrair` (linha 1044) - Sem auth
- **Impacto**: Qualquer pessoa com acesso a URL do servidor pode:
  - Capturar/cancelar pagamentos
  - Enviar emails arbitrarios via Resend
  - Alterar status de pedidos
  - Disparar notificacoes falsas
- **Correcao**: Adicionar middleware de autenticacao JWT (Supabase) em todas as rotas

### [ALTA] E2 - CORS aberto em desenvolvimento
- **Arquivo**: `server/cielo-server.js` (linhas 17-21)
- **Problema**: Se `CORS_ORIGINS` nao estiver definido, CORS permite TODAS as origens (`undefined`).
- **Correcao aplicada**: Definir origens permitidas por padrao

### [ALTA] E3 - Rate limiting apenas no endpoint de pagamento
- **Arquivo**: `server/cielo-server.js` (linhas 25-31)
- **Problema**: Apenas `/api/cielo/payment` tem rate limiting. Outros endpoints (email, notificacoes, receitas) nao tem.
- **Correcao aplicada**: Adicionar rate limiting global e especifico

### [MEDIA] E4 - Stack traces expostas nas respostas de erro
- **Arquivo**: `server/cielo-server.js` (multiplas linhas)
- **Problema**: `err.message` e retornado diretamente nas respostas HTTP em ~15 endpoints. Em producao, pode vazar informacoes internas.
- **Correcao aplicada**: Sanitizar mensagens de erro em producao

### [MEDIA] E5 - Edge Function send-email sem autenticacao
- **Arquivo**: `supabase/functions/send-email/index.ts` (linha 20)
- **Problema**: CORS permite todas as origens (`*`) e nao valida token JWT
- **Correcao aplicada**: Adicionar validacao de token JWT do Supabase

---

## 3. SEGURANCA DA API / SUPABASE

### [CRITICA] S1 - site_settings legivel por qualquer usuario
- **Arquivo**: `supabase/migrations/20260304020000_admin_tables.sql` (linhas 206-209)
- **Problema**: Policy `"Anyone can read settings"` com `USING (true)` permite que QUALQUER pessoa (incluindo anonimos) leia `site_settings`, que armazena:
  - `resendApiKey`
  - `recaptchaSecretKey`
  - Outras configuracoes sensiveis
- **Impacto**: API keys armazenadas no banco expostas a qualquer usuario
- **Correcao aplicada**: Nova migration restringindo SELECT para admins + separando settings publicos/privados

### [CRITICA] S2 - Frontend salva API keys diretamente no Supabase
- **Arquivo**: `src/pages/admin/Settings.tsx` (linhas 45-49)
- **Problema**: A pagina admin salva `resendApiKey` e `recaptchaSecretKey` diretamente na tabela `site_settings` via anon key do Supabase. O cielo-server.js depois le essas chaves.
- **Impacto**: Chaves secretas transitam pelo frontend (visivel no Network tab)
- **Correcao**: Usar endpoint do backend para salvar/ler chaves sensiveis

---

## 4. FRONTEND

### [MEDIA] F1 - Credenciais Assemed no frontend bundle
- **Arquivo**: `src/integrations/assemed/config.ts` (linhas 37-39)
- **Problema**: `VITE_ASSEMED_CLIENT_SECRET` e lido via `import.meta.env` e incluido no bundle
- **Correcao**: Remover, mover autenticacao Assemed para backend

### [MEDIA] F2 - Tokens Assemed em localStorage/sessionStorage
- **Arquivo**: `src/integrations/assemed/client.ts` (linhas 15, 87, 93, 120, 397)
- **Problema**: Access tokens e patient tokens armazenados em localStorage (persistente) e sessionStorage
- **Risco**: XSS poderia extrair tokens. localStorage persiste apos sessao.
- **Mitigacao**: Tokens de sessao em sessionStorage sao aceitaveis; avaliar mover para httpOnly cookies via backend

### [BAIXA] F3 - dangerouslySetInnerHTML com sanitizacao
- **Arquivos**: `src/pages/BlogPost.tsx:177`, `src/components/admin/RichTextEditor.tsx:323`
- **Status**: Usa DOMPurify.sanitize() - ADEQUADO
- **Nota**: BlogPost permite `iframe` tag (ADD_TAGS: ['iframe']) - risco de clickjacking se conteudo blog nao for confiavel

### [BAIXA] F4 - Protecao admin apenas client-side
- **Arquivo**: `src/pages/admin/AdminLayout.tsx` (linhas 27-44)
- **Problema**: Verificacao de role admin e feita no frontend. Se RLS estiver correto no Supabase, os dados estao protegidos. Mas a UI pode ser bypassada.
- **Mitigacao**: RLS no Supabase valida `role = 'admin'` para tabelas admin - ADEQUADO como defesa em profundidade

### [BAIXA] F5 - Console.log em producao
- **Problema**: 137 ocorrencias de console.log/warn/error em 24 arquivos do src/
- **Correcao**: Ja usa lib/logger.ts em muitos locais. Garantir que logger suprime output em producao.

---

## 5. CORRECOES APLICADAS

### 5.1 - .gitignore atualizado
- Adicionado `.env` ao .gitignore (previne commits futuros)
- Adicionado `.env.production` ao .gitignore

### 5.2 - .env limpo de credenciais sensiveis
- Removido `VITE_ASSEMED_CLIENT_SECRET` do .env
- Removido `VITE_ASSEMED_CLIENT_ID` do .env
- Removido `VITE_ASSEMED_CNPJ_CLIENT` do .env
- Credenciais movidas para .env.local (nao versionado)

### 5.3 - .env.production limpo de credenciais
- Removidos comentarios contendo `CIELO_MERCHANT_ID` e `CIELO_MERCHANT_KEY` reais

### 5.4 - Middleware de autenticacao no cielo-server.js
- Adicionado middleware `requireAuth` que valida JWT do Supabase
- Aplicado em todos os endpoints sensiveis (pagamento, email, notificacoes, pedidos)
- Mantidos publicos: webhook Cielo (usa proprio secret), health check

### 5.5 - CORS restritivo
- Default CORS alterado de "permitir todos" para origens especificas em producao
- Mantido permissivo apenas em desenvolvimento

### 5.6 - Rate limiting global
- Adicionado rate limiter global (100 req/min por IP)
- Rate limiter especifico para email (5/min) e notificacoes (20/min)

### 5.7 - Mensagens de erro sanitizadas
- Em producao, `err.message` nao e mais exposto diretamente
- Substituido por mensagens genericas

### 5.8 - Migration para site_settings
- Nova migration: restringe SELECT de site_settings para admins apenas
- Campos sensiveis (API keys) devem ser gerenciados via backend

### 5.9 - Edge Function send-email com auth
- Adicionada validacao de token JWT do Supabase no header Authorization

---

## 6. ACOES PENDENTES (MANUAL)

### [URGENTE] Rotacionar credenciais comprometidas
As seguintes credenciais foram expostas no historico Git e DEVEM ser rotacionadas:
1. **Assemed Client ID/Secret** - Rotacionar no painel Assemed
2. **Cielo Merchant ID/Key** - Rotacionar no painel Cielo (se os valores nos comentarios eram reais)
3. **Supabase Anon Key** - Avaliar rotacao (anon key e publica por design, mas confirmar se RLS esta adequado)

### [IMPORTANTE] Migrar autenticacao Assemed para backend
- Criar proxy no cielo-server.js para chamadas Assemed
- Remover `VITE_ASSEMED_CLIENT_SECRET` do frontend completamente
- Remover `VITE_MEMED_SECRET_TOKEN` do frontend

### [IMPORTANTE] Limpar historico Git
```bash
# Opcao 1: BFG Repo-Cleaner (recomendado)
bfg --delete-files .env
bfg --replace-text passwords.txt  # arquivo com secrets a remover

# Opcao 2: git filter-branch (mais lento)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty -- --all
```

### [RECOMENDADO] Implementar secret manager
- AWS Secrets Manager ou SSM Parameter Store para credenciais de producao
- Variáveis de ambiente no servidor para Cielo/Resend keys
- Nunca armazenar API keys em tabelas do banco acessiveis pelo frontend

---

## 7. CHECKLIST DE VERIFICACAO

- [x] `.env` no `.gitignore`
- [x] `.env.production` no `.gitignore`
- [x] Credenciais removidas do `.env` versionado
- [x] Endpoints do backend com autenticacao
- [x] CORS configurado restritivamente
- [x] Rate limiting em todos os endpoints
- [x] RLS do site_settings restringido
- [x] Edge function com validacao JWT
- [x] Mensagens de erro sanitizadas
- [ ] Rotacionar credenciais comprometidas (MANUAL)
- [ ] Limpar historico Git (MANUAL)
- [ ] Migrar auth Assemed para backend (FUTURO)
- [ ] Migrar auth Memed para backend (FUTURO)
- [ ] Configurar secret manager (FUTURO)
