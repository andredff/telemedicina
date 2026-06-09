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

  useEffect(() => {
    if (!consultationId) return;

    const ch = supabase
      .channel(`consultation:${consultationId}`, {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: '*' }, ({ event, payload }: { event: string; payload: Payload }) => {
        handlers.current.get(event)?.(payload ?? {});
      })
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState() as PresenceState;
        presenceHandlers.current.forEach(h => h(state));
      })
      .subscribe();

    channel.current = ch;
    return () => {
      ch.unsubscribe();
      channel.current = null;
    };
  }, [consultationId]);

  const send = (event: string, payload: Payload = {}) => {
    channel.current?.send({ type: 'broadcast', event, payload });
  };

  const track = (data: Record<string, unknown>) => {
    channel.current?.track(data);
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
