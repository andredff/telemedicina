# Especificação Técnica — Módulo de Videochamada Própria (Novità Telemedicina)

---

## 1. Visão Geral da Solução

A plataforma substituirá a integração externa por um módulo proprietário de videochamada baseado em **WebRTC peer-to-peer**, com signaling gerenciado via **Supabase Realtime Broadcast** no MVP e migração para **Socket.io** na fase de escala.

A chamada acontece diretamente entre o navegador do paciente e o navegador do médico — a mídia (áudio e vídeo) trafega P2P sem passar por nenhum servidor de mídia, exceto quando o NAT bloqueia a conexão direta (cenário que o TURN resolve).

```
Paciente ──── ICE/WebRTC ────► Médico
     │                           │
     └── Signaling (Supabase) ───┘
     └── STUN (Google) ──────────┘
     └── TURN (Metered.ca) ──────┘
```

**Stack:**
- Frontend: React + TypeScript (já existente)
- Signaling MVP: Supabase Realtime Broadcast
- Signaling produção: Node.js + Socket.io (estende o `cielo-server.js` existente)
- STUN: `stun.l.google.com:19302` (gratuito)
- TURN: Metered.ca (free tier → pago conforme demanda)
- Banco: Supabase (PostgreSQL — novas tabelas)
- Auth: JWT Supabase já existente

---

## 2. Fluxo do Paciente

```
[Wizard] → [Pagamento/Triagem] → [Preparação] → [Sala de Espera] → [Chamada] → [Pós-consulta]
```

**Passo a passo:**

1. **Wizard finaliza** → consulta criada com `status = waiting_patient`
2. Paciente chega na **tela de preparação** `/consulta/:id/preparacao`
   - Verifica se navegador suporta WebRTC
   - Solicita permissão de câmera e microfone (`getUserMedia`)
   - Exibe preview local da câmera
   - Testa microfone com medidor de volume
3. Paciente clica **"Estou pronto"** → status → `waiting_doctor`
   - Supabase atualiza `consultation_rooms.status`
   - Paciente cria `RTCPeerConnection` mas ainda não envia offer
   - Entra na sala de espera com contagem de tempo
4. **Sala de espera** — paciente aguarda sinal do médico
   - Escuta evento `doctor-ready` via Realtime
   - Exibe animação de aguardo + nome do médico
5. **Médico inicia** → evento `call-offer` chega no paciente
   - Paciente recebe offer → cria answer → envia
   - ICE candidates são trocados
   - Conexão P2P estabelecida → `status = in_progress`
6. **Tela da videochamada** ativa
   - Vídeo remoto do médico + próprio vídeo (PiP)
   - Controles: mudo, câmera off, encerrar
7. **Encerramento** — médico finaliza ou paciente sai
   - `call-ended` chega → status → `finished`
   - Paciente vê tela de "Consulta encerrada"
   - Link para ver prescrições/documentos

---

## 3. Fluxo do Médico

**Passo a passo:**

1. Médico acessa **Sala de Espera** (`/medico/sala-espera`)
   - Lista consultas com `status = waiting_patient` ou `waiting_doctor`
   - Badge com contagem em tempo real via Supabase Realtime
2. **Card da consulta** mostra:
   - Nome do paciente + tempo de espera
   - Status de câmera/microfone do paciente
   - Botão **"Entrar na Consulta"**
3. Médico clica → **tela de preparação do médico** `/medico/atendimento/:id`
   - Preview da câmera do médico
   - Verificação de dispositivos
   - Carrega dados do paciente (anamnese prévia, histórico)
4. Médico clica **"Iniciar Videochamada"**
   - Entra no canal Realtime da consulta
   - `doctor-ready` enviado ao paciente
   - Cria `RTCPeerConnection` → gera offer → envia via signaling
5. **Tela da videochamada** do médico ativa
   - Vídeo do paciente + próprio vídeo (PiP)
   - Painel lateral retrátil com dados do paciente
   - Controles: mudo, câmera, encerrar, abrir prontuário
6. **Finalizar consulta** → modal de confirmação
   - `call-ended` enviado ao paciente
   - Status → `finished`
   - Redirecionamento para `MedicoAtendimento` com tabs (Receita, Exames, Atestado)

---

## 4. Estados da Consulta

| Status | Quando usar |
|--------|-------------|
| `created` | Consulta criada no wizard, pagamento ainda não confirmado ou paciente ainda não entrou no fluxo de vídeo |
| `waiting_patient` | Consulta pronta, aguardando paciente entrar na sala e liberar câmera/mic |
| `waiting_doctor` | Paciente já está na sala de espera, câmera liberada, aguardando médico |
| `ready` | Ambos na sala, conexão em estabelecimento (ICE negotiation) |
| `in_progress` | Videochamada ativa — P2P conectado, mídia fluindo |
| `paused` | Conexão momentaneamente interrompida, sistema aguardando reconexão (timeout: 60s) |
| `finished` | Médico encerrou formalmente o atendimento |
| `cancelled` | Cancelado antes de iniciar (por qualquer parte ou administrativamente) |
| `expired` | Ninguém entrou dentro do prazo (ex: 30 min após `waiting_patient`) |
| `connection_lost` | Pausa excedeu o timeout sem reconexão — encerrado automaticamente |

**Transições válidas:**

```
created → waiting_patient → waiting_doctor → ready → in_progress
in_progress → paused → in_progress (reconexão)
in_progress → finished
in_progress → connection_lost
paused → connection_lost (timeout)
waiting_* → expired (timeout)
any → cancelled (ação administrativa)
```

---

