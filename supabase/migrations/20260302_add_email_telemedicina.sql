-- Migration: Adiciona campo email_telemedicina à tabela profiles
-- Data: 2026-03-02
-- Descrição: Campo para armazenar o alias de email usado no cadastro externo da Assemed

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_telemedicina TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.profiles.email_telemedicina IS 'Alias de email usado no cadastro externo da telemedicina Assemed (formato: paciente+username@novitatelemedicina.com.br)';
