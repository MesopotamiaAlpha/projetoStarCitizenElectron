// ── Tempo relativo das mensagens UEX ──────────────────────────────────────────

function normalizeTimestampMs(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value).trim())) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric < 100000000000 ? numeric * 1000 : numeric;
  }

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function formatRelativeMessageTime(value, now = Date.now()) {
  const timestamp = normalizeTimestampMs(value);
  if (timestamp === null) return 'horário não informado';

  const reference = Number(now);
  const current = Number.isFinite(reference) && reference > 0 ? reference : Date.now();
  const elapsed = Math.max(0, current - timestamp);
  const seconds = Math.floor(elapsed / 1000);

  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  const months = Math.floor(days / 30);
  if (days < 365) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(days / 365);
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
}

export default formatRelativeMessageTime;
