-- ============================================================================
-- TESTES — Notificações internas (run_plan_expiry_notifications + RPCs + RLS)
--
-- COMO RODAR
--   Cole este arquivo inteiro no SQL Editor do Supabase (ou `psql`) e execute.
--   Tudo roda dentro de uma transação que termina em ROLLBACK: NENHUM dado
--   de teste é persistido. Se qualquer asserção falhar, o script aborta com
--   a mensagem do cenário correspondente. Sucesso → "TODOS OS TESTES PASSARAM".
--
-- COBERTURA (cenários pedidos)
--   1. Criar notificação para 15, 10, 5, 1 e 0 dias restantes (+ vencido).
--   2. Não criar notificação duplicada (idempotência da varredura/dedup_key).
--   3. Marcar uma notificação como lida.
--   4. Marcar todas como lidas.
--   5. Usuário NÃO acessa/altera notificação de outro usuário (RLS).
--   6. Plano vencido gera alerta (plan_expired).
--   7. Pagamento confirmado remove alerta de vencimento.
-- ============================================================================

BEGIN;

-- IDs fixos para os usuários de teste.
-- u1=15d  u2=10d  u3=5d  u4=1d  u5=0d  u6=vencido
\set u1 '11111111-1111-1111-1111-111111111111'
\set u2 '22222222-2222-2222-2222-222222222222'
\set u3 '33333333-3333-3333-3333-333333333333'
\set u4 '44444444-4444-4444-4444-444444444444'
\set u5 '55555555-5555-5555-5555-555555555555'
\set u6 '66666666-6666-6666-6666-666666666666'

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Usuários sintéticos (FK de notifications/user_subscriptions → auth.users).
INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES
  (:'u1','authenticated','authenticated','test-u1@novita.test', now(), now()),
  (:'u2','authenticated','authenticated','test-u2@novita.test', now(), now()),
  (:'u3','authenticated','authenticated','test-u3@novita.test', now(), now()),
  (:'u4','authenticated','authenticated','test-u4@novita.test', now(), now()),
  (:'u5','authenticated','authenticated','test-u5@novita.test', now(), now()),
  (:'u6','authenticated','authenticated','test-u6@novita.test', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Plano de referência (usa o primeiro plano existente, se houver).
DO $$
DECLARE v_plan UUID;
BEGIN
  SELECT id INTO v_plan FROM public.subscription_plans LIMIT 1;

  INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at)
  VALUES
    ('11111111-1111-1111-1111-111111111111', v_plan, 'active', (now() + interval '15 days')),
    ('22222222-2222-2222-2222-222222222222', v_plan, 'active', (now() + interval '10 days')),
    ('33333333-3333-3333-3333-333333333333', v_plan, 'active', (now() + interval '5 days')),
    ('44444444-4444-4444-4444-444444444444', v_plan, 'active', (now() + interval '1 day')),
    ('55555555-5555-5555-5555-555555555555', v_plan, 'active', (date_trunc('day', now()) + interval '6 hours')),
    ('66666666-6666-6666-6666-666666666666', v_plan, 'active', (now() - interval '2 days'));
END $$;

