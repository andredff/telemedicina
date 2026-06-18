# Auditoria do Fluxo de Teleconsulta — Novità Telemedicina

**Data:** 10/06/2026 · **Escopo:** fluxo completo de videochamada (paciente ↔ médico), LGPD, segurança, eventos, QA
**Base da auditoria:** código-fonte real (`src/`, `supabase/migrations/`) — cada achado cita o arquivo-evidência.

---

## Sumário executivo

O fluxo funcional está maduro: fila em tempo real, aceite com proteção de corrida, WebRTC P2P com TURN opcional, teste de dispositivos pré-consulta, prontuário persistido no banco, documentos pós-consulta para o paciente, rejoin com "médico chamando". Porém, **o sistema não está pronto para produção com dados reais de saúde**. Existem 5 riscos críticos: sala de sinalização sem autorização, exames de pacientes em bucket público, ausência total de consentimento registrado, ausência total de trilha de auditoria e sala que nunca expira/bloqueia reentrada.

| Gravidade | Qtde | Resumo |
|---|---|---|
| Crítico | 5 | Sinalização aberta, bucket público, sem consentimento, sem auditoria, sala sem expiração |
| Alto | 7 | RLS ampla p/ médicos, docs assinados editáveis, CRM não validado, prontuário em localStorage, sem MFA/identidade, TURN estático, sem rate limit |
| Médio | 8 | Duas abas, XSS no print, no-show, drift de migrações, flag ativo em medicamentos, QoS sem telemetria, CSP, exposição de nome em toast |
| Baixo | 3 | Guards de rota, autoplay de áudio, acessibilidade da chamada |

---

## A) Mapa completo do fluxo (como está implementado)

### Jornada do paciente
```
/auth (email+senha, Supabase Auth)                       [src/pages/Auth.tsx]
  └─ /dashboard (PatientLayout: sidebar+topbar)          [src/components/layout/PatientLayout.tsx]
      └─ /teleconsultas                                  [src/pages/Teleconsultas.tsx]
          ├─ verifica plano (useSubscription) OU créditos (consultation_credits)
          ├─ ConsultaWizardModal: sintomas, sintoma principal, medicamentos em uso,
          │    upload de exames → bucket PÚBLICO `consulta-exames`   ⚠️ C2
          ├─ INSERT consultations {status:'pending', intake_data, number}  (sem consentimento) ⚠️ C3
          └─ /sala-espera/:id → redirect → /consulta/:id/preparacao
              └─ Preparação: teste câmera/mic + ajuda permissão     [PreparacaoConsulta.tsx]
                  └─ /consulta/:id/chamada                          [ConsultaPage.tsx]
                      ├─ join canal broadcast `consultation:<uuid>` (SEM autorização) ⚠️ C1
                      ├─ envia patient-ready · estado: setup→waiting→connecting→in_call
                      ├─ in_call: vídeo + PiP, chat efêmero, painel info, qualidade (getStats)
                      ├─ cancelar na espera → status cancelled + crédito restaurado
                      └─ ended → "Consulta encerrada" (sem pesquisa de satisfação) 
          └─ pós-consulta: /consulta/:id/detalhes (clinical_data: receita/exames/atestado) 
```

### Jornada do médico
```
/auth → /medico (MedicoLayout, role=doctor via profiles.role)
  └─ /medico/sala-espera                                  [MedicoSalaEspera.tsx]
      ├─ fila pending via Realtime postgres_changes + som (playNotificationSound)
      └─ "Chamar Paciente": UPDATE status pending→in_progress (.eq status='pending' = anti-corrida ✅)
          └─ /medico/atendimento/:id?autostart=1          [MedicoAtendimento.tsx]
              ├─ DoctorVideoPanel flutuante (offer WebRTC, chat, tela cheia c/ coluna Info)
              ├─ bump doctor_calling_at ao (re)abrir vídeo → ring no paciente ✅
              ├─ Prontuário: Anamnese (com intake do paciente), Receita (combobox
              │    medication_catalog), Exames, Atestado, Assinatura (DEMO ⚠️ A2)
              ├─ clinical_data: debounce 800ms → consultations + localStorage ⚠️ A4
              └─ Finalizar → status completed + clinical_data
  └─ consultas finalizadas: reabrir e EDITAR sem versão/trava ⚠️ A2
```

### Sinalização e mídia
- Canal: Supabase Realtime broadcast `consultation:<id>`, `self:false` [src/hooks/useSignaling.ts]
- Eventos: `call-offer`, `call-answer`, `ice-candidate`, `call-ended`, `media-state`, `patient-ready`, `doctor-ready`, `chat-message`
- Mídia: P2P, DTLS-SRTP (criptografia padrão do WebRTC ✅); STUN Google + TURN via `VITE_TURN_*` [src/hooks/useWebRTC.ts]
- Reconexão: `restartIce()` em falha ICE; paciente recarrega via tela "médico chamando"

---

## B) Checklist LGPD e compliance (status atual)

