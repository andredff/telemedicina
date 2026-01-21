# PLANO DE PROJETO - NOVITA TELEMEDICINA

**Projeto**: Desenvolvimento do MVP - Novita Telemedicina
**Contrato**: 001/2026
**Cliente**: Novita Home Care Servicos em Saude LTDA
**Fornecedor**: Migrai Tecnologia da Informacao LTDA
**Data**: Janeiro/2026

---

## 1. VISAO GERAL DO PROJETO

### 1.1 Objetivo
Desenvolver o Produto Minimo Viavel (MVP) da plataforma "Novita Telemedicina", integrando servicos de home care e telemedicina em uma solucao digital completa, otimizada para conversao e geracao de receita.

### 1.2 Escopo Resumido
- Landing Page institucional com redesign completo
- Sistema de gestao de assinaturas (5 planos)
- Checkout integrado com gateway de pagamento
- Area do usuario (painel do assinante)
- Integracao White Label com plataforma de telemedicina
- Modulo "Medicamento em Casa" com e-commerce
- Painel administrativo de gestao

### 1.3 Valor do Contrato

| Fase | Valor | Forma de Pagamento |
|------|-------|-------------------|
| **Desenvolvimento MVP** | R$ 40.000,00 | 50% entrada + 50% entrega |
| **Sustentacao (6 meses)** | R$ 24.000,00 | 6x R$ 4.000,00/mes |
| **TOTAL CONTRATUAL** | **R$ 64.000,00** | |

---

## 2. CRONOGRAMA DE EXECUCAO

### 2.1 Visao Geral - 30 Dias

```
SEMANA 1: Infraestrutura e Integracoes Base
SEMANA 2: Portal do Paciente e Sistema de Assinaturas
SEMANA 3: E-commerce de Medicamentos e Painel Admin
SEMANA 4: Testes, Homologacao e Go-Live
```

### 2.2 Cronograma Detalhado

#### SEMANA 1 - INFRAESTRUTURA E INTEGRACOES (Dias 1-7)

| Dia | Atividade | Responsavel | Dependencia |
|-----|-----------|-------------|-------------|
| 1-2 | Setup do ambiente de desenvolvimento | Migrai | Pagamento entrada |
| 1-2 | Configuracao do Supabase (banco de dados) | Migrai | - |
| 2-3 | Criacao das tabelas do banco de dados | Migrai | - |
| 3-4 | Integracao com gateway de pagamento (sandbox) | Migrai | Credenciais gateway |
| 4-5 | Integracao com plataforma de telemedicina | Migrai | Credenciais telemedicina |
| 5-6 | Configuracao do dominio e SSL | Migrai | Acesso DNS |
| 6-7 | Implementacao do sistema de autenticacao | Migrai | - |
| 7 | **ENTREGA PARCIAL 1**: Infraestrutura pronta | Migrai | - |

**Entregaveis da Semana 1:**
- [ ] Ambiente de desenvolvimento configurado
- [ ] Banco de dados estruturado
- [ ] Integracoes base funcionando em sandbox
- [ ] Autenticacao de usuarios implementada

---

#### SEMANA 2 - PORTAL DO PACIENTE (Dias 8-14)

| Dia | Atividade | Responsavel | Dependencia |
|-----|-----------|-------------|-------------|
| 8-9 | Redesign da Landing Page - Secoes institucionais | Migrai | Briefing completo |
| 9-10 | Secao de planos com comparativo | Migrai | Dados dos planos |
| 10-11 | Checkout de assinaturas (Cartao + PIX) | Migrai | Gateway integrado |
| 11-12 | Sistema de cobranca recorrente | Migrai | - |
| 12-13 | Area do usuario - Dashboard | Migrai | - |
| 13-14 | Area do usuario - Gestao de dados e plano | Migrai | - |
| 14 | **ENTREGA PARCIAL 2**: Portal B2C funcional | Migrai | - |

**Entregaveis da Semana 2:**
- [ ] Landing Page completa e responsiva
- [ ] Pagina de planos com checkout
- [ ] Pagamentos funcionando (sandbox)
- [ ] Area do assinante implementada

---

#### SEMANA 3 - E-COMMERCE E ADMIN (Dias 15-21)

