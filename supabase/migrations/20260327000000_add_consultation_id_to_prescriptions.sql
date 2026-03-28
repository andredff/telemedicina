-- Migration: Adicionar coluna consultation_id na tabela prescriptions
-- Objetivo: Permitir buscar receitas por ID da consulta em vez de código

ALTER TABLE public.prescriptions 
ADD COLUMN IF NOT EXISTS consultation_id TEXT;

-- Criar índice para busca rápida por consultation_id
CREATE INDEX IF NOT EXISTS idx_prescriptions_consultation_id 
ON public.prescriptions(consultation_id);

-- Comentário para documentar o propósito da coluna
COMMENT ON COLUMN public.prescriptions.consultation_id 
IS 'ID da consulta/teleconsulta que originou a receita (vínculo com a API Assemed)';
