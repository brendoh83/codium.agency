export const MAX_LEGENDA = 2200;
export const MAX_HASHTAGS = 30;

export function validarLegenda(texto: string): string | null {
  if (!texto.trim()) return "Escreva a legenda.";
  if (texto.length > MAX_LEGENDA) return `A legenda passa de ${MAX_LEGENDA} caracteres.`;
  const tags = texto.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  if (tags > MAX_HASHTAGS) return `O Instagram aceita no máximo ${MAX_HASHTAGS} hashtags.`;
  return null;
}

/** "YYYY-MM-DDTHH:mm" em São Paulo -> ISO UTC. null se inválida. */
export function dataHoraSaoPauloParaUtc(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  // ponytail: Brasil sem horário de verão desde 2019 (UTC-3 fixo); voltar a usar Intl se a regra mudar.
  const d = new Date(`${local}:00-03:00`);
  if (Number.isNaN(d.getTime())) return null;
  const iso = d.toISOString();
  // recusa datas que o JS "corrige" (30/02 viraria março)
  const volta = new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 16);
  return volta === local ? iso : null;
}

export function validarAgendamento(isoUtc: string, agora: Date): string | null {
  const t = new Date(isoUtc).getTime();
  if (Number.isNaN(t)) return "Data inválida.";
  if (t <= agora.getTime()) return "Escolha uma data e hora no futuro.";
  return null;
}

/** O Instagram só publica imagem JPG e vídeo MP4/MOV; avisa antes de agendar algo que não vai conseguir postar. */
export function validarMidiaInstagram(mimes: string[]): string | null {
  for (const m of mimes) {
    if (m.startsWith("image/") && m !== "image/jpeg") {
      return "Para postar automático, o Instagram só aceita imagem em JPG. Converta a imagem para JPG e envie de novo.";
    }
    if (m.startsWith("video/") && m !== "video/mp4" && m !== "video/quicktime") {
      return "Para postar automático, o Instagram só aceita vídeo em MP4 ou MOV. Converta o vídeo e envie de novo.";
    }
  }
  return null;
}
