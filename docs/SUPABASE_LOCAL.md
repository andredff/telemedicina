# Supabase Local (Docker)

Guia para rodar o Supabase localmente com Docker para desenvolvimento.

## Pré-requisitos

- **Docker Desktop** instalado e rodando
- **Homebrew** (macOS) para instalar o Supabase CLI

## Setup Rápido

```bash
# 1. Dar permissão ao script
chmod +x scripts/setup-supabase-local.sh

# 2. Executar setup
./scripts/setup-supabase-local.sh

# 3. Copiar variáveis de ambiente
cp .env.local.example .env.local
```

## Comandos Manuais

Se preferir configurar manualmente:

```bash
# Instalar Supabase CLI (macOS)
brew install supabase/tap/supabase

# Iniciar Supabase local
supabase start

# Ver status e credenciais
supabase status

# Parar Supabase
supabase stop

# Resetar banco (aplica migrations + seed)
supabase db reset
```

## Serviços Disponíveis

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Studio** | http://localhost:54323 | Dashboard visual do Supabase |
| **API REST** | http://localhost:54321 | API PostgREST |
| **PostgreSQL** | localhost:54322 | Banco de dados direto |
| **Inbucket** | http://localhost:54324 | Mock de emails |

## Variáveis de Ambiente

Após iniciar o Supabase, copie as credenciais para `.env.local`:

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key do supabase status>
```

## Usuários de Teste

Após executar o seed (`supabase db reset`), os seguintes usuários estarão disponíveis:

| Email | Senha | Role |
|-------|-------|------|
| admin@novita.com | Admin#123 | admin |
| doctor1@novita.com | Doctor#123 | doctor |
| doctor2@novita.com | Doctor#123 | doctor |
| support1@novita.com | Support#123 | support |
| paciente01@novita.com | Paciente#123 | patient |
| ... até paciente20 | Paciente#123 | patient |

## Desenvolvimento

```bash
# Terminal 1: Supabase
supabase start

# Terminal 2: Frontend
npm run dev

# Terminal 3 (opcional): Servidor Cielo
node server/cielo-server.js
```

## Migrations

```bash
# Criar nova migration
supabase migration new nome_da_migration

# Aplicar migrations pendentes
supabase db push --local

# Ver diferença entre local e remoto
supabase db diff
```

## Troubleshooting

### Docker não está rodando
```bash
# Verificar Docker
docker info

# Reiniciar Docker Desktop
```

### Portas em uso
```bash
# Verificar portas ocupadas
lsof -i :54321
lsof -i :54322
lsof -i :54323

# Parar todas instâncias do Supabase
supabase stop --no-backup
```

### Resetar completamente
```bash
# Parar e remover volumes
supabase stop --no-backup

# Limpar containers Docker
docker system prune -f

# Reiniciar
supabase start
```

## Conexão direta ao PostgreSQL

```bash
# Via psql
psql -h localhost -p 54322 -U postgres -d postgres

# Senha padrão: postgres
```

Ou use qualquer cliente SQL (DBeaver, TablePlus, etc.) com:
- Host: localhost
- Port: 54322
- User: postgres
- Password: postgres
- Database: postgres