-- ── Cenário 1 + 6: varredura cria os 6 marcos ──────────────────────────────
DO $$
DECLARE v_created INT; v_total INT;
BEGIN
  v_created := public.run_plan_expiry_notifications();

  SELECT count(*) INTO v_total
  FROM public.notifications
  WHERE user_id IN (
    '11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666'
  );

  IF v_total <> 6 THEN
    RAISE EXCEPTION 'CENÁRIO 1 FALHOU: esperado 6 notificações, obtido %', v_total;
  END IF;

  -- Conteúdo correto por marco
  PERFORM 1 FROM public.notifications
    WHERE user_id='11111111-1111-1111-1111-111111111111'
      AND type='plan_expiring' AND body LIKE 'Seu plano termina em 15 dias%';
  IF NOT FOUND THEN RAISE EXCEPTION 'CENÁRIO 1 FALHOU: texto de 15 dias incorreto'; END IF;

  PERFORM 1 FROM public.notifications
    WHERE user_id='44444444-4444-4444-4444-444444444444'
      AND body LIKE 'Seu plano termina amanhã%';
  IF NOT FOUND THEN RAISE EXCEPTION 'CENÁRIO 1 FALHOU: texto de 1 dia incorreto'; END IF;

  PERFORM 1 FROM public.notifications
    WHERE user_id='55555555-5555-5555-5555-555555555555'
      AND body LIKE 'Seu plano vence hoje%';
  IF NOT FOUND THEN RAISE EXCEPTION 'CENÁRIO 1 FALHOU: texto de 0 dia (hoje) incorreto'; END IF;

  -- Cenário 6: vencido vira plan_expired
  PERFORM 1 FROM public.notifications
    WHERE user_id='66666666-6666-6666-6666-666666666666'
      AND type='plan_expired' AND body LIKE 'Seu plano expirou%';
  IF NOT FOUND THEN RAISE EXCEPTION 'CENÁRIO 6 FALHOU: alerta de plano vencido não gerado'; END IF;

  RAISE NOTICE 'OK 1+6: varredura criou 6 marcos (15/10/5/1/0/vencido), retorno=%', v_created;
END $$;

-- ── Cenário 2: idempotência (sem duplicar) ──────────────────────────────────
DO $$
DECLARE v_created INT; v_total INT;
BEGIN
  v_created := public.run_plan_expiry_notifications();   -- segunda passada
  IF v_created <> 0 THEN
    RAISE EXCEPTION 'CENÁRIO 2 FALHOU: 2ª varredura criou % (esperado 0)', v_created;
  END IF;

  SELECT count(*) INTO v_total FROM public.notifications
  WHERE user_id IN (
    '11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555','66666666-6666-6666-6666-666666666666');
  IF v_total <> 6 THEN
    RAISE EXCEPTION 'CENÁRIO 2 FALHOU: total mudou para % após 2ª varredura', v_total;
  END IF;
  RAISE NOTICE 'OK 2: varredura idempotente (nenhuma duplicata)';
END $$;

-- ── Cenário 3: marcar UMA como lida (como u1, via RLS) ──────────────────────
DO $$
DECLARE v_id UUID; v_unread INT;
BEGIN
  SET LOCAL role authenticated;
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

  SELECT id INTO v_id FROM public.notifications
    WHERE user_id='11111111-1111-1111-1111-111111111111' LIMIT 1;
  PERFORM public.mark_notification_read(v_id);

  v_unread := public.unread_notification_count();
  IF v_unread <> 0 THEN
    RAISE EXCEPTION 'CENÁRIO 3 FALHOU: u1 deveria ter 0 não lidas, tem %', v_unread;
  END IF;

  PERFORM 1 FROM public.notifications WHERE id=v_id AND is_read AND read_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'CENÁRIO 3 FALHOU: read_at não carimbado'; END IF;
  RESET role;
  RAISE NOTICE 'OK 3: marcar uma como lida';
END $$;