> Nota jurídica: a base legal LGPD para o ato assistencial é **tutela da saúde** (art. 11, II, "f") — não depende de consentimento LGPD. Porém a **Res. CFM 2.314/2022** exige consentimento livre e esclarecido específico para a modalidade telemedicina, e o registro desse aceite é obrigatório.

| # | Item | Status | Evidência / Lacuna |
|---|------|--------|--------------------|
| 1 | Consentimento informado registrado antes da teleconsulta | ❌ | Inexistente. Wizard cria consulta direto (`Teleconsultas.tsx handleWizardSubmit`). Nenhuma tabela de consentimento nas migrações |
| 2 | Política de privacidade acessível | ⚠️ | `/privacidade` existe (estática), mas não é apresentada/linkada no fluxo da consulta |
| 3 | Termos específicos de telemedicina | ❌ | Não existem |
| 4 | Versão do termo + data/hora/IP/user-agent do aceite | ❌ | Sem tabela, sem captura |
| 5 | Clareza sobre dados coletados/finalidade/retenção/compartilhamento | ❌ | Não comunicado no fluxo |
| 6 | Dados de saúde tratados como sensíveis (proteção reforçada) | ⚠️ | Em trânsito ✅ (HTTPS/WSS/DTLS-SRTP). Em repouso: Postgres gerenciado ✅, **mas exames em bucket público ❌ e prontuário em localStorage ❌** |
| 7 | Mínimo necessário (médico só vê o que precisa) | ⚠️ | RLS dá a QUALQUER médico SELECT/UPDATE em TODAS as consultas (`20260608010000_doctor_prescriptions_rls.sql`); sem `doctor_id` na consulta |
| 8 | Controle de acesso por perfil | ✅ | `profiles.role` (patient/doctor/admin/support/lab) + RLS + redirects RBAC |
| 9 | Logs de acesso a dados sensíveis | ❌ | Inexistentes (zero tabelas de auditoria) |
| 10 | Canal para direitos do titular (acesso/correção/exclusão) | ⚠️ | `/suporte` genérico; sem fluxo LGPD específico nem SLA |
| 11 | Isolamento entre pacientes | ✅* | RLS `user_id = auth.uid()` nas consultas. *Exceto URLs públicas de exames (item 6) |
| 12 | Criptografia em trânsito | ✅ | CloudFront HTTPS, Supabase TLS, WebRTC DTLS-SRTP |
| 13 | Gestão de incidentes | ❌ | Sem processo, sem detecção (sem logs) |
| 14 | Trilha de quem acessou/alterou/exportou dados médicos | ❌ | Inexistente |
| 15 | Gravação da consulta | ✅ | Não grava (nada de MediaRecorder no código). Se for gravar no futuro: consentimento explícito + retenção + acesso restrito |
| 16 | Retenção de prontuário | ⚠️ | Sem política. Referência: CFM Res. 1.821/2007 — mínimo 20 anos |

---

## C) Checklist técnico da videochamada

| # | Item | Status | Evidência |
|---|------|--------|-----------|
| 1 | HTTPS obrigatório | ✅ prod | CloudFront; getUserMedia exige secure context |
| 2 | Tokens de sala temporários e vinculados à consulta | ❌ | Não há token. "Sala" = nome de canal broadcast = UUID da consulta |
| 3 | Só participantes autorizados entram na sala | ❌ **CRÍTICO** | `useSignaling.ts` cria canal público. Qualquer portador do anon key (está no bundle JS) + UUID entra na sinalização: recebe offer/ICE, lê chat, pode responder a chamada |
| 4 | Sala inacessível por URL sem autenticação | ⚠️ | A página exige sessão p/ dados (RLS), mas a sinalização não valida nada (item 3) |
| 5 | Expiração da sala após finalização | ❌ | `ConsultaPage` não checa `status`: consulta `completed/cancelled` ainda permite entrar na "chamada" (liga câmera, junta canal) |
| 6 | Proteção contra reentrada indevida | ❌ | Mesma causa do item 5 |
| 7 | Controle de participantes (max 2, papéis) | ❌ | Presence existe (`track role`) mas nada valida/expulsa |
| 8 | Refresh da página | ✅ | Paciente: remonta → patient-ready → médico reoferece (`DoctorVideoPanel` handler patient-ready). Médico: `?autostart=1` persiste no refresh |
| 9 | Reconexão segura | ⚠️ | `restartIce()` ✅; rejoin via `doctor_calling_at` ✅; mas sem revalidação de status no rejoin |
| 10 | Logs de conexão sem conteúdo sensível | ❌ | Não há logs |
| 11 | STUN/TURN | ⚠️ | STUN Google ✅; TURN com credenciais **estáticas no bundle** (`VITE_TURN_*`) — abuso de infra possível; sem TURN configurado, NATs simétricos falham silenciosamente |
| 12 | Política de queda de conexão | ⚠️ | Estados disconnected/failed tratados na UI; sem timeout de no-show, sem registro do incidente |
| 13 | Fallback de câmera/microfone | ✅ | Preparação trata denied/unavailable com instruções por navegador; toggles na chamada |
| 14 | Monitoramento de qualidade | ⚠️ | `getStats()` (RTT + perda) só no client do paciente, não reportado a servidor |
| 15 | XSS no chat | ✅ | Mensagens renderizadas como texto React (escapado); sem `dangerouslySetInnerHTML` no fluxo |
| 16 | XSS em impressão de documentos | ⚠️ | `printDocument`/`consultaDraft.ts` interpolam strings sem sanitizar em `document.write` — DOMPurify já é dependência, usar |
| 17 | Rate limit em mensagens/eventos | ❌ | Nenhum app-level (somente default do Realtime) |
| 18 | Sanitização de campos textuais | ⚠️ | Inputs livres (anamnese, chat, intake) salvos crus; React protege exibição; print não (item 16) |
| 19 | IDOR consultas | ✅ DB / ❌ sinalização | RLS impede ler consulta alheia; canal de sinalização não (item 3); bucket público vaza exames por URL |
| 20 | Duas abas com a mesma consulta | ❌ | Ambas respondem à sinalização — comportamento indefinido (glare) |

