import type { TipoContainer } from "./instagram.ts";

export interface Postagem {
  id: string;
  creation_id: string | null;
  ig_media_id: string | null;
  tentativas: number;
}

/** Chamadas da Meta com o token já aplicado. */
export interface IgPublicar {
  criarContainer: (i: { igUserId: string; tipo: TipoContainer; url?: string; legenda?: string; filhos?: string[] }) => Promise<{ id: string }>;
  statusContainer: (id: string) => Promise<"em_andamento" | "pronto" | "erro">;
  publicarContainer: (i: { igUserId: string; creationId: string }) => Promise<{ id: string }>;
  permalink: (mediaId: string) => Promise<string | null>;
}

export const MAX_TENTATIVAS = 3;

type Salvar = (p: { id: string } & Record<string, unknown>) => Promise<void>;

/**
 * Publica uma postagem de forma idempotente:
 * - já publicada (ig_media_id) → não faz nada;
 * - já criada na Meta (creation_id) → continua dela, sem criar outra;
 * - container ainda processando → "aguardando" (volta na próxima rodada);
 * - falha → conta tentativa; na 3ª vira "falhou".
 * Quem chama deve ter reservado a postagem (agendada → postando) antes.
 */
export async function publicarPostagem(
  deps: { ig: IgPublicar; salvar: Salvar; agora: () => Date },
  i: {
    postagem: Postagem;
    conteudo: { tipo: "imagem" | "video" | "carrossel"; legenda: string; urls: string[] };
    igUserId: string;
  }
): Promise<{ resultado: "postada" | "aguardando" | "falhou"; erro?: string }> {
  const { ig, salvar } = deps;
  const { postagem, conteudo, igUserId } = i;
  if (postagem.ig_media_id) return { resultado: "postada" };

  try {
    let creationId = postagem.creation_id;
    if (!creationId) {
      if (conteudo.tipo === "carrossel") {
        const filhos: string[] = [];
        for (const url of conteudo.urls) filhos.push((await ig.criarContainer({ igUserId, tipo: "item_carrossel", url })).id);
        creationId = (await ig.criarContainer({ igUserId, tipo: "carrossel", filhos, legenda: conteudo.legenda })).id;
      } else {
        creationId = (
          await ig.criarContainer({
            igUserId,
            tipo: conteudo.tipo === "video" ? "reels" : "imagem",
            url: conteudo.urls[0],
            legenda: conteudo.legenda,
          })
        ).id;
      }
      await salvar({ id: postagem.id, creation_id: creationId });
    }

    const status = await ig.statusContainer(creationId);
    if (status === "em_andamento") {
      await salvar({ id: postagem.id, estado: "agendada" });
      return { resultado: "aguardando" };
    }
    if (status === "erro") {
      await salvar({ id: postagem.id, creation_id: null });
      throw new Error("A Meta não conseguiu processar a mídia.");
    }

    const publicado = await ig.publicarContainer({ igUserId, creationId });
    const link = await ig.permalink(publicado.id).catch(() => null);
    await salvar({
      id: postagem.id,
      estado: "postada",
      ig_media_id: publicado.id,
      permalink: link,
      postado_em: deps.agora().toISOString(),
    });
    return { resultado: "postada" };
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro ao postar.";
    const tentativas = postagem.tentativas + 1;
    if (tentativas >= MAX_TENTATIVAS) {
      await salvar({ id: postagem.id, estado: "falhou", tentativas, erro });
      return { resultado: "falhou", erro };
    }
    await salvar({ id: postagem.id, estado: "agendada", tentativas, erro });
    return { resultado: "aguardando", erro };
  }
}
