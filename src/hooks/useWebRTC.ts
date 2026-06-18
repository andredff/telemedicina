import { useRef, useCallback } from 'react';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Resolve true once the video track is actually PRODUCING frames. getUserMedia
// can resolve with a track that is still `muted` (no media yet) — typically right
// after the device was released by the previous leg (attendant→doctor handoff) —
// which renders as a black preview/remote. We wait for `unmute` (or a live,
// non-muted readyState) up to a timeout.
function waitUntilLive(track: MediaStreamTrack, timeoutMs: number): Promise<boolean> {
  if (track.readyState === 'live' && !track.muted) return Promise.resolve(true);
  return new Promise(resolve => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      track.onunmute = null;
      clearTimeout(timer);
      resolve(ok);
    };
    track.onunmute = () => finish(true);
    const timer = setTimeout(() => finish(track.readyState === 'live' && !track.muted), timeoutMs);
  });
}

function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USERNAME as string,
      credential: import.meta.env.VITE_TURN_CREDENTIAL as string,
    });
  }
  return servers;
}

export interface WebRTCCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  // Caller-only: ICE failed and we generated a fresh ICE-restart offer. The
  // component must forward it over signaling so the answerer renegotiates.
  // Answerers leave this undefined → they just restartIce() and wait for the
  // new offer to arrive. Without this, a 'failed' connection never recovers.
  onRenegotiationOffer?: (offer: RTCSessionDescriptionInit) => void;
}