---

## D) Matriz de eventos

**Hoje: nenhum evento é registrado.** Proposta de implementação: tabela `audit_events` (INSERT-only, RLS: ninguém lê exceto admin/auditoria; escrita via RPC `log_event()` SECURITY DEFINER) para classes AUD/SEC, e pipeline separado anonimizado para PROD (analytics).

**Payload-base comum (todos os eventos):**
```json
{
  "event_id": "uuid", "event_name": "string", "timestamp": "ISO-8601",
  "actor_id": "uuid", "actor_role": "patient|doctor|admin|system",
  "consultation_id": "uuid|null", "consultation_number": 1024,
  "session_id": "uuid", "device_type": "desktop|mobile|tablet",
  "browser": "string", "app_version": "string",
  "ip_hash": "sha256(ip+salt)", "status": "success|error", "error_code": "string|null"
}
```
**Proibido em QUALQUER evento de analytics (PROD):** nome do paciente, CPF, diagnóstico, CID, texto de anamnese, conteúdo de chat, nomes de medicamentos, URLs de exames. Em AUD, referenciar por IDs (`document_id`, `resource_id`) — nunca duplicar conteúdo clínico no log.

Classes: **AUD**=auditoria · **SEC**=segurança · **PROD**=produto/analytics · **OPS**=técnico.
Retenções: AUD clínica **20 anos** (acompanha prontuário, CFM 1.821) · SEC **5 anos** (mín. legal 6 meses, Marco Civil art. 15) · PROD **13 meses anonimizado** · OPS **90 dias**.

### Eventos do paciente
| Evento | Dispara quando | Classe | Payload extra | Ret. | Crit. |
|---|---|---|---|---|---|
| patient_login | Sessão criada (Auth.tsx) | SEC | `auth_method` | 5a | Alta |
| patient_join_waiting_room | Entra em estado waiting (ConsultaPage) | AUD+PROD | `wait_position?` | 20a/13m | Alta |
| patient_camera_permission_granted / denied | Resposta do getUserMedia (Preparação/Chamada) | OPS+PROD | `device:"camera"`, `error_name?` | 90d | Média |
| patient_microphone_permission_granted / denied | idem | OPS+PROD | `device:"mic"` | 90d | Média |
| patient_consent_viewed | Termo exibido (a implementar) | AUD | `term_id, term_version` | 20a | Alta |
| patient_consent_accepted | Aceite confirmado | AUD | `term_id, term_version, term_hash, user_agent` | 20a | **Crítica** |
| patient_consent_rejected | Recusa (bloqueia consulta) | AUD | `term_id, term_version` | 20a | Alta |
| patient_call_joined | PeerConnection conectada | AUD+OPS | `ice_type:"p2p|turn"` | 20a/90d | Alta |
| patient_call_left | Sai/encerra (handleEndCall/unmount) | AUD+OPS | `duration_s, reason:"user|error"` | 20a/90d | Alta |
| patient_call_reconnected | Rejoin pós-queda/ring | OPS | `gap_s` | 90d | Média |
| patient_call_connection_failed | state failed | OPS+SEC | `ice_state, rtt_ms, loss_pct` | 1a | Alta |
| patient_chat_message_sent | Envio no chat | AUD | `message_id, length` (NUNCA o texto em log) | 20a | Média |
| patient_document_viewed | Abre ConsultaDetalhes | AUD | `document_types:[...]` | 20a | Alta |
| patient_prescription_downloaded / exam_request_downloaded / certificate_downloaded | Imprimir/baixar (consultaDraft print*) | AUD | `document_id, document_type` | 20a | Alta |
| patient_consultation_finished | Recebe status completed | PROD | `duration_s` | 13m | Média |