| Dia | Atividade | Responsavel | Dependencia |
|-----|-----------|-------------|-------------|
| 15-16 | Sistema de busca de receitas | Migrai | Modelo de dados receitas |
| 16-17 | Carrinho de compras de medicamentos | Migrai | - |
| 17-18 | Checkout de medicamentos | Migrai | - |
| 18-19 | Sistema de notificacao logistica | Migrai | - |
| 19-20 | Dashboard administrativo - Metricas | Migrai | - |
| 20-21 | Painel de gestao de pedidos | Migrai | - |
| 21 | **ENTREGA PARCIAL 3**: E-commerce e Admin | Migrai | - |

**Entregaveis da Semana 3:**
- [ ] Modulo "Medicamento em Casa" completo
- [ ] Dashboard financeiro
- [ ] Gestao de pedidos implementada

---

#### SEMANA 4 - TESTES E GO-LIVE (Dias 22-30)

| Dia | Atividade | Responsavel | Dependencia |
|-----|-----------|-------------|-------------|
| 22-23 | Testes de integracao completos | Migrai | - |
| 23-24 | Testes de fluxo de pagamento | Migrai + Novita | - |
| 24-25 | Correcoes e ajustes | Migrai | Feedback testes |
| 25-26 | Migracao para ambiente de producao | Migrai | - |
| 26-27 | Configuracao gateway em producao | Migrai | Credenciais producao |
| 27-28 | Testes finais em producao | Migrai + Novita | - |
| 28-29 | Treinamento da equipe de suporte | Migrai | Equipe contratada |
| 29-30 | Documentacao e entrega final | Migrai | - |
| 30 | **GO-LIVE** | Migrai + Novita | Aceite MVP |

**Entregaveis da Semana 4:**
- [ ] Sistema testado e validado
- [ ] Ambiente de producao configurado
- [ ] Equipe treinada
- [ ] Documentacao entregue
- [ ] MVP em producao

---

## 3. ENTREGAS CONTRATUAIS (MVP)

### 3.1 Portal do Paciente & Venda de Planos

| # | Funcionalidade | Descricao | Status |
|---|----------------|-----------|--------|
| 1.1 | Landing Page Institucional | Redesign completo integrando home care e telemedicina, responsivo, otimizado para conversao | ( ) |
| 1.2 | Sistema de Gestao de Assinaturas | Multiplos planos (Bronze, Prata, Ouro, Platina, Coletivo) | ( ) |
| 1.3 | Checkout Integrado | Gateway de pagamento com cartao e cobranca recorrente | ( ) |
| 1.4 | Area do Usuario | Painel do assinante para gestao de dados e acompanhamento | ( ) |

### 3.2 Core: Telemedicina Integrada

| # | Funcionalidade | Descricao | Status |
|---|----------------|-----------|--------|
| 2.1 | Controle de Acesso Inteligente | Verificacao de adimplencia antes de liberar telemedicina | ( ) |
| 2.2 | Integracao White Label | Plataforma de telemedicina parceira via iFrame | ( ) |
| 2.3 | Gateway de Pagamento | Cartao de credito e PIX com cobranca recorrente | ( ) |

### 3.3 Modulo "Medicamento em Casa"

| # | Funcionalidade | Descricao | Status |
|---|----------------|-----------|--------|
| 3.1 | Busca de Receita | Por protocolo/codigo/token | ( ) |
| 3.2 | Mineracao de Receita | Sistema de localizacao de receita | ( ) |
| 3.3 | Carrinho de Compras | Para medicamentos prescritos | ( ) |
| 3.4 | Checkout Medicamentos | Pagamento avulso (Cartao e PIX) | ( ) |
| 3.5 | Notificacao Logistica | Ordem de servico automatica | ( ) |

### 3.4 Painel Administrativo

| # | Funcionalidade | Descricao | Status |
|---|----------------|-----------|--------|
| 4.1 | Dashboard Financeiro | Metricas de assinantes, inadimplencia, receita | ( ) |
| 4.2 | Gestao de Pedidos | Acompanhamento financeiro, status e rastreamento | ( ) |

---

## 4. EXCLUSOES DO MVP (FASE 2 - POS-LANCAMENTO)