## 5. Arquitetura Técnica

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────────────┐      │
│  │   Paciente SPA   │         │      Médico SPA           │      │
│  │  (React + TS)    │         │    (React + TS)           │      │
│  │                  │         │                           │      │
│  │ - WaitingRoom    │         │ - SalaEspera              │      │
│  │ - VideoCall      │         │ - VideoCall               │      │
│  │ - useWebRTC hook │         │ - useWebRTC hook          │      │
│  │ - useSignaling   │         │ - useSignaling            │      │
│  └────────┬─────────┘         └───────────┬───────────────┘      │
│           │                               │                       │
│           └────────── WebRTC P2P ─────────┘ (mídia direta)       │
│           │                               │                       │
└───────────┼───────────────────────────────┼─────────────────────┘
            │                               │
            ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SIGNALING (MVP: Supabase Realtime)            │
│             channel: `consultation:${consultation_id}`           │
│                                                                  │
│  Eventos: offer, answer, ice-candidate, user-joined,             │
│           call-started, call-ended, status-changed               │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    SUPABASE (Backend)                            │
│                                                                  │
│  PostgreSQL: consultation_rooms, call_events, call_logs          │
│  Auth: JWT (médico e paciente autenticados)                      │
│  RLS: políticas por user_id e role                               │
│  Edge Functions: criar sala, validar acesso, finalizar           │
└──────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    ICE / NAT TRAVERSAL                           │
│  STUN: stun.l.google.com:19302                                   │
│  TURN: turn.metered.ca (TLS 443 — funciona em redes restritas)   │
└──────────────────────────────────────────────────────────────────┘
```

**Responsabilidades por camada:**

| Camada | Responsabilidade |
|--------|-----------------|
| Frontend Paciente | Captura mídia, lida com WebRTC, exibe vídeo, sala de espera |
| Frontend Médico | Inicia chamada (cria offer), controles, painel pós-consulta |
| Supabase Realtime | Roteamento de mensagens de signaling entre os dois peers |
| Supabase DB | Persistência de status, eventos e logs da consulta |
| Supabase Edge Functions | Lógica de negócio: criar sala, validar token, finalizar |
| STUN | Descoberta de endereço IP público do peer |
| TURN | Relay de mídia quando conexão P2P direta falha |

---

## 6. WebRTC — Implementação

### 6.1 Configuração ICE

```typescript
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:turn.metered.ca:443?transport=tcp',
    username: process.env.VITE_TURN_USERNAME,
    credential: process.env.VITE_TURN_CREDENTIAL,
  },
];
```

### 6.2 Hook `useWebRTC`

```typescript
interface UseWebRTCOptions {
  consultationId: string;
  role: 'doctor' | 'patient';
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
}

function useWebRTC(options: UseWebRTCOptions) {
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  // 1. Captura de mídia
  const startMedia = async (video = true, audio = true) => {
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
    localStream.current = stream;
    return stream;
  };

  // 2. Criar peer connection
  const createPeerConnection = () => {
    pc.current = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    localStream.current?.getTracks().forEach(track => {
      pc.current!.addTrack(track, localStream.current!);
    });

    pc.current.ontrack = (event) => {
      options.onRemoteStream(event.streams[0]);
    };

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.send('ice-candidate', event.candidate.toJSON());
      }
    };

    pc.current.onconnectionstatechange = () => {
      options.onConnectionStateChange(pc.current!.connectionState);
    };

    pc.current.oniceconnectionstatechange = () => {
      if (pc.current?.iceConnectionState === 'failed') {
        pc.current.restartIce();
      }
    };
  };

  // 3. Doctor cria offer
  const createOffer = async () => {
    const offer = await pc.current!.createOffer();
    await pc.current!.setLocalDescription(offer);
    return offer;
  };

  // 4. Patient cria answer
  const createAnswer = async (offer: RTCSessionDescriptionInit) => {
    await pc.current!.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.current!.createAnswer();
    await pc.current!.setLocalDescription(answer);
    return answer;
  };

  // 5. Adicionar ICE candidate remoto
  const addIceCandidate = async (candidate: RTCIceCandidateInit) => {
    await pc.current?.addIceCandidate(new RTCIceCandidate(candidate));
  };

  // 6. Controles de mídia
  const toggleAudio = (enabled: boolean) => {
    localStream.current?.getAudioTracks().forEach(t => (t.enabled = enabled));
  };

  const toggleVideo = (enabled: boolean) => {
    localStream.current?.getVideoTracks().forEach(t => (t.enabled = enabled));
  };

  // 7. Encerrar
  const closeConnection = () => {
    pc.current?.close();
    localStream.current?.getTracks().forEach(t => t.stop());
    pc.current = null;
    localStream.current = null;
  };

  return { startMedia, createPeerConnection, createOffer, createAnswer,
           addIceCandidate, toggleAudio, toggleVideo, closeConnection };
}
```

### 6.3 Reconexão

```typescript
// Detectar falha e tentar reconectar
pc.current.onconnectionstatechange = () => {
  const state = pc.current!.connectionState;

  if (state === 'disconnected' || state === 'failed') {
    updateConsultationStatus('paused');
    scheduleReconnect();
  }

  if (state === 'connected') {
    updateConsultationStatus('in_progress');
    cancelReconnect();
  }
};