### Eventos do médico
| Evento | Dispara quando | Classe | Payload extra | Ret. | Crit. |
|---|---|---|---|---|---|
| doctor_login | Sessão criada | SEC | `auth_method` | 5a | Alta |
| doctor_viewed_consultation_queue | Abre /medico/sala-espera | AUD | `queue_size` | 5a | Média |
| doctor_opened_consultation | Abre /medico/atendimento/:id | AUD | — (base já tem consultation_id) | 20a | **Crítica** — é acesso a dado sensível |
| doctor_accepted_consultation | UPDATE pending→in_progress OK | AUD+PROD | `wait_time_s` | 20a/13m | Alta |
| doctor_started_call / doctor_joined_call | Painel abre / PC conecta | AUD+OPS | `autostart:bool` | 20a/90d | Alta |
| doctor_left_call / doctor_reconnected_call | Fecha painel / reabre (doctor_calling_at) | AUD+OPS | `duration_s` | 20a/90d | Média |
| doctor_opened_anamnesis / doctor_updated_anamnesis | Aba aberta / debounce-save dispara | AUD | `fields_changed:["anamnese"]` (sem conteúdo) | 20a | Alta |
| doctor_searched_medication | Busca no combobox (MedicationCombobox) | PROD | `query_length, results_count` (sem a query) | 13m | Baixa |
| doctor_selected_medication | Seleciona item do catálogo | AUD | `catalog_item_id` | 20a | Média |
| doctor_created_prescription / exam_request / medical_certificate | Item adicionado ao draft persistido | AUD | `document_id, items_count` | 20a | **Crítica** |
| doctor_signed_prescription | handleSign | AUD | `document_id, signature_type:"demo|icp"` | 20a | **Crítica** |
| doctor_sent_chat_message | Envio no chat | AUD | `message_id, length` | 20a | Média |
| doctor_finished_consultation | handleFinish OK | AUD+PROD | `duration_s, docs:{rx,exam,cert}` (contagens) | 20a/13m | **Crítica** |

### Eventos administrativos / sistema
| Evento | Dispara quando | Classe | Payload extra | Ret. | Crit. |
|---|---|---|---|---|---|
| consultation_created | INSERT consultations | AUD+PROD | `origin:"plan|credit"`, `has_intake` | 20a/13m | Alta |
| consultation_scheduled / rescheduled | (futuro: especialistas) | AUD | `scheduled_at` | 20a | Média |
| consultation_cancelled | UPDATE → cancelled | AUD+PROD | `cancelled_by:"patient|doctor|system"`, `credit_restored` | 20a/13m | Alta |
| consultation_started / finished | pending→in_progress / →completed | AUD | `doctor_id` | 20a | Alta |
| consultation_expired | Timeout de fila (a implementar) | AUD+OPS | `waited_s` | 20a | Média |
| consultation_no_show_patient / no_show_doctor | Timeout sem join (a implementar) | AUD+PROD | `waited_s` | 20a | Alta |
| sensitive_data_viewed / updated | SELECT/UPDATE em prontuário fora do fluxo do atendimento | AUD | `resource_type, resource_id, fields` | 20a | **Crítica** |
| medical_document_created / signed / downloaded | CRUD de documento clínico | AUD | `document_id, type, version` | 20a | **Crítica** |
| access_denied | RLS nega / guard de rota bloqueia | SEC | `resource_type, resource_id` | 5a | Alta |
| unauthorized_room_access_attempt | Join de sinalização rejeitado (pós-fix C1) | SEC | `channel, presence_count` | 5a | **Crítica** |
| token_expired | Token de sala expirado (pós-fix) | SEC | `token_age_s` | 5a | Média |
| room_created / room_closed | 1º join / finalização ou expiração | AUD+OPS | `participants, duration_s` | 20a/90d | Alta |
| incident_connection_quality_low | RTT>600ms ou perda>12% por >30s (limiares já usados em ConsultaPage) | OPS | `rtt_ms, loss_pct, jitter_ms, turn:bool` | 90d | Média |

---

## E) Payloads recomendados (exemplos completos)

```json
{
  "event_name": "patient_consent_accepted",
  "event_id": "9c1e...","timestamp": "2026-06-10T14:03:22.412Z",
  "actor_id": "df809c9b-...", "actor_role": "patient",
  "consultation_id": null, "session_id": "a1b2...",
  "device_type": "mobile", "browser": "Chrome 126 Android",
  "ip_hash": "sha256:7f3a...", "status": "success",
  "term_id": "telemed-consent", "term_version": "2026-06-01.v3",
  "term_hash": "sha256:bb91...", "user_agent": "Mozilla/5.0 ..."
}
```
```json
{
  "event_name": "doctor_finished_consultation",
  "event_id": "55ab...","timestamp": "2026-06-10T14:41:09.001Z",
  "actor_id": "3c77...-doctor", "actor_role": "doctor",
  "consultation_id": "965e436e-...", "consultation_number": 1024,
  "session_id": "ff2e...", "device_type": "desktop", "browser": "Edge 125",
  "ip_hash": "sha256:1c9d...", "status": "success",
  "duration_s": 1260, "docs": { "prescriptions": 1, "exam_requests": 2, "certificates": 0 },
  "signed": true
}
```
```json
{
  "event_name": "incident_connection_quality_low",
  "event_id": "07da...","timestamp": "2026-06-10T14:25:40.330Z",
  "actor_id": "df809c9b-...", "actor_role": "patient",
  "consultation_id": "965e436e-...", "session_id": "a1b2...",
  "device_type": "mobile", "browser": "Safari 17 iOS",
  "ip_hash": "sha256:7f3a...", "status": "success",
  "rtt_ms": 740, "loss_pct": 14.2, "jitter_ms": 88, "turn": false, "window_s": 30
}
```
Anti-padrões (nunca enviar): `patient_name`, `cpf`, `cid`, `diagnosis`, `anamnese_text`, `chat_text`, `medication_names` (em PROD), `exam_file_url`.

