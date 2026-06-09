import { useRef, useCallback } from 'react';

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
}

export function useWebRTC(callbacks: WebRTCCallbacks) {
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  // Stable ref so event handlers always see the latest callbacks without recreating the PC
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const startMedia = useCallback(async (video = true, audio = true): Promise<MediaStream> => {
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
    localStream.current = stream;
    return stream;
  }, []);

  const createPeerConnection = useCallback((): RTCPeerConnection => {
    pc.current?.close();
    const conn = new RTCPeerConnection({ iceServers: getIceServers() });
    pc.current = conn;

    localStream.current?.getTracks().forEach(t => conn.addTrack(t, localStream.current!));

    conn.ontrack = (e) => cbRef.current.onRemoteStream(e.streams[0]);
    conn.onicecandidate = (e) => {
      if (e.candidate) cbRef.current.onIceCandidate(e.candidate.toJSON());
    };
    conn.onconnectionstatechange = () => cbRef.current.onConnectionStateChange?.(conn.connectionState);
    conn.oniceconnectionstatechange = () => {
      if (conn.iceConnectionState === 'failed') conn.restartIce();
    };
    return conn;
  }, []);

  const createOffer = useCallback(async (): Promise<RTCSessionDescriptionInit> => {
    if (!pc.current) throw new Error('No peer connection');
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    return { sdp: offer.sdp!, type: offer.type };
  }, []);

  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> => {
    if (!pc.current) throw new Error('No peer connection');
    await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);
    return { sdp: answer.sdp!, type: answer.type };
  }, []);

  const setAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    await pc.current?.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  const addIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    try { await pc.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
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
  }, []);

  const getLocalStream = useCallback(() => localStream.current, []);

  const getStats = useCallback(async (): Promise<RTCStatsReport | undefined> => {
    return pc.current ? await pc.current.getStats() : undefined;
  }, []);

  return {
    startMedia,
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
