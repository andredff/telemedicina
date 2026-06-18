import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type Payload = Record<string, unknown>;
type Handler = (payload: Payload) => void;
type PresenceState = Record<string, unknown[]>;

export function useSignaling(consultationId: string) {
  const channel = useRef<RealtimeChannel | null>(null);
  const handlers = useRef<Map<string, Handler>>(new Map());
  const presenceHandlers = useRef<((state: PresenceState) => void)[]>([]);

  // Broadcast over a websocket channel is silently dropped if sent before the
  // channel reaches SUBSCRIBED. The WebRTC handshake fires offers/ready signals
  // right on mount — racing the subscribe — so we queue outgoing messages and
  // any presence track() until the channel is ready, then flush in order.
  const subscribed = useRef(false);
  const outbox = useRef<{ event: string; payload: Payload }[]>([]);
  const pendingTrack = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!consultationId) return;

    subscribed.current = false;
    outbox.current = [];
    pendingTrack.current = null;

    // `private: true` → Supabase Realtime Authorization: o subscribe só é
    // aceito se as policies em realtime.messages autorizarem este usuário
    // neste tópico (participante de consulta aberta). Ver migrations
    // 20260610040000_private_signaling.sql + 20260619030000_signaling_triage_roles.sql.
    const ch = supabase
      .channel(`consultation:${consultationId}`, {
        config: { broadcast: { self: false }, private: true },
      })
      .on('broadcast', { event: '*' }, ({ event, payload }: { event: string; payload: Payload }) => {
        handlers.current.get(event)?.(payload ?? {});
      })
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState() as PresenceState;
        presenceHandlers.current.forEach(h => h(state));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribed.current = true;
          if (pendingTrack.current) {
            ch.track(pendingTrack.current);
            pendingTrack.current = null;
          }
          // Flush queued outgoing messages in order.
          const queued = outbox.current;
          outbox.current = [];
          queued.forEach(m => ch.send({ type: 'broadcast', event: m.event, payload: m.payload }));
        }
      });

    channel.current = ch;
    return () => {
      subscribed.current = false;
      ch.unsubscribe();
      channel.current = null;
    };
  }, [consultationId]);

  const send = (event: string, payload: Payload = {}) => {
    if (subscribed.current && channel.current) {
      channel.current.send({ type: 'broadcast', event, payload });
    } else {
      outbox.current.push({ event, payload });
    }
  };

  const track = (data: Record<string, unknown>) => {
    if (subscribed.current && channel.current) {
      channel.current.track(data);
    } else {
      pendingTrack.current = data;
    }
  };

  const on = (event: string, handler: Handler) => {
    handlers.current.set(event, handler);
  };

  const off = (event: string) => {
    handlers.current.delete(event);
  };

  const onPresence = (handler: (state: PresenceState) => void): (() => void) => {
    presenceHandlers.current.push(handler);
    return () => {
      presenceHandlers.current = presenceHandlers.current.filter(h => h !== handler);
    };
  };

  return { send, on, off, track, onPresence };
}