---

## F) Cenários de teste QA

| # | Cenário | Passos | Resultado esperado | Estado atual |
|---|---------|--------|--------------------|--------------|
| 1 | Caminho feliz | Paciente cria consulta → preparação → espera; médico aceita → chamada conecta → chat → médico prescreve, assina, finaliza → paciente vê documentos | Tudo OK, eventos AUD gravados | ✅ funcional; ❌ sem eventos |
| 2 | Paciente sem câmera | Negar permissão na Preparação | Status "Bloqueado" + instruções por navegador; não avança | ✅ (PreparacaoConsulta trata denied/unavailable) |
| 3 | Paciente sem microfone | Sem mic físico | "Não encontrado"; orientar áudio alternativo | ⚠️ trata, mas "ok" do mic = permissão concedida, sem medidor de nível real |
| 4 | Médico sem câmera | Negar no painel | Toast "Erro ao acessar câmera", stage error | ✅ |
| 5 | Internet instável | Throttle no DevTools durante chamada | Indicador amarelo/vermelho, toast "Conexão instável", restartIce | ✅ UI; ❌ sem telemetria/incident |
| 6 | Paciente F5 na chamada | Refresh durante in_call | Remonta → patient-ready → médico reoferece → reconecta | ✅ |
| 7 | Médico F5 no atendimento | Refresh com ?autostart=1 | Painel reabre, re-oferece, paciente recebe ring | ✅ |
| 8 | IDOR paciente | Paciente A acessa /consulta/{id-de-B}/detalhes | RLS retorna vazio → "Consulta não encontrada" | ✅ DB. ⚠️ verificar tb /chamada (câmera liga antes do erro) |
| 9 | Médico fora da agenda | Médico acessa consulta de outro médico | Deveria negar | ❌ FALHA: RLS permite a qualquer doctor |
| 10 | Link da sala com terceiro | Usuário autenticado qualquer entra no canal `consultation:<uuid>` via console | Deveria ser rejeitado | ❌ FALHA CRÍTICA: canal aberto |
| 11 | Reentrada pós-finalização | Paciente abre /consulta/:id/chamada de consulta completed | Bloquear com mensagem | ❌ FALHA: entra em waiting, câmera liga |
| 12 | Termo LGPD recusado | Recusar consentimento | Consulta não criada; evento consent_rejected | ❌ N/A (fluxo não existe) |
| 13 | Chat com script | Enviar `<img src=x onerror=alert(1)>` | Renderiza como texto | ✅ (React escapa) |
| 14 | XSS via impressão | Medicamento/anamnese com `<script>` → Imprimir | Não executar | ❌ FALHA: document.write sem sanitização |
| 15 | Token expirado | Sessão Supabase expirada na chamada | Re-login transparente (autoRefreshToken) ou redirect /auth | ⚠️ refresh automático ✅; sem tratamento explícito de falha |
| 16 | Consulta cancelada durante espera | Paciente cancela na sala de espera | Status cancelled, crédito restaurado, médico vê item sumir da fila | ✅ |
| 17 | Médico não comparece | Paciente espera 30+ min | Timeout, aviso, opção cancelar c/ crédito, no_show_doctor | ❌ espera infinita |
| 18 | Paciente não comparece | Médico aceita, paciente nunca conecta | Timeout no painel, no_show_patient | ❌ "Aguardando..." infinito |
| 19 | Duas abas mesma consulta | Paciente abre /chamada em 2 abas | 2ª aba bloqueada ("consulta aberta em outra aba") | ❌ comportamento indefinido (glare de SDP) |
| 20 | Mobile Safari | Fluxo completo no iOS | playsInline ✅, autoplay com gesto, getUserMedia em HTTPS | ⚠️ código preparado (playsInline presente); exige teste real |
| 21 | Chrome Android / Desktop Chrome-Edge-Firefox | Fluxo completo | Funcional | ⚠️ exige matriz de teste real |

---

## G) Critérios de aceite funcionais