function scheduleReconnect() {
  let attempts = 0;
  const timer = setInterval(async () => {
    attempts++;
    if (attempts > 6) { // 60s (6 × 10s)
      clearInterval(timer);
      updateConsultationStatus('connection_lost');
      return;
    }
    try {
      await pc.current?.restartIce();
    } catch {
      // force full renegotiation on next attempt
    }
  }, 10_000);
}
```

---

## 7. Signaling — Eventos WebSocket

### Arquitetura de Canais (Supabase Realtime Broadcast)

Cada consulta usa um canal dedicado: **`consultation:{consultation_id}`**

Todos os eventos têm o campo `sender_role` (`doctor` | `patient`) e são autenticados pelo JWT Supabase do usuário.

---

### Tabela de Eventos

| Evento | Quem dispara | Quem recebe | Quando usar |
|--------|-------------|-------------|-------------|
| `join-room` | Paciente / Médico | Ambos | Ao entrar na sala — notifica o outro peer |
| `patient-ready` | Paciente | Médico | Câmera/mic liberados, paciente na sala de espera |
| `doctor-ready` | Médico | Paciente | Médico entrou, vai iniciar chamada |
| `call-offer` | Médico | Paciente | Médico cria offer WebRTC |
| `call-answer` | Paciente | Médico | Paciente responde offer com answer |
| `ice-candidate` | Ambos | O outro peer | A cada ICE candidate gerado |
| `call-started` | Sistema (DB trigger) | Ambos | Conexão P2P estabelecida, status=in_progress |
| `call-ended` | Médico | Paciente | Médico finalizou o atendimento |
| `user-left` | Qualquer | O outro | Aba fechada / saiu da página |
| `connection-lost` | Sistema | Ambos | Timeout de pausa atingido |
| `reconnecting` | Qualquer | O outro | Peer tentando reconectar |
| `consultation-finished` | Médico | Paciente | Atendimento formal encerrado (pós assinatura) |
| `media-state` | Qualquer | O outro | Mudança de câmera/microfone (mudo, câmera off) |

---

### Payloads

**`join-room`**
```json
{
  "event": "join-room",
  "payload": {
    "consultation_id": "uuid",
    "user_id": "uuid",
    "role": "patient",
    "display_name": "Ana Paula"
  }
}
```

**`call-offer`**
```json
{
  "event": "call-offer",
  "payload": {
    "sdp": "v=0\r\no=...",
    "type": "offer"
  }
}
```

**`ice-candidate`**
```json
{
  "event": "ice-candidate",
  "payload": {
    "candidate": "candidate:...",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

**`media-state`**
```json
{
  "event": "media-state",
  "payload": {
    "audio": true,
    "video": false
  }
}
```

### Implementação do hook `useSignaling`

```typescript
function useSignaling(consultationId: string, userId: string) {
  const channel = useRef<RealtimeChannel | null>(null);
  const handlers = useRef<Map<string, (payload: unknown) => void>>(new Map());

  useEffect(() => {
    channel.current = supabase
      .channel(`consultation:${consultationId}`, {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: '*' }, ({ event, payload }) => {
        handlers.current.get(event)?.(payload);
      })
      .subscribe();

    return () => { channel.current?.unsubscribe(); };
  }, [consultationId]);

  const send = (event: string, payload: Record<string, unknown>) => {
    channel.current?.send({ type: 'broadcast', event, payload });
  };

  const on = (event: string, handler: (payload: unknown) => void) => {
    handlers.current.set(event, handler);
  };

  return { send, on };
}
```

---

## 8. Banco de Dados

### Novas tabelas (Supabase/PostgreSQL)

#### `consultation_rooms`
```sql
CREATE TABLE consultation_rooms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id     UUID NOT NULL REFERENCES prescriptions(id),
  patient_id          UUID NOT NULL REFERENCES profiles(id),
  doctor_id           UUID NOT NULL REFERENCES profiles(id),
  status              TEXT NOT NULL DEFAULT 'created'
                       CHECK (status IN ('created','waiting_patient','waiting_doctor',
                                         'ready','in_progress','paused','finished',
                                         'cancelled','expired','connection_lost')),
  room_token          TEXT UNIQUE,
  token_expires_at    TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  duration_seconds    INTEGER,
  end_reason          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

#### `consultation_participants`
```sql
CREATE TABLE consultation_participants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES consultation_rooms(id),
  user_id             UUID NOT NULL REFERENCES profiles(id),
  role                TEXT NOT NULL CHECK (role IN ('doctor', 'patient')),
  joined_at           TIMESTAMPTZ,
  left_at             TIMESTAMPTZ,
  connection_status   TEXT DEFAULT 'pending'
                       CHECK (connection_status IN ('pending','connected','reconnecting','disconnected')),
  media_audio         BOOLEAN DEFAULT TRUE,
  media_video         BOOLEAN DEFAULT TRUE,
  user_agent          TEXT,
  ip_address          TEXT
);
```

#### `consultation_events`
```sql
CREATE TABLE consultation_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES consultation_rooms(id),
  user_id             UUID REFERENCES profiles(id),
  event_type          TEXT NOT NULL,
  event_data          JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

#### `consultation_call_logs`
```sql
CREATE TABLE consultation_call_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES consultation_rooms(id),
  log_level           TEXT NOT NULL CHECK (log_level IN ('info','warn','error')),
  category            TEXT NOT NULL,
  message             TEXT NOT NULL,
  metadata            JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS Policies

```sql
-- Paciente só acessa sua própria sala
CREATE POLICY patient_room_access ON consultation_rooms
  FOR SELECT USING (patient_id = auth.uid());

-- Médico acessa salas vinculadas a ele
CREATE POLICY doctor_room_access ON consultation_rooms
  FOR SELECT USING (doctor_id = auth.uid());

-- Apenas o médico pode atualizar status (finalizar)
CREATE POLICY doctor_can_update ON consultation_rooms
  FOR UPDATE USING (doctor_id = auth.uid());
```

---

## 9. APIs Necessárias

Implementadas como **Supabase Edge Functions** (ou endpoints no `cielo-server.js` existente).

---

### `POST /api/consultations/:id/room`
- **Descrição:** Cria ou recupera a sala de videochamada de uma consulta
- **Auth:** JWT do médico (role = doctor)
- **Payload:** `{ consultation_id }`
- **Resposta:** `{ room_id, room_token, patient_id, status }`
- **Regra:** Cria sala se não existir; se existir e não estiver `finished`, retorna a atual

### `GET /api/consultations/:id/room`
- **Descrição:** Busca dados da sala
- **Auth:** JWT do paciente ou médico vinculados
- **Resposta:** `{ room_id, status, started_at, doctor_name, patient_name }`

### `POST /api/consultations/:id/room/validate-token`
- **Descrição:** Valida o `room_token` antes de entrar
- **Auth:** JWT do usuário
- **Payload:** `{ room_token }`
- **Resposta:** `{ valid: true, role, consultation_id }` ou `{ valid: false, reason }`

### `POST /api/consultations/:id/room/patient-ready`
- **Descrição:** Paciente sinalizou que está pronto (câmera liberada)
- **Auth:** JWT do paciente
- **Payload:** `{ media_audio, media_video }`
- **Resposta:** `{ status: 'waiting_doctor' }`
- **Efeito:** Atualiza `consultation_rooms.status`, registra evento

### `POST /api/consultations/:id/room/start`
- **Descrição:** Médico inicia chamada formalmente
- **Auth:** JWT do médico
- **Resposta:** `{ status: 'in_progress', started_at }`
- **Efeito:** Define `started_at`, dispara `call-started` via DB trigger → Realtime

### `POST /api/consultations/:id/room/finish`
- **Descrição:** Médico finaliza atendimento
- **Auth:** JWT do médico
- **Payload:** `{ end_reason }`
- **Resposta:** `{ status: 'finished', ended_at, duration_seconds }`
- **Efeito:** Calcula duração, atualiza `prescriptions.status = 'completed'`

### `POST /api/consultations/:id/room/event`
- **Descrição:** Registra evento da chamada (log)
- **Auth:** JWT do usuário
- **Payload:** `{ event_type, event_data }`
- **Resposta:** `{ id }`

### `GET /api/consultations/:id/room/history`
- **Descrição:** Histórico de eventos da consulta
- **Auth:** JWT do médico
- **Resposta:** Array de `consultation_events`

### `POST /api/consultations/expire-stale`
- **Descrição:** Job automático — expira consultas paradas
- **Auth:** Service role (CRON interno)
- **Lógica:** `waiting_patient` > 30min → `expired`; `paused` > 60s → `connection_lost`

---

## 10. Segurança

### Modelo de autorização

```
Médico:
  - Acessa apenas consultation_rooms onde doctor_id = auth.uid()
  - Pode criar offer, finalizar consulta, ver histórico

Paciente:
  - Acessa apenas consultation_rooms onde patient_id = auth.uid()
  - Não pode iniciar consulta — só responde o offer do médico

Regra adicional:
  - Dois médicos não podem ser atribuídos à mesma sala
  - Se médico diferente tentar abrir: retorna 403
```

### Room Token (JWT temporário)

```typescript
const roomToken = jwt.sign(
  {
    consultation_id: room.consultation_id,
    room_id: room.id,
    user_id: userId,
    role: userRole,
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hora
  },
  process.env.ROOM_TOKEN_SECRET
);
```

- Token expirado → usuário redirecionado para tela de erro
- Token válido apenas para o `user_id` e `room_id` específicos
- Nunca expor `ROOM_TOKEN_SECRET` no frontend (variável sem prefixo `VITE_`)

### Validação dos eventos WebSocket

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Unauthenticated');

const room = await supabase
  .from('consultation_rooms')
  .select('patient_id, doctor_id, status')
  .eq('id', consultationId)
  .single();

const isAuthorized =
  room.patient_id === user.id || room.doctor_id === user.id;

if (!isAuthorized) throw new Error('Forbidden');
```

### LGPD

- Não gravar chamadas sem consentimento explícito (out of scope do MVP)
- Não armazenar IP além do necessário para logs de acesso
- Logs de acesso com retenção de 90 dias
- Dados de saúde com acesso restrito por RLS

---

## 11. Interface do Paciente

### Telas e componentes

```
/consulta/:id/preparacao   → PreparacaoConsulta
/consulta/:id/espera       → SalaEsperaConsulta
/consulta/:id/chamada      → VideoChamadaPaciente
/consulta/:id/encerrada    → ConsultaEncerrada
```

**`PreparacaoConsulta`**
- Indicador de suporte a WebRTC no browser
- `CameraPreview` — vídeo local em tempo real
- `MicrophoneMeter` — medidor de volume (AnalyserNode)
- `DeviceSelector` — trocar câmera/microfone se múltiplos
- `PermissionGuide` — instrução se permissão negada
- Botão "Estou pronto" (disabled até câmera e mic OK)

**`SalaEsperaConsulta`**
- Nome e foto/iniciais do médico
- Mensagem animada "Aguardando o médico..."
- Contador de tempo de espera
- Próprio vídeo em miniatura (PiP preview)
- Botão "Cancelar" (com confirmação)
- Estado de reconexão se WebSocket cair

**`VideoChamadaPaciente`**
```
┌─────────────────────────────────────────┐
│          VÍDEO REMOTO (médico)           │
│                                          │
│                          ┌──────────────┐│
│                          │ próprio vídeo ││
│                          └──────────────┘│
│  ┌────────────────────────────────────┐  │
│  │  🎤  📷  ────────────  ❌ Encerrar │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```
- `VideoTile` (remoto + local)
- `CallControls` (toggle áudio, toggle vídeo, encerrar)
- `ConnectionQualityIndicator` (good/fair/poor)
- `ReconnectingOverlay` (quando `paused`)

**`ConsultaEncerrada`**
- Resumo da consulta (duração)
- Link para ver prescrições/exames/atestados
- Avaliação da consulta (NPS simples — opcional)

---

## 12. Interface do Médico

**Integração com `MedicoAtendimento` existente:**

O `MedicoAtendimento` já tem 5 tabs. Adiciona-se um **painel de vídeo retrátil** acima ou ao lado das tabs, sem substituir o fluxo atual.

```
┌────────────────────────────────────────────────────────────────┐
│ ← Voltar   Ana Paula Ferreira   [■ Encerrar Atendimento]       │
├────────────────────────────┬───────────────────────────────────┤
│                             │  Anamnese | Receita | Exames...  │
│  VÍDEO DO PACIENTE          │                                  │
│                             │  [conteúdo da tab ativa]        │
│       ┌─────┐               │                                  │
│       │ doc │ (PiP)         │                                  │
│       └─────┘               │                                  │
│  [🎤] [📷] [◁ ocultar]     │                                  │
└────────────────────────────┴───────────────────────────────────┘
```

**Componentes adicionais:**
- `DoctorVideoPanel` — painel retrátil com vídeo + controles
- `PatientStatusBadge` — indica se paciente tem câmera/mic ativos
- `StartCallButton` — botão proeminente quando `status = waiting_doctor`
- `FinishCallConfirmDialog` — confirma encerramento da chamada

**Estados visuais do botão no `MedicoAtendimento`:**

```
waiting_patient  → "Aguardando paciente entrar..." [disabled]
waiting_doctor   → "Iniciar Videochamada" [primary, pulsing]
ready            → "Conectando..." [loading]
in_progress      → Painel de vídeo ativo
finished         → "Consulta encerrada" [secondary]
```

---

## 13. Regras de Negócio

| # | Regra |
|---|-------|
| RN01 | Consulta só pode iniciar se ambos estiverem autenticados e vinculados à sala |
| RN02 | Médico cria o offer — paciente nunca cria offer |
| RN03 | Médico pode entrar na sala mesmo com paciente ainda aguardando (câmera ainda não liberada) |
| RN04 | `started_at` é registrado no momento do evento `call-started` (P2P conectado), não no clique do médico |
| RN05 | `ended_at` é registrado no momento do `call-ended` disparado pelo médico |
| RN06 | Se um peer cair, sala fica em `paused` por 60 segundos aguardando reconexão |
| RN07 | Se ninguém reconectar em 60s → `connection_lost` + notificação para ambos |
| RN08 | Consulta `finished` não pode ser reaberta — apenas admin pode alterar via tabela diretamente |
| RN09 | Um médico não pode abrir outra consulta enquanto há uma `in_progress` sem finalizar |
| RN10 | Paciente tentando acessar consulta de outro paciente → 403 |
| RN11 | Token de sala expira em 1 hora. Após expirar, gerar novo token via API |
| RN12 | Duração mínima registrável: 1 minuto |
| RN13 | Se paciente sair sem médico iniciar, status volta para `waiting_patient` |

---

## 14. Tratamento de Erros

| Cenário | Comportamento esperado |
|---------|----------------------|
| Paciente sem câmera | Detectado no `getUserMedia`, mostra tela de instrução, permite continuar só com áudio |
| Paciente sem microfone | Avisa que médico não vai ouvir |
| Permissão negada (browser) | Exibe guia visual de como habilitar nas configurações do browser (Chrome, Safari, Firefox) |
| Médico offline (não entrou) | Sala de espera exibe timeout progressivo. Após 15min: botão "Notificar médico" + oferecer reagendamento |
| WebSocket desconectado | Tentar reconectar Supabase Realtime a cada 5s por 60s. Exibir banner "Reconectando..." |
| Falha no TURN server | Tentar outras configurações ICE. Se TURN único falhar: "Rede bloqueada. Tente em outra conexão." |
| Internet instável | `pc.oniceconnectionstatechange === 'disconnected'` → `restartIce()` automático |
| Usuário fecha a aba | `beforeunload` → disparar `user-left`. O outro peer vê overlay "Conexão encerrada" |
| Dois médicos na mesma sala | API valida: se já tem `role='doctor'` com `left_at IS NULL` → retorna 409 Conflict |
| Consulta expirada | Token inválido ou `status = expired` → redireciona para tela "Consulta não disponível" |
| Token inválido | 401 na validação → redireciona para login |
| Browser sem WebRTC (Safari < 11) | Detectar com `!!window.RTCPeerConnection`. Exibir aviso de browser incompatível |
| `getUserMedia` sem HTTPS | WebRTC exige HTTPS. Em dev usar `localhost` (permitido) ou ngrok |

---

## 15. Monitoramento e Logs

### Eventos a registrar em `consultation_call_logs`

| Evento | Categoria | Nível |
|--------|-----------|-------|
| Paciente entrou na sala | `system` | `info` |
| Médico entrou na sala | `system` | `info` |
| Camera/mic liberados | `media` | `info` |
| Permissão de mídia negada | `media` | `warn` |
| Offer criado | `webrtc` | `info` |
| Answer criado | `webrtc` | `info` |
| ICE connected | `webrtc` | `info` |
| ICE failed | `webrtc` | `error` |
| `restartIce()` acionado | `webrtc` | `warn` |
| Reconexão bem-sucedida | `webrtc` | `info` |
| Chamada iniciada (`in_progress`) | `system` | `info` |
| Chamada pausada | `system` | `warn` |
| Chamada encerrada | `system` | `info` |
| `connection_lost` atingido | `system` | `error` |
| WebSocket reconectado | `websocket` | `warn` |
| WebSocket falha definitiva | `websocket` | `error` |
| Token inválido ou expirado | `auth` | `warn` |
| Acesso não autorizado bloqueado | `auth` | `error` |

### Métricas a calcular

- Taxa de chamadas completadas vs. `connection_lost`
- Duração média por consulta
- Taxa de reconexões por sessão
- Distribuição por browser/OS (user-agent)
- Tempo médio de espera até médico entrar

---

## 16. Cards de Desenvolvimento

---

### Card 01 — Mapear fluxo atual da consulta

**Título:** Mapeamento e diagnóstico do fluxo atual
**Objetivo:** Entender exatamente onde o wizard entrega o paciente para a videochamada e onde o médico recebe a consulta, para definir os pontos de integração.
**Tarefas:**
- [ ] Documentar rota do wizard passo a passo
- [ ] Identificar onde `prescription.status` é atualizado hoje
- [ ] Listar todos os componentes do MedicoAtendimento que precisam receber o vídeo
- [ ] Confirmar que não restam referências à integração externa

**Critérios de aceite:**
- Diagrama de fluxo antes/depois documentado
- Lista de pontos de integração definida
- Sem referências externas remanescentes

---

### Card 02 — Criar serviço de salas de videochamada

**Título:** Backend — criação e gestão de salas
**Objetivo:** Criar as tabelas e APIs que gerenciam o ciclo de vida da sala.
**Tarefas:**
- [ ] Migration: `consultation_rooms`, `consultation_participants`, `consultation_events`, `consultation_call_logs`
- [ ] Configurar RLS para cada tabela
- [ ] Edge Function: `POST /room` (criar/recuperar sala)
- [ ] Edge Function: `POST /room/finish`
- [ ] Edge Function: `POST /room/patient-ready`
- [ ] Gerar e validar `room_token` JWT
- [ ] CRON de expiração de salas inativas

**Critérios de aceite:**
- RLS testada: paciente não acessa sala de outro paciente
- Token expira após 1h
- Consulta `finished` não reabre via API

---

### Card 03 — Criar signaling via Supabase Realtime

**Título:** Signaling WebSocket com Supabase Realtime Broadcast
**Objetivo:** Criar o canal de comunicação em tempo real entre paciente e médico para troca de mensagens WebRTC.
**Tarefas:**
- [ ] Implementar `useSignaling` hook
- [ ] Mapear todos os eventos da seção 7
- [ ] Validar autenticação antes de processar evento
- [ ] Garantir que mensagens não sejam recebidas pelo próprio remetente (`self: false`)
- [ ] Implementar reconexão automática do canal

**Critérios de aceite:**
- Paciente envia `patient-ready` → médico recebe
- Médico envia `call-offer` → paciente recebe
- Canal reconecta após queda do WebSocket sem ação manual

---

### Card 04 — Implementar WebRTC no front-end

**Título:** Hook useWebRTC — core da videochamada
**Objetivo:** Implementar toda a lógica P2P de áudio e vídeo.
**Tarefas:**
- [ ] `useWebRTC` hook com todas as funções da seção 6
- [ ] Configurar ICE servers (STUN + TURN)
- [ ] Fluxo offer/answer correto (médico = caller, paciente = callee)
- [ ] Troca de ICE candidates
- [ ] `restartIce()` em caso de `disconnected`
- [ ] `toggleAudio` e `toggleVideo`
- [ ] Evento `media-state` sincronizado com o outro peer

**Critérios de aceite:**
- Chamada funciona em redes diferentes (4G × WiFi)
- Mute funciona e o outro peer vê indicador
- Reconexão automática após queda breve

---

### Card 05 — Criar sala de espera do paciente

**Título:** Frontend paciente — tela de preparação e espera
**Objetivo:** Implementar `PreparacaoConsulta` e `SalaEsperaConsulta`.
**Tarefas:**
- [ ] Detecção de suporte a WebRTC
- [ ] `getUserMedia` com tratamento de todos os erros de permissão
- [ ] `CameraPreview` com vídeo local
- [ ] `MicrophoneMeter` (Web Audio API)
- [ ] `DeviceSelector` (enumerateDevices)
- [ ] Lógica de espera com polling de status via Realtime
- [ ] Timeout de espera com mensagem adequada

**Critérios de aceite:**
- Fluxo funciona no Chrome, Firefox e Safari (iOS)
- Permissão negada mostra guia visual correto por browser
- Paciente não avança sem câmera ou microfone (ou confirma ciência)

---

### Card 06 — Criar tela de videochamada do paciente

**Título:** Frontend paciente — `VideoChamadaPaciente`
**Objetivo:** Tela completa da chamada com vídeo remoto, local e controles.
**Tarefas:**
- [ ] Layout fullscreen com vídeo remoto + PiP local
- [ ] `CallControls` (mute, camera, encerrar)
- [ ] Overlay "Reconectando..." para estado `paused`
- [ ] Handler de `call-ended` → redirecionar para `ConsultaEncerrada`
- [ ] Registrar início/fim nos logs

**Critérios de aceite:**
- Vídeo remoto aparece em ≤ 3s após conexão P2P
- PiP local não cobre área relevante
- Overlay de reconexão aparece em < 2s após queda

---

### Card 07 — Criar tela de videochamada do médico

**Título:** Frontend médico — `DoctorVideoPanel` no MedicoAtendimento
**Objetivo:** Integrar o painel de vídeo ao workspace existente sem quebrar as tabs.
**Tarefas:**
- [ ] `DoctorVideoPanel` — componente retrátil
- [ ] `StartCallButton` com estados por `status`
- [ ] Vídeo do paciente + PiP do médico
- [ ] Controles de mídia do médico
- [ ] Botão "Finalizar Consulta" com dialog de confirmação
- [ ] Ao finalizar: chamar API `/finish` e redirecionar para tabs

**Critérios de aceite:**
- Painel abre/fecha sem quebrar layout das tabs
- Finalizar consulta atualiza status no banco
- Médico consegue ver prontuário enquanto videochamada está ativa

---

### Card 08 — Integrar wizard com consulta online

**Título:** Integração ponto de entrada — wizard do paciente
**Objetivo:** Garantir que ao final do wizard o paciente seja redirecionado corretamente para a tela de preparação da consulta.
**Tarefas:**
- [ ] Identificar última etapa do wizard
- [ ] Redirecionar para `/consulta/:id/preparacao`
- [ ] Criar sala via API ao redirecionar
- [ ] Passar `room_token` seguro via estado da navegação (não URL)

**Critérios de aceite:**
- Fluxo completo sem interrupção
- Token não aparece na URL
- Sala criada antes de paciente chegar na tela

---

### Card 09 — Integrar área médica com consulta online

**Título:** Integração área do médico — Sala de Espera
**Objetivo:** Médico vê pacientes aguardando e entra com um clique.
**Tarefas:**
- [ ] Badge em tempo real na Sala de Espera (Supabase Realtime `consultation_rooms`)
- [ ] Card da consulta com status visual
- [ ] Navegação de "Chamar Paciente" → MedicoAtendimento com painel de vídeo
- [ ] Verificação de consulta já em andamento antes de abrir nova

**Critérios de aceite:**
- Badge atualiza em < 2s quando paciente entra
- RN09 aplicada: não permite abrir 2 consultas simultâneas

---

### Card 10 — Criar controle de status da consulta

**Título:** Máquina de estados da consulta
**Objetivo:** Garantir que todos os status da seção 4 sejam aplicados corretamente.
**Tarefas:**
- [ ] Definir transições válidas no backend (validar estado atual antes de atualizar)
- [ ] CRON: `waiting_patient` > 30min → `expired`
- [ ] CRON: `paused` > 60s → `connection_lost`
- [ ] Emitir evento Realtime a cada mudança de status (DB trigger ou Edge Function)

**Critérios de aceite:**
- Transição inválida retorna erro 409
- Consulta expira automaticamente sem ação humana
- Ambos os peers recebem mudança de status em < 1s

---

### Card 11 — Criar logs da chamada

**Título:** Observabilidade — `consultation_call_logs`
**Objetivo:** Registrar todos os eventos relevantes para debugging e métricas.
**Tarefas:**
- [ ] Função `logCallEvent(roomId, category, level, message, metadata)` reutilizável
- [ ] Integrar nos hooks de WebRTC e signaling
- [ ] Dashboard admin simples para visualizar logs por consulta

**Critérios de aceite:**
- Toda chamada tem ao menos: joined, media-ok, call-started, call-ended
- Falhas de ICE são logadas com detalhe
- Admin consegue ver histórico completo de uma consulta

---

### Card 12 — Criar tratamento de erros

**Título:** UX de erros e fallbacks
**Objetivo:** Nenhum erro deixa o usuário em tela branca.
**Tarefas:**
- [ ] `ErrorBoundary` na VideoCall
- [ ] Mensagens amigáveis por tipo de erro (seção 14)
- [ ] Guia de permissão por browser (Chrome/Firefox/Safari/iOS)
- [ ] Botão "Tentar novamente" em todos os estados de erro

**Critérios de aceite:**
- Permissão negada → instrução clara, sem crash
- Token expirado → tela amigável com botão para solicitar novo acesso
- Nenhum erro expõe stack trace ao usuário

---

### Card 13 — Criar testes do fluxo completo

**Título:** Testes de integração — ponta a ponta
**Objetivo:** Garantir que o fluxo completo funciona em cenários reais.
**Tarefas:**
- [ ] Teste: paciente e médico em abas diferentes do mesmo browser
- [ ] Teste: redes diferentes (4G × WiFi)
- [ ] Teste: queda de conexão e reconexão
- [ ] Teste: encerramento pelo médico
- [ ] Teste: timeout de sala de espera
- [ ] Teste: permissão negada de câmera
- [ ] Teste: iOS Safari

**Critérios de aceite:**
- 100% dos cenários acima documentados e passando
- Sem vazamentos de stream (câmera desliga ao sair)

---

### Card 14 — Preparar ambiente de STUN/TURN

**Título:** Infraestrutura ICE — STUN/TURN
**Objetivo:** Garantir conectividade P2P em redes restritas.
**Tarefas:**
- [ ] Configurar credenciais Metered.ca (free tier)
- [ ] Variáveis de ambiente: `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL`
- [ ] Testar com Chrome WebRTC internals
- [ ] Plano de upgrade para tier pago conforme crescimento

**Critérios de aceite:**
- Chamada funciona quando paciente está em rede corporativa (firewall restritivo)
- TURN TLS na porta 443 funcional

---

### Card 15 — Validar segurança e autorização

**Título:** Auditoria de segurança do módulo
**Objetivo:** Garantir que nenhum usuário acessa dados ou sala de outro.
**Tarefas:**
- [ ] Teste de RLS: paciente A tenta acessar sala do paciente B → bloqueado
- [ ] Teste: médico B tenta abrir consulta do médico A → bloqueado
- [ ] Verificar que `room_token` não aparece em URL ou logs do browser
- [ ] Verificar que credenciais TURN não são expostas em bundle
- [ ] Revisar `Content-Security-Policy` para câmera/microfone

**Critérios de aceite:**
- Zero possibilidade de acesso cruzado entre consultas
- Credenciais sensíveis nunca no bundle de produção

---

## 17. Ordem Recomendada de Implementação

### Fase 1 — MVP Funcional (2–3 semanas)

> Objetivo: médico e paciente conseguem fazer uma videochamada.

1. Card 14 — Configurar STUN/TURN
2. Card 02 — Criar tabelas e APIs de sala (migration + RLS básica)
3. Card 03 — Signaling com Supabase Realtime
4. Card 04 — Hook `useWebRTC`
5. Card 06 — Tela de videochamada do paciente (básica)
6. Card 07 — Painel de vídeo do médico (básico)
7. Teste manual: chamada ponta a ponta em localhost

### Fase 2 — Integração com Fluxo Real (1–2 semanas)

> Objetivo: fluxo completo sem passos manuais.

8. Card 01 — Mapear e confirmar pontos de integração
9. Card 05 — Tela de preparação e sala de espera do paciente
10. Card 08 — Integrar wizard → consulta
11. Card 09 — Integrar Sala de Espera do médico
12. Card 10 — Máquina de estados completa

### Fase 3 — Segurança, Logs e Estabilidade (1 semana)

> Objetivo: produção sem surpresas.

13. Card 11 — Logs e observabilidade
14. Card 12 — Tratamento de erros completo
15. Card 15 — Auditoria de segurança
16. Card 13 — Testes de integração completos

### Fase 4 — Melhorias e Escala (ongoing)

- Migrar signaling de Supabase Realtime para Socket.io dedicado (se volume exigir)
- Certificado digital (integração ICP-Brasil)
- Gravação da consulta (com LGPD — consent explícito)
- Compartilhamento de tela
- Chat textual durante a chamada
- Dashboard de métricas (tempo médio, taxa de falha)
- Mobile: PWA ou app nativo com `react-native-webrtc`

---

## 18. MVP — Escopo Exato

O MVP entregável é a versão mínima que valida a solução proprietária em produção.

**Inclui:**
- [x] Paciente entra na sala, libera câmera e microfone
- [x] Médico vê paciente esperando na Sala de Espera
- [x] Médico clica "Iniciar" → videochamada abre
- [x] Áudio e vídeo bidirecional funcionando
- [x] Mudo e câmera off para ambos
- [x] Médico encerra → `status = finished` salvo
- [x] Paciente é redirecionado para tela de encerramento
- [x] Logs básicos de início e fim registrados
- [x] Funciona em Chrome e Edge (desktop)
- [x] Funciona em redes diferentes com TURN

**Não inclui no MVP:**
- [ ] Gravação
- [ ] Compartilhamento de tela
- [ ] Safari/iOS (segunda fase)
- [ ] Chat textual
- [ ] Certificado digital
- [ ] Dashboard de métricas

---

## 19. Pontos de Atenção

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **TURN obrigatório** em redes corporativas e mobile | Alto — sem TURN, ~20% das chamadas falham | Usar Metered.ca desde o início, nunca confiar só no STUN |
| **Safari/iOS** tem restrições de `getUserMedia` | Alto — base mobile significativa | Testar no iPhone real na Fase 2. Exige HTTPS válido, não aceita `localhost` |
| **Supabase Realtime** pode ter latência em ICE candidates | Médio — atraso no setup da chamada | Aceitar no MVP. Monitorar `time-to-connected`. Migrar se > 3s |
| **Escalabilidade do signaling** | Médio — Supabase Realtime tem limites | Planejar migração para Socket.io em ≥ 500 consultas/dia |
| **Permissões de browser** — usuários não sabem habilitar | Alto — abandono no onboarding | Guia visual por browser + fallback para "apenas áudio" |
| **LGPD** — dados de saúde na chamada | Alto — risco regulatório | Não gravar sem consentimento. Dados trafegam P2P cifrados (DTLS). Revisar política de privacidade |
| **Dois tabs abertos pelo mesmo usuário** | Médio — conflito de ICE | Detectar via `consultation_participants` + `beforeunload` |
| **Qualidade de vídeo em conexão ruim** | Médio — experiência ruim | Implementar `RTCRtpSender.setParameters` para ajuste de bitrate (Fase 4) |
| **Firewall corporativo bloqueia UDP** | Alto — TURN TCP/TLS 443 resolve | Garantir TURN com `transport=tcp` e porta 443 configurada |

---

## 20. Resultado Final Esperado

Ao final da implementação, a Novità terá um módulo proprietário de videochamada que funciona assim:

**Paciente:** acessa o wizard → completa triagem → chega na tela de preparação → libera câmera e microfone → entra na sala de espera → quando o médico inicia, a videochamada abre automaticamente → ao encerrar, vê o resumo e pode acessar prescrições e documentos — **tudo dentro da plataforma, sem abrir nenhuma janela ou serviço externo.**

**Médico:** acessa a Sala de Espera → vê o badge com paciente aguardando → clica em "Chamar Paciente" → entra no workspace do atendimento com o painel de vídeo ativo → pode atender o paciente enquanto consulta o prontuário e digita a anamnese na aba ao lado → finaliza a chamada → preenche receita, exames e atestado na mesma tela — **sem interrupção do fluxo clínico.**

A plataforma passa a ter:
- **Independência total de terceiros** para a jornada de consulta
- **Dados proprietários** de início, fim e duração de cada consulta
- **Rastreabilidade completa** via logs de eventos
- **Base para evolução** — gravação, IA clínica, prontuário eletrônico
