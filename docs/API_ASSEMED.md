# API Assemed - Documentacao Tecnica

> Fonte: `Metodos_API_Assemed_3.2.docx`

## URLs Base

| Ambiente       | URL                                                |
| -------------- | -------------------------------------------------- |
| Homologacao    | `https://dev-api-assemed.azurewebsites.net`        |
| Producao       | `https://api.assemedtelemedicina.com`               |
| Docs (Swagger) | `https://dev-api-assemed.azurewebsites.net/api`    |

## Resumo do Fluxo Principal

1. Cadastrar paciente via `POST /api/Pacientes/cadastro-externo` (usando ClientId + ClientSecret)
2. Login do paciente via `POST /api/Auth/login-externo` (CPF + ClientId + ClientSecret) para obter Access Token
3. Obter especialidades via `POST /api/Especialidades/obterTodas` (autenticado)
4. Criar atendimento via `POST /api/Atendimentos` (autenticado)
5. Acessar teleconsulta via URL da sala de espera (Assemed) ou via URL white-label Novità (`?sala=...`)

---

## Endpoints

### 1. Cadastro do Paciente

**`POST /api/Pacientes/cadastro-externo`**

Cadastra um novo paciente vinculado a empresa (CNPJ).

**Request:**
```json
{
  "identificacao": {
    "clientId": "{{ClientId}}",
    "clientSecret": "{{ClientSecret}}"
  },
  "nome": "Teste Cadastro Paciente",
  "cpf": "69099593023",
  "cnpj": "{{CNPJClient}}",
  "dataNascimento": "2003-08-31T20:07:46.138Z",
  "sexo": "M",
  "telefone": "3136652656",
  "email": "pacienteexterno2@teste.com"
}
```

**Validacoes:**

| Campo          | Tipo     | Obrigatorio | Regra                                    |
| -------------- | -------- | ----------- | ---------------------------------------- |
| clientId       | String   | Sim         |                                          |
| clientSecret   | String   | Sim         |                                          |
| nome           | String   | Sim         | Max 250 caracteres                       |
| cpf            | String   | Sim         | CPF valido                               |
| cnpj           | String   | Sim         | CNPJ da empresa (pre-cadastrado)         |
| dataNascimento | DateTime | Sim         | Formato ISO 8601                         |
| email          | String   | Sim         | Max 100 caracteres, formato email valido |
| sexo           | String   | Sim         | Apenas "M" ou "F"                        |
| telefone       | String   | Sim         | Max 20 caracteres                        |

**Response:**
```json
{
  "pacienteId": 18
}
```

---

### 2. Autenticacao do Paciente (Login)

**`POST /api/Auth/login-externo`**

Autentica paciente e retorna token JWT.

**Request:**
```json
{
  "cpfPaciente": "12105906036",
  "clientId": "{{ClientId}}",
  "clientSecret": "{{ClientSecret}}"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "B1YaPFgw...",
  "prazoMaximoAssumirAtendimento": 0
}
```

- `accessToken`: Bearer token para autenticacao nas demais rotas
- `refreshToken`: Token para renovacao da sessao
- `prazoMaximoAssumirAtendimento`: Prazo maximo em minutos (0 = sem limite)

---

### 3. Obter Especialidades

**`POST /api/Especialidades/obterTodas`**

**Autenticacao:** Bearer Token (accessToken do login)

**Request:**
```json
{
  "pageSize": 0,
  "pageIndex": 0
}
```

**Response:**
```json
{
  "items": [
    {
      "id": 8,
      "nome": "Consulta",
      "icone": "Clinica_Medica_Icone.svg",
      "tipoIcone": "arquivo",
      "precoConsulta": 50.00,
      "valorRepasseProfissional": 0.01,
      "tipoProfissionalId": 1,
      "tipoProfissionalDescricao": "Medico",
      "especialidadeIdMemed": 14,
      "segundaOpcaoEspecialidadeId": null,
      "segundaOpcaoEspecialidadeNome": null,
      "permiteCriacaoAtendimentoPeloPaciente": true,
      "triagem": false,
      "contratoPadraoId": 0,
      "contratoPadraoNome": null
    }
  ]
}
```

**Campos importantes:**
- `id`: Usado como `especialidadeId` na criacao de atendimento
- `tipoProfissionalId`: Usado como `tipoProfissional` na criacao de atendimento
- `permiteCriacaoAtendimentoPeloPaciente`: Se `true`, paciente pode criar atendimento direto
- `triagem`: Se `true`, o atendimento passa por triagem antes

---

### 4. Criacao de Atendimento

**`POST /api/Atendimentos`**

**Autenticacao:** Bearer Token (accessToken do login)

**Request:**
```json
{
  "tipoAtendimento": 1,
  "tipoProfissional": 1,
  "especialidadeId": 1,
  "pacienteId": 18,
  "exames": [
    {
      "arquivoBase64": ""
    }
  ]
}
```

**Validacoes:**

| Campo            | Tipo  | Obrigatorio | Regra                                              |
| ---------------- | ----- | ----------- | -------------------------------------------------- |
| tipoAtendimento  | Int   | Sim         | Sempre `1` (Primeira Consulta)                     |
| tipoProfissional | Int   | Sim         | Obtido em `GET /api/Especialidades`                |
| especialidadeId  | Int   | Sim         | Obtido em `GET /api/Especialidades`                |
| pacienteId       | Int   | Sim         | Obtido decodificando o JWT do login (`pacienteId`) |
| exames           | Array | Nao         | Imagens/PDFs em Base64                             |

