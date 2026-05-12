-- ============================================================
-- Truncate medications
-- ============================================================
-- Limpa todos os registros da tabela medications mantendo a
-- estrutura. cart_items é limpo em cascata pela FK existente.
-- ============================================================

DELETE FROM public.medications;
