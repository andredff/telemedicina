-- Adiciona colunas de revisão farmacêutica na tabela orders
alter table orders
  add column if not exists receita_review_status  text check (receita_review_status in ('approved', 'rejected')),
  add column if not exists receita_review_notes   text,
  add column if not exists receita_reviewed_at    timestamptz;
