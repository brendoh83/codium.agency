import {
  textoFalhaPostagem,
  textoPerdeuHorarioCliente,
  textoPerdeuHorarioEquipe,
  textoPostada,
  textoSistemaFora,
} from "./avisos.ts";

/** Depois deste atraso, na primeira tentativa, o sistema não posta: avisa a equipe para postar à mão. */
export const ATRASO_MAX_MIN = 10;

export type Parte = "midia" | "legenda" | "data";

export interface ItemFila {
  postagem: {
    id: string;
    estado: string;
    agendado_para: string;
    creation_id: string | null;
    ig_media_id: string | null;
    tentativas: number;
  };
  /** Mídia, legenda e data aprovadas agora. */
  pronto: boolean;
  /** Partes que ainda não estão aprovadas (para o aviso de "perdeu o horário"). */
  faltou: Parte[];
  clienteId: string;
  empresa: string;
  titulo: string;
  link: string;
  conteudo: { tipo: "imagem" | "video" | "carrossel"; legenda: string; chaves: string[] };
  conta: { igUserId: string; tokenCifrado: string; status: string } | null;
}

export type ItemPublicar = ItemFila & { urls: string[]; token: string };

export function decidirAcao(i: {
  postagem: { estado: string; agendado_para: string; creation_id?: string | null; tentativas?: number };
  pronto: boolean;
  agora: Date;
}): "publicar" | "perdeu_horario" | "sistema_fora" | "nada" {
  if (i.postagem.estado !== "agendada") return "nada";
  const quando = new Date(i.postagem.agendado_para).getTime();
  const agora = i.agora.getTime();
  if (quando > agora) return "nada";
  if (!i.pronto) return "perdeu_horario";
  const primeira = !i.postagem.creation_id && (i.postagem.tentativas ?? 0) === 0;
  if (primeira && agora - quando > ATRASO_MAX_MIN * 60_000) return "sistema_fora";
  return "publicar";
}

export interface DepsFila {
  /** Postagens agendadas que já chegaram na hora (com os dados de que o aviso e a postagem precisam). */
  listar: () => Promise<ItemFila[]>;
  /** Troca o estado só se ainda for o esperado (atômico). Quem perde a corrida recebe false. */
  reservar: (id: string, de: string, para: string) => Promise<boolean>;
  salvar: (p: { id: string } & Record<string, unknown>) => Promise<void>;
  urls: (chaves: string[]) => Promise<string[]>;
  token: (tokenCifrado: string) => string;
  publicar: (i: ItemPublicar) => Promise<{ resultado: "postada" | "aguardando" | "falhou"; erro?: string; link?: string | null }>;
  avisarEquipe: (texto: string) => Promise<void>;
  avisarCliente: (clienteId: string, texto: string) => Promise<void>;
  agora: () => Date;
}

/** Nunca lança: um item com problema não derruba os outros. */
async function seguro(f: () => Promise<void>) {
  try {
    await f();
  } catch {
    /* melhor esforço */
  }
}

export async function processarFila(
  deps: DepsFila,
  agora: Date
): Promise<{ publicadas: number; perdidas: number; falhas: number }> {
  const r = { publicadas: 0, perdidas: 0, falhas: 0 };
  for (const item of await deps.listar()) {
    const { postagem } = item;
    const acao = decidirAcao({ postagem, pronto: item.pronto, agora });
    if (acao === "nada") continue;

    try {
      if (acao === "perdeu_horario") {
        if (!(await deps.reservar(postagem.id, "agendada", "perdeu_horario"))) continue;
        r.perdidas++;
        await seguro(() => deps.avisarCliente(item.clienteId, textoPerdeuHorarioCliente(item)));
        await seguro(() =>
          deps.avisarEquipe(
            textoPerdeuHorarioEquipe({ ...item, faltou: item.faltou, agendadoPara: postagem.agendado_para })
          )
        );
        continue;
      }

      if (acao === "sistema_fora") {
        if (!(await deps.reservar(postagem.id, "agendada", "falhou"))) continue;
        r.falhas++;
        await deps.salvar({ id: postagem.id, erro: "Sistema fora do ar na hora de postar." });
        await seguro(() => deps.avisarEquipe(textoSistemaFora({ ...item, agendadoPara: postagem.agendado_para })));
        continue;
      }

      // publicar
      if (!(await deps.reservar(postagem.id, "agendada", "postando"))) continue;
      if (!item.conta || item.conta.status !== "ativa") {
        const erro = item.conta
          ? "O Instagram do cliente precisa ser reconectado."
          : "Este cliente não tem Instagram conectado.";
        await deps.salvar({ id: postagem.id, estado: "falhou", erro });
        r.falhas++;
        await seguro(() => deps.avisarEquipe(textoFalhaPostagem({ ...item, erro })));
        continue;
      }

      const urls = await deps.urls(item.conteudo.chaves);
      const resultado = await deps.publicar({ ...item, urls, token: deps.token(item.conta.tokenCifrado) });
      if (resultado.resultado === "postada") {
        r.publicadas++;
        await seguro(() => deps.avisarEquipe(textoPostada({ ...item, link: resultado.link ?? null })));
      } else if (resultado.resultado === "falhou") {
        r.falhas++;
        await seguro(() => deps.avisarEquipe(textoFalhaPostagem({ ...item, erro: resultado.erro ?? "Erro ao postar." })));
      }
    } catch (e) {
      r.falhas++;
      const erro = e instanceof Error ? e.message : "Erro ao postar.";
      await seguro(() => deps.salvar({ id: postagem.id, estado: "falhou", erro }));
      await seguro(() => deps.avisarEquipe(textoFalhaPostagem({ ...item, erro })));
    }
  }
  return r;
}