**Response:**
```json
{
  "id": 35,
  "pacienteToken": "eyJhbGci...",
  "usuarioIdProximoProfissional": null,
  "existePacienteAguardandoSemProfissional": true,
  "existeAtendimentoTextoAguardando": false,
  "pacienteNome": "Teste Cadastro Paciente",
  "tituloAssinatura": "Assinatura Empresarial",
  "cupom": null,
  "pendingBillingSessionSecret": null
}
```

**Campos importantes:**
- `id`: ID do atendimento (usado para acessar a sala de teleconsulta)
- `pacienteToken`: Token Twilio para acesso a sala de video

---

### 5. Acesso a Teleconsulta (Sala de Espera)

**URLs de acesso (conforme documentacao):**

| Ambiente    | URL                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Homologacao | `https://dev-app-assemed.azurewebsites.net/sala-espera-externa/{{atendimentoId}}?token={{pacienteToken}}` |
| Producao    | `https://app.assemedtelemedicina.com/sala-espera-externa/{{atendimentoId}}?token={{pacienteToken}}`       |

- `atendimentoId`: ID retornado na criacao do atendimento
- `pacienteToken`: Token JWT (Twilio) retornado na criacao do atendimento

**URL White-Label Novita:**

A URL real da WL Novità usa query string com sala:

`https://telemedicina.novitahomecare.com.br?sala={salaId}`

Exemplo validado: `https://telemedicina.novitahomecare.com.br?sala=1773`

Implementacao no projeto:
- `src/integrations/assemed/config.ts` prioriza `?sala=...` (default `1773`), com override por `VITE_TELEMEDICINA_WL_SALA_ID` ou `sala` na própria URL base.
- Mantem fallback legado por token (`/consulta-imediata?token=...`) para compatibilidade.

---

### 6. Rotas Auxiliares

#### 6.1 Listar Atendimentos do Paciente

**`POST /api/Atendimentos/obter`**

**Request:**
```json
{
  "pageIndex": 0,
  "pageSize": 10
}
```

#### 6.2 Detalhes do Atendimento

**`GET /api/Atendimentos/{id}`**

Retorna todos os detalhes de um atendimento especifico.

#### 6.3 Cancelar Atendimento

**`PUT /api/Atendimentos/{id}/cancelar`**

#### 6.4 Avaliar Atendimento

**`POST /api/Atendimentos/{id}/avaliar`**

**Request:**
```json
{
  "nota": 5,
  "comentario": "Excelente atendimento"
}
```

#### 6.5 Listar Receituarios/Exames/Atestados

**`GET /api/Atendimentos/v2/{id}/receituario`**

Retorna links para download dos documentos emitidos durante a consulta (receitas, atestados, exames). Os receituarios sao emitidos pela plataforma Memed e retornados como links.

#### 6.6 Verificar Situacao do Atendimento (Polling)

**`GET /api/Atendimentos/{id}/simplificado`**

Utilizado para polling periodico durante a consulta. Se `situacao === "CONCLUIDO"`, a sala deve ser fechada.

---

## Validacao da Implementacao

| # | Endpoint                                      | Implementado | Arquivo                                    | Status |
|---|-----------------------------------------------|--------------|--------------------------------------------|--------|
| 1 | `POST /api/Pacientes/cadastro-externo`        | Sim          | `src/integrations/assemed/client.ts`       | OK     |
| 2 | `POST /api/Auth/login-externo`                | Sim          | `src/integrations/assemed/client.ts`       | OK     |
| 3 | `POST /api/Especialidades/obterTodas`         | Sim          | `src/integrations/assemed/client.ts`       | OK     |
| 4 | `POST /api/Atendimentos` (criar)              | Sim          | `src/integrations/assemed/client.ts`       | OK     |
| 5 | `GET /api/Atendimentos/{id}` (detalhes)       | Sim          | `src/integrations/assemed/client.ts`       | OK     |
| 6 | `POST /api/Atendimentos/obter` (listar)       | Sim          | `src/integrations/assemed/client.ts`       | OK     |
| 7 | `PUT /api/Atendimentos/{id}/cancelar`         | Sim          | `src/integrations/assemed/client.ts`       | OK     |
| 8 | `POST /api/Atendimentos/{id}/avaliar`         | Sim          | `src/integrations/assemed/client.ts`       | OK     |
| 9 | `GET /api/Atendimentos/v2/{id}/receituario`   | Sim          | `src/integrations/assemed/client.ts`       | OK     |
| 10| `GET /api/Atendimentos/{id}/simplificado`     | Sim          | `src/integrations/assemed/client.ts`       | OK     |
| 11| URL sala de espera externa (incl. WL Novità)   | Sim          | `src/integrations/assemed/config.ts`       | OK     |

**Resultado: 10/10 endpoints implementados + URL de sala externa/WL validada em configuracao.**

## Problemas Encontrados (Fev/2026)

1. **Cadastro retorna 500**: `POST /api/Pacientes/cadastro-externo` retorna `NullReferenceException` em `PacienteExternoCriarCommand.cs:line 106` — bug no backend da Assemed.
2. **CPFs do doc nao funcionam**: Os CPFs `69099593023` e `12105906036` mencionados na documentacao retornam "CPF de paciente nao cadastrado" no login — nao estao cadastrados no ambiente de homologacao.
3. **Sem usuarios de teste**: Nao foram fornecidos CPFs de pacientes ativos no ambiente de homologacao.

## Credenciais (Configuracao)

As credenciais de acesso sao configuradas no `.env`:

```env
VITE_ASSEMED_CLIENT_ID="..."
VITE_ASSEMED_CLIENT_SECRET="..."
VITE_ASSEMED_CNPJ_CLIENT="..."
VITE_ASSEMED_SANDBOX="true"  # true = homologacao, false = producao
```
