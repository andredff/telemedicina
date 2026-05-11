# Configuração do PIX na Cielo

Este guia descreve como habilitar e validar o pagamento via **PIX** na integração Cielo do projeto Novità Telemedicina, tanto em **sandbox** (testes) quanto em **produção**.

---

## TL;DR

| Ambiente   | Credenciais (MerchantId / Key) | Toggle PIX            | Webhook |
|------------|--------------------------------|-----------------------|---------|
| Sandbox    | Variáveis de ambiente do servidor (`.env.local` em dev) | Admin → Configurações → Cielo | Opcional em dev |
| Produção   | Variáveis de ambiente do Render | Admin → Configurações → Cielo | Recomendado |

**Credenciais nunca são editadas pela UI** — são lidas das env vars do servidor (Render em produção). O admin só controla se o PIX está ligado e mostra um diagnóstico de status.

---

## Como funciona o fluxo PIX no sistema

1. Cliente abre o checkout de medicamento e escolhe PIX.
2. Front chama `POST /api/cielo/payment` com `paymentType: "pix"`.
3. Servidor monta o request para a Cielo (`Payment.Type = "Pix"`) e devolve `QrCodeBase64Image` + `QrCodeString`.
4. Front exibe o QR Code e fica fazendo **polling** a cada 5 s em `GET /api/cielo/payment/:paymentId`.
5. Quando o cliente paga, a Cielo retorna `Status = 2`.
6. Servidor marca o pedido como `payment_status='paid'` no Supabase, front confirma para o cliente e redireciona.

**Dois caminhos de confirmação** (redundantes, ambos chegam ao mesmo lugar):

