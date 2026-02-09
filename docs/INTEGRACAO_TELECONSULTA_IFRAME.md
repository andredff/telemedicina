# Integração da Teleconsulta Assemed com Iframe

## 📋 Resumo

Foi implementada a funcionalidade de abrir o iframe da plataforma Assemed (`https://telemedicina.novitahomecare.com.br/`) dentro do dashboard, já autenticado com o usuário do projeto.

## 🎯 Componentes Criados

### 1. `TelemedConsultationFrame`
**Localização:** `src/components/telemedicine/TelemedConsultationFrame.tsx`

Componente principal que gerencia:
- ✅ Autenticação automática com token do paciente
- ✅ Carregamento da URL da sala de espera
- ✅ Polling automático para verificar status da consulta (a cada 10s)
- ✅ Fechamento automático quando consulta finaliza
- ✅ Exibição de erros e estados de loading
- ✅ Botão para fechar manualmente

### 2. Integração no Dashboard
**Localização:** `src/pages/Dashboard.tsx`

Foi adicionado estado para gerenciar consultas ativas:
```typescript
const [activeConsultationId, setActiveConsultationId] = useState<number | null>(null);
```

## 🔧 Como Usar

### Exemplo 1: Abrir teleconsulta de uma consulta existente

```typescript
// Em qualquer componente que liste consultas
<Button onClick={() => setActiveConsultationId(consulta.id)}>
  <Video className="h-4 w-4" />
  Entrar na Consulta
</Button>
```

### Exemplo 2: Criar e abrir nova consulta

```typescript
const handleStartConsultation = async () => {
  try {
    // 1. Criar nova consulta
    const consultation = await assemedClient.createConsultation({
      tipoProfissional: 1, // Médico
      especialidadeId: 8, // Clínico Geral
      pacienteId: decodedToken.pacienteId,
    });

    // 2. Abrir iframe
    setActiveConsultationId(consultation.id);
  } catch (error) {
    console.error("Erro ao criar consulta:", error);
  }
};
```

## 📡 Fluxo Completo

```
1. Usuário clica para entrar na consulta
   ↓
2. TelemedConsultationFrame carrega
   ↓
3. Verifica token de autenticação
   ↓
4. Busca detalhes da consulta via API
   ↓
5. Monta URL: {appUrl}/sala-espera-externa/{id}?token={token}
   ↓
6. Exibe iframe em tela cheia
   ↓
7. Polling verifica status a cada 10s
   ↓
8. Quando CONCLUIDO/CANCELADO → fecha automaticamente
```

## 🌐 URLs por Ambiente

**Produção:**
```
https://app.assemedtelemedicina.com/sala-espera-externa/{id}?token={token}
```

**Homologação:**
```
https://dev-app-assemed.azurewebsites.net/sala-espera-externa/{id}?token={token}
```

## 🔐 Autenticação

O token usado no iframe é o `accessToken` obtido no login via:
```typescript
const response = await assemedClient.login(cpfPaciente);
// response.accessToken é usado automaticamente
```

## ⚙️ Configurações

As URLs são gerenciadas em `src/integrations/assemed/config.ts`:

```typescript
export function getWaitingRoomUrl(
  atendimentoId: number,
  pacienteToken: string,
  isSandbox: boolean
): string
```

## 📦 Dependências

- `assemedClient` - Cliente da API Assemed
- `TelemedicineIframe` - Componente de iframe reutilizável
- `getWaitingRoomUrl` - Helper para montar URL correta

## 🎨 Recursos Visuais

- Loading spinner durante carregamento
- Header com status da consulta
- Botão de fechar vermelho
- Alert quando consulta finaliza
- Fullscreen automático
- Permissões para câmera/microfone

## 🔄 Status Possíveis

- `AGUARDANDO` - Aguardando médico
- `EM_ATENDIMENTO` - Consulta em andamento
- `CONCLUIDO` - Consulta finalizada
- `CANCELADO` - Consulta cancelada

## 🚀 Para Testar

1. Faça login no sistema
2. Crie uma consulta ou entre em uma existente
3. O iframe abrirá em tela cheia
4. Use `setActiveConsultationId(null)` para fechar manualmente
5. Ou aguarde a consulta ser finalizada (fechamento automático)

## 📝 Notas Importantes

- O token expira após tempo definido pela API
- Consultas finalizadas não podem ser reabertas
- O polling consome recursos - é cancelado ao desmontar
- Iframe requer permissões de câmera/microfone do navegador
