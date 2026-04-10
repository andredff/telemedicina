-- Link orders to prescription (receita) and consultation
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS receita_id      text,        -- consultationId (string) da receita Assemed
  ADD COLUMN IF NOT EXISTS receita_url_pdf text,        -- URL do PDF da receita
  ADD COLUMN IF NOT EXISTS consulta_id     text;        -- consultationId da consulta Assemed