1. **Entrada do paciente:** dado paciente com plano/crédito e consentimento aceito, ao concluir o wizard a consulta é criada `pending` com `intake_data`, crédito consumido atomicamente, e ele chega à preparação em < 2s. Sem consentimento → bloqueado.
2. **Aceite do médico:** com N médicos clicando simultaneamente, exatamente 1 obtém a consulta (guard `.eq status='pending'`); os demais recebem "já atendido". `doctor_id`, `doctor_name`, `doctor_crm` reais são gravados (CRM válido obrigatório).
3. **Conexão:** com ambos prontos, mídia conecta em < 8s (P2P) ou < 12s (TURN); cada lado vê e ouve o outro; toggles refletem no remoto via `media-state`.
4. **Permissões:** negar câmera/mic nunca quebra a página; sempre há instrução de correção e retry.
5. **Sala de espera:** paciente vê tempo decorrido; pode cancelar (status+crédito); recebe ring sonoro+visual quando o médico chama; só entra em sala da PRÓPRIA consulta com status `pending|in_progress`.
6. **Chat:** entrega < 1s, escapado, com horário; mensagens registradas em auditoria por id/length; rate-limit ≥ 1 msg/seg burst 5.
7. **Queda/reconexão:** queda < 30s reconecta sozinha (restartIce); queda do paciente permite rejoin via ring; tudo gera evento OPS.
8. **Finalização:** apenas o médico finaliza; status `completed` + `clinical_data` numa única operação; sala encerra para ambos; reentrada bloqueada; documentos imediatamente visíveis ao paciente.
9. **Prescrição/exame/atestado:** criados a partir do catálogo (ou texto livre sinalizado), persistidos no banco, com `document_id`, trilha de auditoria e impressão sanitizada.
10. **Bloqueio pós-finalização:** documento assinado é imutável; edição gera nova versão com autor+timestamp+diff.
11. **Logs/eventos:** cada ação da matriz D gera exatamente 1 evento com payload-base completo; nenhum payload contém dados proibidos (teste automatizado de schema).
12. **Consentimento:** aceite registrado com versão+hash+ip_hash+user_agent ANTES do INSERT da consulta; recusa impede criação.
13. **Auditoria de acesso:** abrir prontuário/documentos por qualquer papel gera `sensitive_data_viewed`; relatório consultável por admin.

---

## H) Riscos classificados

### Críticos (bloqueiam produção com dados reais)
| ID | Risco | Impacto | Prob. | Evidência | Correção | Área |
|----|-------|---------|-------|-----------|----------|------|
| C1 | Canal de sinalização sem autorização: qualquer portador do anon key (público no bundle) + UUID entra em `consultation:<id>` — intercepta chat, recebe offer/ICE, pode atender a chamada | Vazamento de consulta médica em tempo real | Média | `useSignaling.ts` (canal broadcast sem `private`/RLS) | Habilitar **Realtime Authorization** (canais privados + policies em `realtime.messages` vinculando user↔consulta), ou token efêmero por participante validado em Edge Function | Backend/Infra |
| C2 | Exames de pacientes em bucket **público** (`consulta-exames`, `receitas`): URL = acesso permanente, sem autenticação | Exposição de dado sensível de saúde (LGPD art. 11; incidente notificável ANPD) | Alta | `20260608030000_consultation_clinical_data.sql` (`public=true`) | Buckets privados + signed URLs (TTL ≤ 1h) + policy de leitura por dono/médico da consulta; migrar objetos existentes | Backend |
| C3 | Inexistência de consentimento registrado (CFM 2.314/2022) e de termos de telemedicina | Infração regulatória CFM + fragilidade LGPD | Certa | grep: nenhum fluxo/tabela de consentimento | Step de consentimento no wizard + tabela `consent_records` (term_version, hash, timestamp, ip_hash, user_agent) + bloqueio sem aceite | Produto/Jurídico/Front |
| C4 | Zero trilha de auditoria (nenhum evento, nenhum log de acesso a prontuário) | Impossível investigar incidente, responder titular ou comprovar conformidade | Certa | Nenhuma migração de audit; nenhum tracking no código | Tabela `audit_events` insert-only + RPC `log_event` + instrumentar matriz D (fases: AUD crítica → SEC → PROD) | Backend |
| C5 | Sala nunca expira nem bloqueia reentrada: `/consulta/:id/chamada` não valida status | Reabertura de "sala" de consulta encerrada/cancelada; câmera ativa indevida | Alta | `ConsultaPage.tsx` setup() não lê `status` | Guard: só `pending|in_progress` + dono; pós-`completed` redirecionar p/ detalhes; equivalente no médico | Frontend/Backend |

