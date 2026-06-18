// Human, actionable messages for getUserMedia / camera failures, shared by the
// patient, attendant and doctor call screens. Keyed by the DOMException `name`
// (including the synthetic 'CameraBlack' raised by useWebRTC.acquireLiveCamera
// when the camera opens but never produces frames).

export function mediaErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name ?? '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Permissão de câmera/microfone negada. Clique no cadeado na barra de endereço e permita o acesso.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Nenhuma câmera encontrada. Conecte uma câmera e tente novamente.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'A câmera está em uso por outro aplicativo ou aba. Feche o outro programa e tente novamente.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'A câmera não suporta a configuração solicitada. Tente outra câmera.';
    case 'CameraBlack':
      return 'A câmera abriu mas não está enviando imagem. Verifique se outro aplicativo está usando a câmera e tente novamente.';
    default:
      return 'Não foi possível acessar a câmera. Verifique as permissões e tente novamente.';
  }
}

// Compact technical detail surfaced in the diagnostics line under the error UI.
export function mediaErrorDetail(err: unknown): string {
  const e = err as { name?: string; message?: string };
  const name = e?.name || 'Erro';
  const msg = e?.message || '';
  return `mídia · ${name}${msg ? `: ${msg}` : ''}`;
}
