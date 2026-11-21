// Trava global dos sons de notificação do app (sino e chat de negociações).
//
// Os dois tocam sons por conta própria. Quando dois avisos disparam quase juntos
// (mensagem + alerta de mercado na mesma checagem, chat + sino, etc.), o usuário
// ouvia dois "dings" colados e achava que era uma duplicação. Quem quiser tocar
// um som deve pedir a vez aqui: só um som é liberado por janela.
export const NOTIFICATION_SOUND_MIN_GAP_MS = 1500;

let lastPlayedAt = -Infinity;

export function claimNotificationSound(now = Date.now()) {
  if (now - lastPlayedAt < NOTIFICATION_SOUND_MIN_GAP_MS) return false;
  lastPlayedAt = now;
  return true;
}

// Só para testes.
export function resetNotificationSoundGate() {
  lastPlayedAt = -Infinity;
}
