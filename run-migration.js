import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://wtedhqhqducvwadjjgii.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0ZWRocWhxZHVjdndhZGpqZ2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MTUxMzYsImV4cCI6MjA4MDE5MTEzNn0.fYUtrzuUyI7Qm2oNfIZdqb_hcG1Y5IjD5CXap2P2uNw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Executando migração para adicionar plano Diamante...');
  
  const sql = readFileSync('./supabase/migrations/20260109081750_update_plans_briefing.sql', 'utf8');
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('❌ Erro ao executar migração:', error);
    process.exit(1);
  }
  
  console.log('✅ Migração executada com sucesso!');
  console.log('✅ Plano Diamante adicionado ao banco de dados');
}

runMigration();
