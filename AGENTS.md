# AGENTS.md

Instruções para agentes colaborando neste projeto.

## Escopo e validação
- Use `ESCOPO_FECHADO.md` como contrato do MVP.
- Valide pendências vs. implementação antes de iniciar novas mudanças.

## Deploy (AWS)
- O deploy oficial é via AWS S3 + CloudFront usando `deploy-aws.sh`.
- Execute build e testes antes do deploy.
- Certifique-se de que as variáveis de ambiente estão configuradas.

## Pagamentos e pedidos
- PIX no checkout de medicamentos é **mock** (QR gerado no client).
- Status de pedidos deve seguir o enum do Supabase:
  - `pending`, `processing`, `shipped`, `delivered`, `cancelled`

## Padrões
- Preferir chamadas via `@/` para imports.
- Evitar alterações diretas em componentes shadcn/ui em `src/components/ui`.
