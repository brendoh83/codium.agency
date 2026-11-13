const MIN = 60_000;
const H = 60 * MIN;
export const MAX_LEMBRETES = 6;

export interface EntradaLembrete {
  agora: Date;
  agendadoPara: Date;
  ultimoAviso: Date;
  abriuLinkEm: Date | null;
  lembretesEnviados: number;
}

/** Quando mandar o próximo lembrete; null = não mandar mais. */
export function proximoLembrete(i: EntradaLembrete): Date | null {
  if (i.lembretesEnviados >= MAX_LEMBRETES) return null;
  if (i.agendadoPara.getTime() <= i.agora.getTime()) return null;
  if (i.abriuLinkEm && i.abriuLinkEm.getTime() > i.ultimoAviso.getTime()) {
    return new Date(i.abriuLinkEm.getTime() + 20 * MIN);
  }
  const restante = i.agendadoPara.getTime() - i.ultimoAviso.getTime();
  const intervalo = Math.min(6 * H, Math.max(20 * MIN, restante / 3));
  return new Date(i.ultimoAviso.getTime() + intervalo);
}