As seguintes funcionalidades serao desenvolvidas durante o periodo de sustentacao:

| # | Funcionalidade | Prioridade |
|---|----------------|------------|
| 1 | Sistema de cupons e codigos promocionais | Alta |
| 2 | Recorrencia automatica de medicamentos | Alta |
| 3 | Integracao fiscal (NF-e) | Media |
| 4 | Agendamento avancado com multiplas agendas | Media |
| 5 | Blog dinamico com CMS e SEO | Media |
| 6 | Telepsicologia e telenutrição | Baixa |
| 7 | Planos B2B/Corporativos | Baixa |
| 8 | Chatbot AI | Baixa |
| 9 | App mobile nativo | Futura |

---

## 5. DEPENDENCIAS DO CLIENTE

### 5.1 Materiais Obrigatorios

| Item | Prazo | Status |
|------|-------|--------|
| Briefing completo preenchido | 10 dias apos assinatura | ( ) |
| Logomarca em alta resolucao | 10 dias apos assinatura | ( ) |
| Paleta de cores e fontes | 10 dias apos assinatura | ( ) |
| Textos institucionais | 10 dias apos assinatura | ( ) |
| Descricao e precos dos planos | 10 dias apos assinatura | ( ) |
| FAQ | 10 dias apos assinatura | ( ) |
| 3 artigos do blog | 10 dias apos assinatura | ( ) |
| Termos de uso e privacidade | 10 dias apos assinatura | ( ) |

### 5.2 Acessos e Credenciais

| Item | Prazo | Status |
|------|-------|--------|
| Contato responsavel gateway pagamento | 7 dias apos assinatura | ( ) |
| Contato responsavel telemedicina white label | 7 dias apos assinatura | ( ) |
| Credenciais de e-mail (SMTP/API) | 7 dias apos assinatura | ( ) |
| Acesso ao dominio (DNS) | 7 dias apos assinatura | ( ) |

### 5.3 Equipe

| Item | Prazo | Status |
|------|-------|--------|
| Responsavel para validacoes (com poder de decisao) | Imediato | ( ) |
| Equipe de suporte contratada | Durante os 30 dias | ( ) |

---

## 6. MARCOS DE PAGAMENTO

### 6.1 Fase de Desenvolvimento

| Marco | Valor | Condicao | Data Prevista |
|-------|-------|----------|---------------|
| 1a Parcela | R$ 20.000,00 | Assinatura do contrato | ___/___/2026 |
| 2a Parcela | R$ 20.000,00 | Aceite do MVP | ___/___/2026 |

### 6.2 Fase de Sustentacao

| Mes | Valor | Vencimento |
|-----|-------|------------|
| Mes 1 | R$ 4.000,00 | Dia 5 do mes seguinte ao aceite |
| Mes 2 | R$ 4.000,00 | Dia 5 |
| Mes 3 | R$ 4.000,00 | Dia 5 |
| Mes 4 | R$ 4.000,00 | Dia 5 |
| Mes 5 | R$ 4.000,00 | Dia 5 |
| Mes 6 | R$ 4.000,00 | Dia 5 |

---

## 7. COMUNICACAO E GOVERNANCA

### 7.1 Canais de Comunicacao

| Tipo | Canal | Frequencia |
|------|-------|------------|
| Atualizacoes de progresso | E-mail/WhatsApp | Semanal |
| Duvidas rapidas | WhatsApp | Conforme necessidade |
| Validacoes formais | E-mail | Conforme entregas |
| Reunioes de alinhamento | Google Meet | Semanal |

### 7.2 Contatos

**Migrai (Contratada)**
- Bruno de Souza Rego
- E-mail: bruno@migrai.com.br
- Telefone: (61) 99505-3338

**Novita (Contratante)**
- Mauricio Melo
- E-mail: ceo@novitahomecare.com.br
- Telefone: (61) 99500-9559

### 7.3 Reunioes Semanais

| Semana | Pauta Principal | Data Sugerida |
|--------|-----------------|---------------|
| 1 | Kickoff + Infraestrutura | ___/___/2026 |
| 2 | Validacao Portal | ___/___/2026 |
| 3 | Validacao E-commerce | ___/___/2026 |
| 4 | Testes + Pre-Go-Live | ___/___/2026 |