-- ── Cenário 5: isolamento por usuário (RLS) ─────────────────────────────────
DO $$
DECLARE v_visible INT; v_u3_unread_before INT; v_u3_unread_after INT; v_u3_id UUID;
BEGIN
  -- pega um id do u3 enquanto ainda como postgres
  SELECT id INTO v_u3_id FROM public.notifications
    WHERE user_id='33333333-3333-3333-3333-333333333333' LIMIT 1;
  SELECT count(*) INTO v_u3_unread_before FROM public.notifications
    WHERE user_id='33333333-3333-3333-3333-333333333333' AND is_read=false;

  -- Agora age como u2 tentando bisbilhotar/alterar dados do u3
  SET LOCAL role authenticated;
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

  SELECT count(*) INTO v_visible FROM public.notifications
    WHERE user_id='33333333-3333-3333-3333-333333333333';
  IF v_visible <> 0 THEN
    RAISE EXCEPTION 'CENÁRIO 5 FALHOU: u2 enxergou % notificações de u3 (esperado 0)', v_visible;
  END IF;

  -- u2 tenta marcar a notificação do u3 como lida → deve ser no-op
  PERFORM public.mark_notification_read(v_u3_id);
  RESET role;

  SELECT count(*) INTO v_u3_unread_after FROM public.notifications
    WHERE user_id='33333333-3333-3333-3333-333333333333' AND is_read=false;
  IF v_u3_unread_after <> v_u3_unread_before THEN
    RAISE EXCEPTION 'CENÁRIO 5 FALHOU: u2 conseguiu alterar notificação de u3';
  END IF;
  RAISE NOTICE 'OK 5: RLS isola notificações entre usuários';
END $$;

-- ── Cenário 7: pagamento confirmado limpa alerta de vencimento ──────────────
DO $$
DECLARE v_unread INT;
BEGIN
  SET LOCAL role authenticated;
  PERFORM set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);

  -- u3 tem 1 alerta plan_expiring (5 dias) não lido
  PERFORM public.create_notification(
    'payment_confirmed', 'Pagamento confirmado',
    'Pagamento confirmado. Seu plano está ativo novamente.', NULL, '/meu-plano', NULL, '{}'::jsonb
  );

  -- O alerta de vencimento deve ter sido marcado como lido pelo trigger
  SELECT count(*) INTO v_unread FROM public.notifications
    WHERE user_id='33333333-3333-3333-3333-333333333333'
      AND type IN ('plan_expiring','plan_expired') AND is_read=false;
  IF v_unread <> 0 THEN
    RAISE EXCEPTION 'CENÁRIO 7 FALHOU: alerta de vencimento não foi encerrado (% restantes)', v_unread;
  END IF;
  RESET role;
  RAISE NOTICE 'OK 7: pagamento confirmado encerra alerta de vencimento';
END $$;

-- ── Cenário 4: marcar TODAS como lidas (como u4) ────────────────────────────
DO $$
DECLARE v_changed INT; v_unread INT;
BEGIN
  SET LOCAL role authenticated;
  PERFORM set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);

  v_changed := public.mark_all_notifications_read();
  v_unread  := public.unread_notification_count();
  IF v_unread <> 0 THEN
    RAISE EXCEPTION 'CENÁRIO 4 FALHOU: u4 ainda tem % não lidas', v_unread;
  END IF;
  IF v_changed < 1 THEN
    RAISE EXCEPTION 'CENÁRIO 4 FALHOU: mark_all deveria ter mudado >=1, mudou %', v_changed;
  END IF;
  RESET role;
  RAISE NOTICE 'OK 4: marcar todas como lidas (% alteradas)', v_changed;
END $$;

-- ── Guard: tentativa de reescrever conteúdo deve falhar ─────────────────────
DO $$
DECLARE v_id UUID; v_err BOOLEAN := false;
BEGIN
  SELECT id INTO v_id FROM public.notifications
    WHERE user_id='22222222-2222-2222-2222-222222222222' LIMIT 1;
  SET LOCAL role authenticated;
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
  BEGIN
    UPDATE public.notifications SET body='conteúdo adulterado' WHERE id=v_id;
  EXCEPTION WHEN others THEN
    v_err := true;
  END;
  RESET role;
  IF NOT v_err THEN
    RAISE EXCEPTION 'GUARD FALHOU: usuário conseguiu reescrever o corpo da notificação';
  END IF;
  RAISE NOTICE 'OK guard: conteúdo é imutável (só is_read/read_at mudam)';
END $$;

DO $$ BEGIN RAISE NOTICE '✅ TODOS OS TESTES PASSARAM'; END $$;

ROLLBACK;
