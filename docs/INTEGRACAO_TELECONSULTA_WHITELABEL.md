# Integração Iframe White-Label Telemedicina Novità

## 📋 Resumo

Implementada a funcionalidade de abrir o iframe da plataforma white-label **https://telemedicina.novitahomecare.com.br/** dentro do dashboard, já autenticado com o usuário do projeto.

## 🎯 Componentes Criados/Modificados

### 1. `TelemedicineWhiteLabelFrame`
**Localização:** `src/components/telemedicine/TelemedicineWhiteLabelFrame.tsx`

Componente principal que gerencia:
- ✅ Exibição do iframe white-label em tela cheia
- ✅ Autenticação automática via token na URL
- ✅ Suporte a "Consulta Imediata" e "Agendar Consulta"
- ✅ Header com botão de fechar e link para abrir em nova aba
- ✅ Loading spinner durante carregamento
- ✅ Tratamento de erros com retry
- ✅ Permissões para câmera/microfone

### 2. Função `getWhiteLabelConsultationUrl`
**Localização:** `src/integrations/assemed/config.ts`

Gera a URL autenticada para o iframe:
```typescript
export function getWhiteLabelConsultationUrl(
  accessToken: string,
  tipoConsulta: "imediata" | "agendada"
): string
```

**URLs geradas:**
- Consulta Imediata: `https://telemedicina.novitahomecare.com.br/consulta-imediata?token={accessToken}`
- Agendar Consulta: `https://telemedicina.novitahomecare.com.br/agendar-consulta?token={accessToken}`

### 3. Hook `useTelemedicineWhiteLabel`
**Localização:** `src/components/telemedicine/TelemedicineWhiteLabelFrame.tsx`

Hook opcional para gerenciar estado da teleconsulta:
```typescript
const {
  isOpen,
  tipoConsulta,
  accessToken,
  openImediate,
  openSchedule,
  close,
} = useTelemedicineWhiteLabel();
```

## 🔄 Fluxo de Autenticação

```
1. Usuário clica em "Consulta Imediata" ou "Agendar Consulta"
   ↓
2. Sistema verifica se usuário tem plano ativo
   ↓
3. Sistema busca CPF do usuário (da tabela profiles ou user_metadata do Supabase)
   ↓
4. Faz login na API Assemed com CPF do usuário
   ↓
5. Obtém accessToken da API Assemed
   ↓
6. Se necessário, cadastra o paciente na plataforma
   ↓
7. Abre iframe white-label com token na URL
   ↓
8. Plataforma white-label valida token e exibe conteúdo
```

## 📱 Integração no Dashboard

**Localização:** `src/pages/Dashboard.tsx`

Adicionados estados:
```typescript
const [whiteLabelAccessToken, setWhiteLabelAccessToken] = useState<string | null>(null);
const [whiteLabelTipoConsulta, setWhiteLabelTipoConsulta] = useState<"imediata" | "agendada">("imediata");
```

Função `fetchProfile` atualizada para buscar CPF de múltiplas fontes:
1. Tabela `profiles` (coluna `cpf`)
2. `user_metadata` do Supabase Auth
3. `identity_data` do Supabase (para login social)

## 🔧 Correção de Banco de Dados

A tabela `profiles` pode não ter a coluna `cpf`. O sistema agora busca o CPF de:
- `user_metadata.cpf` do Supabase Auth
- `identities[0].identity_data.cpf` para login social

Se nenhuma fonte tiver o CPF, o usuário será direcionado para completar o cadastro.

## ⚙️ Configurações

A URL base é configurável via variável de ambiente:
```env
VITE_TELEMEDICINA_IFRAME_URL=https://telemedicina.novitahomecare.com.br/
```

Valor padrão: `https://telemedicina.novitahomecare.com.br/`

## 🔐 Permissões do Iframe

```html
<iframe
  allow="camera; microphone; fullscreen; display-capture"
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
/>
```

## 🚀 Para Testar

1. Faça login no sistema Novità
2. Verifique se tem um plano ativo
3. Clique em "Consulta Imediata" ou "Agendar Consulta"
4. O sistema buscará o CPF automaticamente
5. O iframe white-label abrirá em tela cheia
6. Use o botão "X" ou "Fechar" para sair

## 📝 Notas Importantes

- O token expira após tempo definido pela API Assemed
- O paciente é automaticamente cadastrado se não existir
- O iframe requer permissões de câmera/microfone do navegador
- A plataforma white-label deve suportar autenticação via token na URL
- Compatível com navegadores modernos (Chrome, Firefox, Safari, Edge)
- O sistema tolera ausência da coluna `cpf` na tabela `profiles`

## 🔗 Links Úteis

- **Plataforma White-Label:** https://telemedicina.novitahomecare.com.br/
- **API Assemed Homologação:** https://dev-api-assemed.azurewebsites.net
- **API Assemed Produção:** https://api.assemedtelemedicina.com
