// Amapá / America/Belem é UTC-3 fixo (sem horário de verão).
export const BELEM_OFFSET_MIN = -180;

// Retorna o instante (UTC) correspondente ao PRÓXIMO domingo 23:59:00
// no horário de Belém. Se já for domingo depois das 23:59, pula pro próximo.
export function proximoDomingo2359(from: Date = new Date()): Date {
  const shifted = new Date(from.getTime() + BELEM_OFFSET_MIN * 60000);
  const dow = shifted.getUTCDay(); // 0 = domingo
  let days = (7 - dow) % 7;
  if (days === 0) {
    const h = shifted.getUTCHours();
    const m = shifted.getUTCMinutes();
    if (h > 23 || (h === 23 && m >= 59)) days = 7;
  }
  const localMs = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + days,
    23,
    59,
    0,
    0
  );
  // Converte o "wall clock" de Belém de volta para o instante em UTC.
  return new Date(localMs - BELEM_OFFSET_MIN * 60000);
}

// Milissegundos restantes até um instante futuro (nunca negativo).
export function msRestantes(ate: Date, agora: Date = new Date()): number {
  return Math.max(0, ate.getTime() - agora.getTime());
}

// Formata uma duração em ms como "2d 5h 30m".
export function formatarRestante(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const dias = Math.floor(totalMin / (60 * 24));
  const horas = Math.floor((totalMin % (60 * 24)) / 60);
  const min = totalMin % 60;
  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias}d`);
  if (horas > 0 || dias > 0) partes.push(`${horas}h`);
  partes.push(`${min}m`);
  return partes.join(" ");
}