export function useWebRTC(callbacks: WebRTCCallbacks) {
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  // Stable ref so event handlers always see the latest callbacks without recreating the PC
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  // Remote ICE candidates that arrive BEFORE the remote description is set must
  // be queued — addIceCandidate() throws ("remote description was null") and the
  // candidate is lost forever otherwise. Dropped candidates are the #1 cause of a
  // call that connects the SDP but then freezes in ICE 'checking' (black video).
  // The skew is largest in the attendant→doctor handoff, where the caller is
  // already trickling ICE while the patient is still re-acquiring the camera.
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const hasRemoteDescription = useRef(false);

  const drainIce = useCallback(async () => {
    if (!pc.current) return;
    const queued = pendingIce.current;
    pendingIce.current = [];
    for (const c of queued) {
      try { await pc.current.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
  }, []);

  const startMedia = useCallback(async (video = true, audio = true): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
    localStream.current = stream;
    return stream;
  }, []);

  // Acquire a camera that is genuinely producing video. Beyond getUserMedia's own
  // failures (permission/missing/busy), this also retries the "resolved but black"
  // case (track present but `muted`) which is the root of the black-camera bug in
  // the attendant→doctor handoff. Throws a typed error (name) for the UI to map:
  //   NotAllowedError | NotFoundError | NotReadableError | OverconstrainedError | CameraBlack
  const acquireLiveCamera = useCallback(async (): Promise<MediaStream> => {
    const HD: MediaStreamConstraints = {
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    };

    // Release any stream this hook still holds before re-acquiring. A camera can be
    // opened by only one consumer at a time, so re-acquiring while we still hold it
    // would itself throw NotReadableError ("Could not start video source").
    localStream.current?.getTracks().forEach(t => t.stop());
    localStream.current = null;

    // Escalating backoff between attempts. After a reload / leg switch the OS can
    // take a couple of seconds to free the camera (Windows especially), so we give
    // a busy device up to ~5.4s before giving up — otherwise reentry races the
    // release and fails with NotReadableError.
    const BUSY_BACKOFF = [300, 600, 1000, 1500, 2000];
    let lastErr: unknown = new DOMException('Camera is not producing video', 'CameraBlack');

    for (let attempt = 0; attempt <= BUSY_BACKOFF.length; attempt++) {
      const isLast = attempt === BUSY_BACKOFF.length;
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(HD);
      } catch (err) {
        const name = (err as Error)?.name;
        if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
          // Requested resolution unsupported → fall back to defaults.
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          } catch (e2) {
            lastErr = e2;
            if (isLast) throw e2;
            await delay(BUSY_BACKOFF[attempt]);
            continue;
          }
        } else if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') {
          lastErr = err; // device still busy (handoff / slow release) → wait longer and retry
          if (isLast) throw err;
          await delay(BUSY_BACKOFF[attempt]);
          continue;
        } else {
          throw err; // NotAllowed / NotFound → no point retrying; surface a clear message
        }
      }

      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach(t => t.stop());
        lastErr = new DOMException('No video track', 'NotFoundError');
        if (isLast) throw lastErr;
        await delay(BUSY_BACKOFF[attempt]);
        continue;
      }

      const live = await waitUntilLive(track, 1500);
      if (!live) {
        // Resolved but black → release and retry; the device often recovers within
        // a few hundred ms once the previous leg fully frees it.
        stream.getTracks().forEach(t => t.stop());
        lastErr = new DOMException('Camera is not producing video', 'CameraBlack');
        if (isLast) throw lastErr;
        await delay(BUSY_BACKOFF[attempt]);
        continue;
      }

      localStream.current = stream;
      return stream;
    }
    throw lastErr;
  }, []);

  const createPeerConnection = useCallback((): RTCPeerConnection => {
    pc.current?.close();
    // Fresh PC → no remote description yet, and any previously queued candidates
    // belong to the old connection.
    pendingIce.current = [];
    hasRemoteDescription.current = false;
    const conn = new RTCPeerConnection({ iceServers: getIceServers() });
    pc.current = conn;

    localStream.current?.getTracks().forEach(t => conn.addTrack(t, localStream.current!));

    conn.ontrack = (e) => cbRef.current.onRemoteStream(e.streams[0]);
    conn.onicecandidate = (e) => {
      if (e.candidate) cbRef.current.onIceCandidate(e.candidate.toJSON());
    };
    conn.onconnectionstatechange = () => cbRef.current.onConnectionStateChange?.(conn.connectionState);
    conn.oniceconnectionstatechange = async () => {
      if (conn.iceConnectionState !== 'failed') return;
      // Only the offerer can drive an ICE restart. If a renegotiation sink was
      // provided (the caller), mint a fresh ICE-restart offer and hand it over to
      // be re-signaled. Otherwise just flag the restart and wait for the new offer.
      if (cbRef.current.onRenegotiationOffer) {
        try {
          const offer = await conn.createOffer({ iceRestart: true });
          await conn.setLocalDescription(offer);
          cbRef.current.onRenegotiationOffer({ sdp: offer.sdp!, type: offer.type });
        } catch {
          conn.restartIce();
        }
      } else {
        conn.restartIce();
      }
    };
    return conn;
  }, []);

  const createOffer = useCallback(async (options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> => {
    if (!pc.current) throw new Error('No peer connection');
    const offer = await pc.current.createOffer(options);
    await pc.current.setLocalDescription(offer);
    return { sdp: offer.sdp!, type: offer.type };
  }, []);

  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> => {
    if (!pc.current) throw new Error('No peer connection');
    await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
    hasRemoteDescription.current = true;
    await drainIce(); // apply any candidates buffered before the offer arrived
    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);
    return { sdp: answer.sdp!, type: answer.type };
  }, [drainIce]);

  const setAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    await pc.current?.setRemoteDescription(new RTCSessionDescription(answer));
    hasRemoteDescription.current = true;
    await drainIce(); // apply any candidates buffered before the answer arrived
  }, [drainIce]);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    // Buffer until the remote description exists; flushed by drainIce().
    if (!pc.current || !hasRemoteDescription.current) {
      pendingIce.current.push(candidate);
      return;
    }
    try { await pc.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
  }, []);

  const toggleAudio = useCallback((enabled: boolean) => {
    localStream.current?.getAudioTracks().forEach(t => (t.enabled = enabled));
  }, []);

  const toggleVideo = useCallback((enabled: boolean) => {
    localStream.current?.getVideoTracks().forEach(t => (t.enabled = enabled));
  }, []);

  const closeConnection = useCallback(() => {
    pc.current?.close();
    localStream.current?.getTracks().forEach(t => t.stop());
    pc.current = null;
    localStream.current = null;
    pendingIce.current = [];
    hasRemoteDescription.current = false;
  }, []);

  const getLocalStream = useCallback(() => localStream.current, []);

  const getStats = useCallback(async (): Promise<RTCStatsReport | undefined> => {
    return pc.current ? await pc.current.getStats() : undefined;
  }, []);

  return {
    startMedia,
    acquireLiveCamera,
    createPeerConnection,
    createOffer,
    createAnswer,
    setAnswer,
    addIceCandidate,
    toggleAudio,
    toggleVideo,
    closeConnection,
    getLocalStream,
    getStats,
  };
}
