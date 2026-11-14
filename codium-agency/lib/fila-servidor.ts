// somente servidor
import { createPublicClient } from "@/lib/supabase/publico";
import { cifrar, decifrar } from "@/lib/cripto";
import { urlLeitura } from "@/lib/r2";
import { enviarTexto } from "@/lib/whatsapp";
import { criarContainer, permalink, publicarContainer, renovar, statusContainer } from "@/lib/instagram";
import { publicarPostagem } from "@/lib/publicar";
import { processarFila, type DepsFila, type ItemFila } from "@/lib/fila";
import { renovarContas } from "@/lib/renovar-contas";
import { processarLembretes, type ItemLembrete } from "@/lib/lembretes";
import { linkDoCliente } from "@/lib/avisos";
import { origemDoSite } from "@/lib/avisos-servidor";

type Resumo = {
  renovadas: number;
  sincronizadas: number;
  publicadas: number;
  perdidas: number;
  falhas: number;
  lembretes: number;
  correcoes: number;
  erros: string[];
};

/** Uma rodada (chamada a cada minuto): renova chaves, sincroniza postagens e processa a fila. */
export async function rodarCron(): Promise<Resumo> {
  const segredo = process.env.CRON_SECRET ?? "";
  const chave = process.env.IG_TOKEN_KEY ?? "";
  const resumo: Resumo = { renovadas: 0, sincronizadas: 0, publicadas: 0, perdidas: 0, falhas: 0, lembretes: 0, correcoes: 0, erros: [] };
  const supabase = createPublicClient();
  const erro = (etapa: string, e: unknown) =>
    resumo.erros.push(`${etapa}: ${e instanceof Error ? e.message : String(e)}`);

  async function rpc(nome: string, args: Record<string, unknown>) {
    const { data, error } = await supabase.rpc(nome, { p_segredo: segredo, ...args });
    if (error) throw new Error(error.message);
    return data;
  }

  // 1. renovar chaves que vencem em até 10 dias
  try {
    const r = await renovarContas({
      listar: () => rpc("fila_contas", {}),
      renovar: (t) => renovar({ fetch }, t),
      salvar: async (id, p) => void (await rpc("fila_conta_salvar", { p_id: id, p_dados: p })),
      decifrar: (c) => decifrar(c, chave),
      cifrar: (t) => cifrar(t, chave),
      agora: () => new Date(),
    });
    resumo.renovadas = r.renovadas;
  } catch (e) {
    erro("renovar", e);
  }

  // 2. garantir uma postagem para cada conteúdo com legenda e data
  try {
    resumo.sincronizadas = Number(await rpc("fila_sincronizar", {}));
  } catch (e) {
    erro("sincronizar", e);
    return resumo; // sem o segredo certo nada mais funciona
  }

  // 3. fila
  try {
    const dados = await rpc("fila_vencidas", {});
    const itens: ItemFila[] = (dados.itens ?? []).map((i: any) => ({
      ...i,
      link: linkDoCliente(origemDoSite(), i.linkToken),
    }));
    const grupoCliente = new Map<string, string | null>(itens.map((i: any) => [i.clienteId, i.grupoClienteId ?? null]));
    const enviar = async (jid: string | null | undefined, texto: string) => {
      if (jid) await enviarTexto(dados.instancia, jid, texto);
    };

    const salvar: DepsFila["salvar"] = async ({ id, ...resto }) => void (await rpc("fila_salvar", { p_id: id, p_dados: resto }));

    const deps: DepsFila = {
      listar: async () => itens,
      reservar: async (id, de, para) => Boolean(await rpc("fila_reservar", { p_id: id, p_de: de, p_para: para })),
      salvar,
      urls: (chaves) => Promise.all(chaves.map((k) => urlLeitura(k))),
      token: (c) => decifrar(c, chave),
      publicar: (i) =>
        publicarPostagem(
          {
            ig: {
              criarContainer: (a) => criarContainer({ fetch }, i.token, a),
              statusContainer: (id) => statusContainer({ fetch }, i.token, id),
              publicarContainer: (a) => publicarContainer({ fetch }, i.token, a),
              permalink: (id) => permalink({ fetch }, i.token, id),
            },
            salvar,
            agora: () => new Date(),
          },
          {
            postagem: i.postagem,
            conteudo: { tipo: i.conteudo.tipo, legenda: i.conteudo.legenda, urls: i.urls },
            igUserId: i.conta!.igUserId,
          }
        ),
      avisarEquipe: (t) => enviar(dados.grupo_equipe_id, t),
      avisarCliente: (clienteId, t) => enviar(grupoCliente.get(clienteId), t),
      agora: () => new Date(),
    };
    const r = await processarFila(deps, new Date());
    resumo.publicadas = r.publicadas;
    resumo.perdidas = r.perdidas;
    resumo.falhas = r.falhas;
  } catch (e) {
    erro("fila", e);
  }

  // 4. lembretes de aprovação (depois da fila: o que acabou de perder o horário não é cobrado)
  try {
    const dados = await rpc("fila_lembretes", {});
    const itens: ItemLembrete[] = (dados.itens ?? []).map((i: any) => ({
      ...i,
      link: linkDoCliente(origemDoSite(), i.linkToken),
    }));
    const grupoCliente = new Map<string, string | null>((dados.itens ?? []).map((i: any) => [i.clienteId, i.grupoClienteId ?? null]));
    const enviar = async (jid: string | null | undefined, texto: string) => {
      if (jid) await enviarTexto(dados.instancia, jid, texto);
    };
    const r = await processarLembretes(
      {
        listar: async () => itens,
        avisarCliente: (clienteId, t) => enviar(grupoCliente.get(clienteId), t),
        avisarEquipe: (t) => enviar(dados.grupo_equipe_id, t),
        marcarLembrete: async (id) => void (await rpc("fila_lembrete_enviado", { p_id: id })),
        marcarCorrecao: async (id) => void (await rpc("fila_correcao_avisada", { p_id: id })),
      },
      new Date()
    );
    resumo.lembretes = r.lembretes;
    resumo.correcoes = r.correcoes;
  } catch (e) {
    erro("lembretes", e);
  }
  return resumo;
}
