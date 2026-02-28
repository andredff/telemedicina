#!/bin/bash
# Script para configurar e iniciar Supabase local com Docker
# Novità Telemedicina

set -e

echo "🚀 Configurando Supabase Local para Novità..."

# Verificar requisitos
check_requirements() {
  echo "📋 Verificando requisitos..."
  
  # Docker
  if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado. Instale em: https://www.docker.com/products/docker-desktop/"
    exit 1
  fi
  
  # Docker Compose (pode vir com Docker Desktop ou separado)
  if ! docker compose version &> /dev/null && ! docker-compose --version &> /dev/null; then
    echo "❌ Docker Compose não encontrado."
    exit 1
  fi
  
  # Docker rodando
  if ! docker info &> /dev/null; then
    echo "❌ Docker não está rodando. Inicie o Docker Desktop."
    exit 1
  fi
  
  echo "✅ Docker está rodando"
}

# Instalar Supabase CLI se não existir
install_supabase_cli() {
  if ! command -v supabase &> /dev/null; then
    echo "📦 Instalando Supabase CLI..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS
      brew install supabase/tap/supabase
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
      # Linux
      curl -sSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
      npm install -g supabase
    else
      echo "Sistema não suportado para instalação automática."
      echo "Instale manualmente: https://supabase.com/docs/guides/cli/getting-started"
      exit 1
    fi
  fi
  
  echo "✅ Supabase CLI instalado: $(supabase --version)"
}

# Iniciar Supabase
start_supabase() {
  echo "🐳 Iniciando containers Supabase..."
  
  # Ir para diretório do projeto
  cd "$(dirname "$0")/.."
  
  # Parar instância anterior se existir
  supabase stop --no-backup 2>/dev/null || true
  
  # Iniciar Supabase
  supabase start
  
  echo ""
  echo "🎉 Supabase local iniciado com sucesso!"
  echo ""
  echo "📊 Serviços disponíveis:"
  echo "   • Studio (Dashboard):    http://localhost:54323"
  echo "   • API REST:              http://localhost:54321"
  echo "   • PostgreSQL:            localhost:54322"
  echo "   • Inbucket (Email Mock): http://localhost:54324"
  echo ""
}

# Aplicar migrations
apply_migrations() {
  echo "📄 Aplicando migrations..."
  cd "$(dirname "$0")/.."
  
  # O supabase start já aplica migrations automaticamente
  # Mas podemos forçar se necessário
  supabase db reset --linked=false 2>/dev/null || supabase db push --local 2>/dev/null || true
  
  echo "✅ Migrations aplicadas"
}

# Mostrar credenciais
show_credentials() {
  echo ""
  echo "🔑 Credenciais para .env.local:"
  echo "───────────────────────────────────────────────────────────"
  supabase status 2>/dev/null | grep -E "(API URL|anon key|service_role key|JWT secret)"
  echo "───────────────────────────────────────────────────────────"
  echo ""
  echo "💡 Copie as variáveis acima para seu .env.local"
  echo "   ou execute: npm run supabase:env"
}

# Main
main() {
  check_requirements
  install_supabase_cli
  start_supabase
  show_credentials
}

main "$@"