---

## 8. RISCOS E MITIGACOES

### 8.1 Riscos Identificados

| # | Risco | Probabilidade | Impacto | Mitigacao |
|---|-------|---------------|---------|-----------|
| 1 | Atraso no recebimento de materiais do cliente | Alta | Alto | Comunicacao clara de prazos, briefing estruturado |
| 2 | Indisponibilidade de APIs de terceiros | Media | Alto | Testes antecipados, comunicacao com parceiros |
| 3 | Mudancas de escopo durante desenvolvimento | Media | Alto | Controle rigoroso de escopo, formalizacao |
| 4 | Atraso na contratacao de equipe de suporte | Media | Medio | Alertas antecipados ao cliente |
| 5 | Problemas de integracao com gateway | Baixa | Alto | Testes em sandbox desde a semana 1 |

### 8.2 Acoes Preventivas

1. **Kick-off detalhado** com alinhamento de expectativas
2. **Entregas parciais semanais** para validacao continua
3. **Ambiente de homologacao** para testes do cliente
4. **Documentacao clara** de tudo que e escopo e exclusao
5. **Buffer de 2 dias** na semana 4 para ajustes finais

---

## 9. CRITERIOS DE ACEITE

O MVP sera considerado entregue quando:

- [ ] Todas as funcionalidades da Clausula 1.2 do contrato estiverem operacionais
- [ ] Sistema acessivel em ambiente de producao
- [ ] Integracoes com gateway e telemedicina funcionais
- [ ] Painel administrativo funcional e acessivel
- [ ] Codigo fonte entregue ao cliente
- [ ] Documentacao basica fornecida

### 9.1 Processo de Homologacao

1. Migrai disponibiliza MVP em ambiente de homologacao
2. Novita tem **15 dias uteis** para realizar testes
3. Novita comunica eventuais correcoes por escrito
4. Migrai tem **5 dias uteis** para realizar correcoes
5. Assinatura do Termo de Aceite (Anexo I do contrato)

### 9.2 Aceite Tacito

Ocorre automaticamente se:
- Silencio da Novita apos prazo de homologacao
- Uso do sistema em producao para fins comerciais

---

## 10. GARANTIA E SUSTENTACAO

### 10.1 Garantia (90 dias)

Apos o aceite, a Migrai oferece 90 dias de garantia contra defeitos de desenvolvimento:

| Severidade | Descricao | SLA |
|------------|-----------|-----|
| Critica | Sistema fora do ar | 4h uteis |
| Grave | Funcionalidade importante comprometida | 8h uteis |
| Moderada | Funcionalidade secundaria afetada | 24h uteis |
| Menor | Problemas esteticos | 48h uteis |

**Importante**: Correcoes em garantia NAO consomem horas da sustentacao.

### 10.2 Sustentacao Mensal (R$ 4.000/mes)

Inclui 20 horas mensais de:
- Monitoramento proativo
- Correcao de bugs
- Suporte tecnico (seg-sex, 8h-18h)
- Atualizacoes de seguranca
- Pequenos ajustes
- **Desenvolvimento das funcionalidades da Fase 2**

Horas excedentes: R$ 200/hora (pre-aprovadas)

---

## 11. DOCUMENTOS COMPLEMENTARES

| Documento | Descricao |
|-----------|-----------|
| BRIEFING_CLIENTE_NOVITA.md | Template para coleta de informacoes |
| CHECKLIST_ENTREGAS_MVP.md | Checklist detalhado de entregas |
| Contrato 001/2026 | Contrato assinado pelas partes |
| Termo de Aceite (Anexo I) | Para assinatura na entrega |
| Checklist de Materiais (Anexo II) | Materiais necessarios do cliente |

---

## 12. APROVACOES

### Aprovacao do Plano de Projeto

**Contratante (Novita)**

Nome: _______________________
Cargo: _______________________
Data: ___/___/2026
Assinatura: _______________________


**Contratada (Migrai)**

Nome: Bruno de Souza Rego
Cargo: Representante Legal
Data: ___/___/2026
Assinatura: _______________________

---

*Documento gerado em: Janeiro/2026*
*Versao: 1.0*
