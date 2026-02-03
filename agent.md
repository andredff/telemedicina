# agent.md

Resumo rápido para agentes trabalhando neste repo.

## Fonte de verdade (MVP)
- Contrato/escopo: `ESCOPO_FECHADO.md`

## Deploy (AWS)
- Script: `deploy-aws.sh`
- Fluxo padrão:
```bash
bash test-validation.sh
npm run build
bash deploy-aws.sh
aws cloudfront create-distribution --distribution-config file:///tmp/cloudfront-config.json
```
- Requer AWS CLI configurado e credenciais válidas.

## Pagamentos
- Cartão: Cielo (mock se não houver credenciais).
- PIX (medicamentos): mock/stub com QR gerado localmente.
- Persistência: tabela `orders` com `payment_status` e campos `pix_*`.

## Status de pedidos (Supabase enum)
`pending`, `processing`, `shipped`, `delivered`, `cancelled`

## Comandos úteis
```bash
npm run dev
npm run build
npm run lint
bash test-validation.sh
```
