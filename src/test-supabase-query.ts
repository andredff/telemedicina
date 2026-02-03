/**
 * Script de teste para verificar consultas no Supabase
 * Execute: npx tsx src/test-supabase-query.ts
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './integrations/supabase/types';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variáveis de ambiente não configuradas!');
  console.log('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);

async function testQueries() {
  console.log('🧪 Testando consultas no Supabase...\n');

  // 1. Testar conexão
  console.log('1. Testando conexão...');
  const { data: connectionTest, error: connectionError } = await supabase
    .from('profiles')
    .select('count', { count: 'exact', head: true });
  
  if (connectionError) {
    console.log('❌ Erro de conexão:', connectionError.message);
  } else {
    console.log('✅ Conexão OK');
  }

  // 2. Contar perfis
  console.log('\n2. Contando perfis (profiles)...');
  const { count: profileCount, error: profileError } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  
  if (profileError) {
    console.log('❌ Erro:', profileError.message);
  } else {
    console.log(`✅ Total de perfis: ${profileCount}`);
  }

  // 3. Contar pedidos
  console.log('\n3. Contando pedidos (orders)...');
  const { count: orderCount, error: orderError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });
  
  if (orderError) {
    console.log('❌ Erro:', orderError.message);
  } else {
    console.log(`✅ Total de pedidos: ${orderCount}`);
  }

  // 4. Contar receitas
  console.log('\n4. Contando receitas (prescriptions)...');
  const { count: prescriptionCount, error: prescriptionError } = await supabase
    .from('prescriptions')
    .select('*', { count: 'exact', head: true });
  
  if (prescriptionError) {
    console.log('❌ Erro:', prescriptionError.message);
  } else {
    console.log(`✅ Total de receitas: ${prescriptionCount}`);
  }

  // 5. Contar assinaturas
  console.log('\n5. Contando assinaturas (user_subscriptions)...');
  const { count: subCount, error: subError } = await supabase
    .from('user_subscriptions')
    .select('*', { count: 'exact', head: true });
  
  if (subError) {
    console.log('❌ Erro:', subError.message);
  } else {
    console.log(`✅ Total de assinaturas: ${subCount}`);
  }

  // 6. Verificar se há dados na tabela orders com join em profiles
  console.log('\n6. Verificando pedidos com dados do cliente...');
  if (orderCount && orderCount > 0) {
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        profiles!inner (full_name, email)
      `)
      .limit(3);
    
    if (ordersError) {
      console.log('❌ Erro no join:', ordersError.message);
    } else if (orders && orders.length > 0) {
      console.log('✅ Pedidos com dados do cliente:');
      orders.forEach((order: Record<string, unknown>, i: number) => {
        console.log(`  ${i + 1}. ${order.id} - ${(order.profiles as Record<string, unknown>)?.full_name || 'N/A'}`);
      });
    }
  } else {
    console.log('⚠️ Nenhum pedido encontrado para testar o join');
  }

  console.log('\n🏁 Teste concluído!');
}

testQueries().catch(console.error);