### Altos
| ID | Risco | Correção | Área |
|----|-------|----------|------|
| A1 | RLS dá a qualquer médico acesso total a todas as consultas (sem `doctor_id`) — viola mínimo necessário pós-atribuição | Coluna `doctor_id`; policy: `pending` visível a médicos; atribuída → só o médico dela + admin; logar acesso | Backend |
| A2 | Documentos "assinados" continuam editáveis (edição pós-conclusão foi habilitada sem versionamento); assinatura é demo sem validade legal | Travar draft após `signed`; versionar (v2 com autor/timestamp); roadmap assinatura ICP-Brasil (Lei 14.063/2020 — receita digital exige certificado qualificado p/ validade em farmácias) | Produto/Backend |
| A3 | CRM não validado: `doctor_crm` de `user_metadata` com fallback vazio/placeholder ('CRM/SP 12345'); receitas podem sair sem CRM real | Cadastro de CRM/UF verificado (admin valida; integração CFM futura); bloquear emissão de documento sem CRM válido | Produto/Backend |
| A4 | Prontuário em `localStorage` (`novita_draft_*`) sem criptografia/expiração em máquina possivelmente compartilhada | Tornar o banco a única fonte (migrar MedicoPrescricoes/Exames/Atestados/Documentos p/ `clinical_data`); limpar localStorage no logout | Frontend |
| A5 | Identificação fraca: email+senha, sem MFA, sem verificação de identidade (CFM exige identificação de paciente e médico) | MFA (TOTP) p/ médicos obrigatório; verificação de CPF/dados no onboarding do paciente | Segurança |
| A6 | Credenciais TURN estáticas no bundle (`VITE_TURN_*`) | Credenciais efêmeras (coturn `use-auth-secret` via Edge Function) | Infra |
| A7 | Sem rate-limit em chat/sinalização e sem limites de tamanho de upload de exames | Limites app-level (msg/s, tamanho/aba MIME dos arquivos no bucket) | Backend |

### Médios
M1 Duas abas/glare → lock por `session_id` na presence. · M2 XSS no print (`document.write` sem DOMPurify — lib já instalada). · M3 No-show sem timeout (fila eterna; crédito preso). · M4 Migrações aplicadas manualmente = drift (já causou a falha de Realtime); adotar `supabase db push` em CI. · M5 `medication_catalog` sem flag ativo/inativo (regra de negócio). · M6 QoS sem telemetria server-side. · M7 Sem CSP/headers de segurança no CloudFront (mitiga roubo de sessão localStorage via XSS). · M8 Toast da fila expõe nome do paciente a qualquer médico logado (ok no modelo de fila aberta, mas registrar o acesso — depende de A1).

### Baixos
B1 `/consulta/*` sem redirect explícito de não autenticados (RLS protege, UX confusa). · B2 Autoplay de ringtone pode falhar antes do 1º gesto (já mitigado com unlock por interação). · B3 Acessibilidade da chamada (sem legendas/avisos não-sonoros).

---

## I) Backlog em cards técnicos

**CARD-01 · Autorização do canal de sinalização (P0)**
Descrição: migrar `consultation:<id>` para Supabase Realtime Authorization (canal privado) com policy em `realtime.messages`: somente `consultations.user_id` (paciente) e médico atribuído/role doctor podem ler/escrever; rejeitar 3º participante via presence count.
Aceite: usuário autenticado não-participante recebe erro ao `subscribe`; teste de QA #10 passa; evento `unauthorized_room_access_attempt` gravado.
Prioridade: P0 · Área: Backend/Infra · Dependências: CARD-04 (eventos) parcial · LGPD/Seg: encerra o vetor de interceptação de consulta.

**CARD-02 · Privatizar buckets de saúde (P0)**
Descrição: `consulta-exames` e `receitas` → `public=false`; leitura via `createSignedUrl` (TTL 1h) gerada sob policy (dono OU médico da consulta); migrar objetos e referências `intake_data.exames[].url` → path + assinatura on-demand.
Aceite: URL antiga retorna 403; paciente e médico da consulta seguem abrindo arquivos; terceiros não.
P0 · Backend · Dep: A1 (doctor_id) p/ policy fina · LGPD: elimina exposição pública de dado sensível.

**CARD-03 · Consentimento de telemedicina (P0)**
Descrição: step final do `ConsultaWizardModal` com termo versionado (markdown versionado em tabela `terms`); aceite grava em `consent_records {user_id, term_id, version, hash, accepted_at, ip_hash, user_agent}`; INSERT da consulta referencia `consent_id`; recusa bloqueia.
Aceite: consulta não é criada sem consent_id; registro auditável com versão+hash; QA #12 passa.
P0 · Produto/Jurídico/Frontend · Dep: texto jurídico do termo · LGPD/CFM: Res. 2.314/2022 art. 6º.

**CARD-04 · Trilha de auditoria (P0)**
Descrição: tabela `audit_events` (insert-only, particionada por mês) + RPC `log_event()` SECURITY DEFINER + helper front `logEvent()`; instrumentar fase 1 (eventos Críticos da matriz D: consent, opened_consultation, documentos, finished, room).
Aceite: caminho feliz gera ≥ 12 eventos corretos; payload sem campos proibidos (teste de schema); leitura restrita a admin.
P0 · Backend · LGPD: accountability art. 37.

**CARD-05 · Guard de status e expiração de sala (P0)**
Descrição: `ConsultaPage`/`DoctorVideoPanel` validam `status ∈ {pending,in_progress}` e titularidade antes de ligar mídia/sinalização; consulta `completed|cancelled` → redirect a detalhes; `room_closed` ao finalizar.
Aceite: QA #11 passa; reentrada pós-finalização impossível nos 2 lados.
P0 · Frontend · Dep: CARD-01.

