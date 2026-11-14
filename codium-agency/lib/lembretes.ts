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

// ---------- envio dos lembretes ----------

import { textoCorrecaoAtrasada, textoLembrete } from "./avisos.ts";

export interface ItemLembrete {
  postagem: {
    id: string;
    agendado_para: string;
    lembretes: number;
    ultimo_aviso_em: string;
    aviso_correcao_em: string | null;
  };
  /** Partes ainda não aprovadas. */
  faltou: ("midia" | "legenda" | "data")[];
  /** Partes que o cliente reprovou (a bola está com a equipe). */
  reprovadas: ("midia" | "legenda" | "data")[];
  clienteId: string;
  empresa: string;
  titulo: string;
  link: string;
  /** Último momento em que o cliente abriu o link de aprovação. */
  abriuLinkEm: string | null;
}

/** Avisa a equipe quando falta menos que isto e a correção de uma parte reprovada ainda não subiu. */
export const CORRECAO_ATRASADA_HORAS = 2;

/**
 * Cobra a aprovação no grupo do cliente (cadência de proximoLembrete) e avisa a equipe
 * quando há correção pendente perto do horário. Nunca lança: um envio que falha não derruba o ciclo
 * e não é marcado como enviado (tenta de novo na próxima rodada).
 */
export async function processarLembretes(
  deps: {
    listar: () => Promise<ItemLembrete[]>;
    avisarCliente: (clienteId: string, texto: string) => Promise<void>;
    avisarEquipe: (texto: string) => Promise<void>;
    marcarLembrete: (postagemId: string) => Promise<void>;
    marcarCorrecao: (postagemId: string) => Promise<void>;
  },
  agora: Date
): Promise<{ lembretes: number; correcoes: number }> {
  const r = { lembretes: 0, correcoes: 0 };
  for (const item of await deps.listar()) {
    try {
      const p = item.postagem;
      const quando = new Date(p.agendado_para);
      if (item.faltou.length === 0) continue; // tudo aprovado: não cobra
      const restanteMs = quando.getTime() - agora.getTime();
      if (restanteMs <= 0) continue; // a hora passou: quem trata é a fila

      if (item.reprovadas.length > 0) {
        if (restanteMs <= CORRECAO_ATRASADA_HORAS * 3600_000 && !p.aviso_correcao_em) {
          const horas = Math.floor(restanteMs / 3600_000);
          await deps.avisarEquipe(textoCorrecaoAtrasada({ empresa: item.empresa, titulo: item.titulo, horas }));
          await deps.marcarCorrecao(p.id);
          r.correcoes++;
        }
        continue;
      }

      const ultimoAviso = new Date(p.ultimo_aviso_em);
      const abriu = item.abriuLinkEm ? new Date(item.abriuLinkEm) : null;
      const proximo = proximoLembrete({
        agora,
        agendadoPara: quando,
        ultimoAviso,
        abriuLinkEm: abriu,
        lembretesEnviados: p.lembretes,
      });
      if (!proximo || proximo.getTime() > agora.getTime()) continue;

      const jaViu = !!abriu && abriu.getTime() > ultimoAviso.getTime();
      await deps.avisarCliente(
        item.clienteId,
        textoLembrete({ empresa: item.empresa, titulo: item.titulo, agendadoPara: quando, link: item.link, jaViu, agora })
      );
      await deps.marcarLembrete(p.id);
      r.lembretes++;
    } catch {
      /* segue para o próximo; este tenta de novo na próxima rodada */
    }
  }
  return r;
}