- **Polling do front** (sempre ativo) — funciona enquanto o usuário tiver a aba aberta.
- **Webhook da Cielo** (recomendado em produção) — a Cielo notifica o servidor mesmo se o usuário fechar o navegador. Veja a seção [Webhook](#passo-5--webhook-da-cielo-recomendado-em-produção).

O polling para automaticamente quando o `pix_expires_at` (30 min após geração) é atingido.

---

## Passo 1 — Cadastro Cielo (somente uma vez)

### Sandbox

1. Acesse [https://cadastrosandbox.cieloecommerce.cielo.com.br/](https://cadastrosandbox.cieloecommerce.cielo.com.br/)
2. Crie uma conta de testes (e-mail + dados básicos).
3. Após o cadastro, você recebe **MerchantId** e **MerchantKey** por e-mail.
4. Faça login no portal e localize sua loja sandbox.

### Produção

1. Contrate a Cielo E-commerce em [https://www.cielo.com.br/e-commerce](https://www.cielo.com.br/e-commerce).
2. Após a aprovação comercial, você recebe credenciais de produção via e-mail.

---

## Passo 2 — Habilitar PIX na loja Cielo

PIX **não vem habilitado por padrão**. Sem este passo, o request retorna erro de validação.

### Sandbox

1. Entre no portal sandbox da Cielo com a conta criada.
2. Menu **Loja → Meios de pagamento** (ou similar).
3. Localize **Pix** na lista e clique em **Habilitar**.
4. Em sandbox, a Cielo fornece uma chave PIX fictícia automaticamente — você não precisa cadastrar a sua.

### Produção

1. Entre no portal Cielo com sua conta de produção.
2. Menu **Loja → Meios de pagamento**.
3. Habilite **Pix**.
4. Vincule uma **chave PIX** da sua conta bancária (CNPJ ou aleatória) à loja. A Cielo valida com seu banco antes de liberar.
5. Aguarde a confirmação por e-mail (pode levar de algumas horas a 1 dia útil).

> ⚠ **Sem chave PIX vinculada, a Cielo rejeita o pagamento em produção.**

---

## Passo 3 — Configurar credenciais no servidor

### Em desenvolvimento (`.env.local`)

```
CIELO_MERCHANT_ID=...
CIELO_MERCHANT_KEY=...
CIELO_SANDBOX=true
CIELO_WEBHOOK_TOKEN=<gere com: openssl rand -hex 32>
```

Reinicie o servidor após alterar (`node server/cielo-server.js`).

### Em produção (Render → Dashboard → Environment)

Adicione as mesmas variáveis no painel do Render:

| Variável                | Valor                                                |
|-------------------------|------------------------------------------------------|
| `CIELO_MERCHANT_ID`     | UUID da loja na Cielo (produção)                     |
| `CIELO_MERCHANT_KEY`    | Chave de API (produção)                              |
| `CIELO_SANDBOX`         | `false`                                              |
| `CIELO_WEBHOOK_TOKEN`   | Token aleatório (32+ caracteres). Gere com `openssl rand -hex 32` |

O Render reinicia o serviço automaticamente após salvar.

### Validar pelo Admin

1. Faça login como administrador.
2. Acesse **Admin → Configurações → aba Integrações**.
3. Localize o card **"Cielo — Gateway de Pagamento"**.
4. Confira que o status mostra **"Credenciais: Carregadas (env)"** e o ambiente correto.
5. Clique em **"Validar credenciais"**. O servidor consulta a Cielo com um paymentId fictício; resposta esperada é "Credenciais válidas no ambiente *".
6. Use o toggle **"PIX habilitado"** para ligar/desligar o método de pagamento. Esse toggle é o único campo persistido no banco (`site_settings.value.cieloPixEnabled`).

---

## Passo 4 — Validar o fluxo end-to-end

### Em sandbox

1. Adicione medicamentos ao carrinho.
2. Vá para o checkout e escolha **PIX**.
3. O QR Code aparece. A Cielo sandbox fornece um QR Code real, mas **não é pago de verdade** — você precisa simular o pagamento.
4. Use o endpoint da Cielo sandbox para forçar o pagamento, ou clique no botão "Simular confirmação do pagamento (dev)" que aparece no `PixPaymentForm` em modo `DEV`.
5. O polling do front detecta o `Status = 2`, marca o pedido como pago no Supabase e redireciona para a tela de sucesso.

### Em produção

1. Adicione medicamentos ao carrinho.
2. Faça o pagamento PIX usando o app do seu banco (com um valor real — recomenda-se R$ 1,00 para o primeiro teste).
3. Após o pagamento, o polling detecta automaticamente (até 5 s) e o pedido vira "Pago".
4. Confira no extrato Cielo + extrato bancário se o valor foi creditado.

---

## Passo 5 — Webhook da Cielo (recomendado em produção)

O webhook garante que o pedido seja confirmado **mesmo se o cliente fechar o navegador** antes do polling detectar o pagamento. A Cielo envia um POST para o servidor quando o status do pagamento muda.

### Como funciona

- Endpoint: `POST /api/cielo/webhook?token=<CIELO_WEBHOOK_TOKEN>`
- A Cielo posta `{ PaymentId, ChangeType }` quando o status muda.
- O servidor **não confia no payload** — usa apenas o `PaymentId` para consultar a Cielo (autoritativo) e atualizar o pedido no Supabase.
- Idempotente: receber o mesmo webhook várias vezes não causa efeito colateral.
- Autenticação por **token compartilhado na URL** (a Cielo não assina o payload).

### Configurar na Cielo

1. Entre no portal Cielo (sandbox ou produção).
2. Menu **Loja → Notificações** (ou **Webhooks**, dependendo do portal).
3. Adicione uma URL de notificação:
   ```
   https://<seu-host>/api/cielo/webhook?token=<CIELO_WEBHOOK_TOKEN>
   ```
   - Em produção: `https://novita.migrai.com.br/api/cielo/webhook?token=...` (ou a URL pública do Render)
   - Em dev: use [ngrok](https://ngrok.com) ou [cloudflared](https://github.com/cloudflare/cloudflared) para expor `http://localhost:5174` à internet.
4. Selecione os eventos:
   - **Mudança de status do pagamento** (obrigatório)
   - **Pagamentos recorrentes** (se houver assinaturas)
5. Salve. A Cielo envia um POST de teste — verifique o log do servidor:
   ```
   [Cielo Webhook] <paymentId> → status 12 (Aguardando)
   ```

### Validar

- Faça um pagamento PIX de teste.
- Sem fechar o navegador: o polling detecta primeiro (em até 5 s).
- Feche o navegador antes de pagar e pague pelo banco: o webhook reconcilia em segundos.
- Confira no log do servidor: `[Cielo] ✓ Pedido reconciliado: payment_id=... → paid`.

### Solução de problemas do webhook

| Sintoma                                      | Causa                                                      |
|----------------------------------------------|------------------------------------------------------------|
| 401 nos logs do servidor                     | Token na URL não bate com `CIELO_WEBHOOK_TOKEN`            |
| 503 nos logs                                 | `CIELO_WEBHOOK_TOKEN` não está setado no env do servidor   |
| Cielo desativa o webhook automaticamente     | Servidor respondendo com 5xx repetidamente — corrigir e reativar no portal |
| Webhook não é chamado                        | Verificar se a URL no portal Cielo está correta e pública  |

---

## Modo simulação local (sem Cielo)

Para desenvolvimento puro (sem ainda ter cadastro na Cielo), o servidor tem um modo **simulação** que gera QR Codes fake e devolve sucesso falso:

`.env.local`:
```
CIELO_SANDBOX=true
CIELO_SIMULATE=true
```

Nesse modo:
- O QR Code exibido é falso (não pagável).
- O botão "Simular confirmação do pagamento" no checkout marca o pedido como pago.
- Nenhuma chamada vai para a Cielo.

Útil para demo e desenvolvimento offline. **Não usar em produção.**

---

## Status do PIX no sistema

| Onde            | Como verificar                                          |
|-----------------|---------------------------------------------------------|
| Admin           | Card "Cielo — Gateway de Pagamento" mostra ambiente + se PIX está habilitado + se está simulando |
| Endpoint        | `GET /api/integrations/cielo/status` (requer auth admin) |
| Logs do servidor| Linha `[Cielo] ✓ Configuração carregada do banco de dados` no boot |
| Banco           | `select value from site_settings where key='integrations';` |

---

## Variáveis de ambiente do servidor

Todas as configurações sensíveis ficam no env do servidor (Render em produção, `.env.local` em dev):

```
CIELO_MERCHANT_ID=...
CIELO_MERCHANT_KEY=...
CIELO_SANDBOX=true|false
CIELO_SIMULATE=true|false       # opcional, só dev — gera QR Code falso
CIELO_WEBHOOK_TOKEN=...         # gere com: openssl rand -hex 32
```

A única coisa controlável pelo banco é o toggle **PIX habilitado**, salvo em `site_settings.value.cieloPixEnabled` quando o admin altera no painel.

---

## Solução de problemas

| Sintoma                                             | Causa provável                                          | O que fazer                                                  |
|-----------------------------------------------------|---------------------------------------------------------|--------------------------------------------------------------|
| "Cielo credentials not configured" no checkout       | MerchantId/Key vazios                                   | Preencher no admin e clicar em salvar                        |
| "Pagamento via PIX está desabilitado"                | Toggle PIX desligado no admin                            | Ligar o toggle e salvar                                      |
| Validar credenciais retorna 401/403                  | Credenciais erradas, ou de ambiente diferente            | Confirmar MerchantId/Key. Verificar se Sandbox bate          |
| QR Code aparece mas pagamento nunca confirma         | PIX não habilitado na loja Cielo                         | Habilitar no portal Cielo (Passo 2)                          |
| Em produção: "ProviderError" da Cielo                | Chave PIX não vinculada na conta                         | Vincular chave PIX no portal Cielo                           |
| QR Code está "feio" ou inválido                      | API qrserver fora do ar (fallback)                       | A Cielo já manda QrCodeBase64Image — se ele estiver vazio, verificar se a loja Cielo gera QR Code dinâmico |
| Cliente paga mas pedido fica "aguardando pagamento"  | Cliente fechou a aba antes do polling, webhook não configurado | Configurar webhook (Passo 5) ou reconciliar manualmente via `GET /api/cielo/payment/:id` |

---

## Referências

- Documentação oficial Cielo E-commerce: [https://developercielo.github.io/manual/cielo-ecommerce](https://developercielo.github.io/manual/cielo-ecommerce)
- API Reference PIX: [https://developercielo.github.io/manual/cielo-ecommerce#pix](https://developercielo.github.io/manual/cielo-ecommerce#pix)
- Tabela de status Cielo: 1 = Autorizado, 2 = Pago, 3 = Negado, 10 = Cancelado, 12 = Pendente (PIX aguardando)