**CARD-06 · doctor_id + RLS de mínimo necessário (P1)**
Descrição: coluna `doctor_id uuid` preenchida no aceite; policies: SELECT pending p/ role doctor; SELECT/UPDATE atribuída só p/ `doctor_id = auth.uid()` e admin; ajustar telas do médico (fila, consultas, histórico, pacientes) p/ filtrar pelas suas.
Aceite: QA #9 passa; médico B não abre consulta do médico A.
P1 · Backend/Frontend · LGPD: minimização art. 6º III.

**CARD-07 · Trava e versionamento de documentos assinados (P1)**
Descrição: `clinical_data.signed=true` torna draft read-only; "Editar" cria v+1 (array `versions[]` com autor, timestamp, snapshot) exigindo reassinatura; auditoria `medical_document_*`.
Aceite: tentativa de editar assinado sem nova versão é bloqueada na UI e no banco (trigger).
P1 · Backend/Frontend · Dep: CARD-04.

**CARD-08 · Validação de CRM (P1)**
Descrição: campos `crm`, `crm_uf`, `crm_verified` em profiles; tela admin de verificação; bloqueio de aceite de consulta/emissão de documento se `crm_verified=false`; remover fallback hardcoded.
Aceite: médico sem CRM verificado não consegue prescrever.
P1 · Produto/Backend · CFM: identificação do médico.

**CARD-09 · No-show e expiração de fila (P1)**
Descrição: job (pg_cron/Edge schedule): `pending` > 45min → `expired` + crédito restaurado + evento; médico aceitou e paciente não conectou em 10min → opção "encerrar por ausência" → `no_show_patient`.
Aceite: QA #17/#18 passam; créditos não ficam presos.
P1 · Backend/Produto.

**CARD-10 · MFA e endurecimento de sessão (P1)**
Descrição: TOTP obrigatório p/ médicos/admin (Supabase MFA); CSP + security headers no CloudFront; logout limpa localStorage clínico.
Aceite: login de médico exige 2º fator; relatório de headers A no securityheaders.com.
P1 · Segurança/Infra.

**CARD-11 · TURN efêmero + telemetria QoS (P2)**
Descrição: Edge Function emite credenciais TURN HMAC com TTL 2h; client envia amostra de `getStats` a cada 30s → `incident_connection_quality_low` quando limiares estourados.
P2 · Infra/Backend.

**CARD-12 · Sanitização de impressão + rate limit de chat (P2)**
Descrição: DOMPurify em todo conteúdo interpolado em `printDocument`/`consultaDraft`; throttle de 1 msg/s (burst 5) no chat com feedback.
Aceite: QA #14 passa.
P2 · Frontend.

**CARD-13 · Lock multi-aba (P2)**
Descrição: `session_id` na presence; 2ª aba do mesmo usuário detecta sessão ativa e exibe bloqueio "consulta aberta em outra aba" com opção de assumir.
Aceite: QA #19 passa.
P2 · Frontend.

**CARD-14 · Pós-consulta do paciente (P2)**
Descrição: tela "ended" ganha pesquisa de satisfação (já existe EvaluationModal — reaproveitar) + card "Sua receita está disponível" com link direto a `/consulta/:id/detalhes`; remover promessa "em breve no painel".
P2 · Produto/Frontend.

**CARD-15 · CI de migrações (P2)**
Descrição: `supabase db push` em pipeline; checagem de publication Realtime; elimina aplicação manual (causa-raiz do bug "não notifica").
P2 · Infra.

---

## J) Melhorias de UX

**Paciente**
1. Pós-consulta: substituir "documentos disponíveis em breve" por link direto + pesquisa de satisfação (CARD-14).
2. Sala de espera: posição na fila + tempo estimado ("Você é o 2º — ~8 min"), e botão "Estou com problema técnico".
3. Preparação: medidor de nível do microfone real (hoje "ok" = permissão, não captação) e seletor de dispositivo quando houver múltiplos.
4. Mobile: barra de controles na zona do polegar; manter tela acesa (Wake Lock API) durante a chamada.
5. Acessibilidade: vibração+banner além do som no ring; tamanho de fonte do chat ajustável.

**Médico**
6. Timer de duração da consulta visível no topo do atendimento (existe só no lado do paciente).
7. Distinguir claramente "Encerrar chamada" (X do painel) de "Finalizar atendimento" — hoje o X encerra a chamada sem confirmar, fácil de clicar por engano.
8. Indicador de qualidade de conexão também no painel do médico (hoje só Wi-Fi verde estático).
9. Próximo paciente: ao finalizar, sugerir "Chamar próximo da fila (N aguardando)".
10. Templates de anamnese e favoritos de prescrição para reduzir digitação repetida.

---

*Gerado por auditoria assistida sobre o código em `release/new-telemedicina` (commit base 39e0bed + working tree).*
