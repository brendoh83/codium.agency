import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { chavePrevia, urlLeitura } from "@/lib/r2";
import { montarSlides } from "@/lib/slides";
import { estadoGeral, estadoPartes, separarFeed, versaoAtual, type Conteudo, type Versao } from "@/lib/conteudos";
import ConteudoUpload from "@/components/ConteudoUpload";
import ConteudosGrade from "@/components/ConteudosGrade";
import LinkCliente from "@/components/LinkCliente";
import GrupoCliente from "@/components/GrupoCliente";
import ConectarInstagram from "@/components/ConectarInstagram";
import { ehAdministrador } from "@/lib/admin";
import type { ItemFeed } from "@/components/FeedCliente";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type VersaoComChave = Versao & { r2_key: string; previa_ok?: boolean };
type Item = Omit<Conteudo, "versoes"> & { versoes: VersaoComChave[] };

export default async function ConteudosClientePage({
  params,
  searchParams,
}: {
  params: { clienteId: string };
  searchParams: { ig?: string; msg?: string };
}) {
  const supabase = createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, empresa, link_token, whatsapp_grupo_id, whatsapp_grupo_nome")
    .eq("id", params.clienteId)
    .maybeSingle();
  if (!cliente) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = user ? await ehAdministrador(supabase, user.id) : false;

  const { data: contaIg } = await supabase
    .from("instagram_contas")
    .select("username, token_expira_em, status, autodm_workspace_id")
    .eq("cliente_id", cliente.id)
    .maybeSingle();

  const { data: conteudos } = await supabase
    .from("conteudos")
    .select(
      "id, titulo, tipo, created_at, conteudo_versoes(id, numero, r2_key, mime, created_at, expira_em, previa_ok, decisao, motivo, decidido_em, conteudo_arquivos(r2_key, mime, ordem)), conteudo_legendas(numero, texto, decisao, motivo, decidido_em), conteudo_datas(numero, agendado_para, decisao, motivo, sugerida_para, decidido_em)"
    )
    .eq("cliente_id", cliente.id)
    .order("created_at", { ascending: false });

  const itens: Item[] = (conteudos ?? [])
    .map((c: any) => ({
      id: c.id,
      titulo: c.titulo,
      tipo: c.tipo,
      created_at: c.created_at,
      legendas: c.conteudo_legendas ?? [],
      datas: c.conteudo_datas ?? [],
      versoes: ((c.conteudo_versoes ?? []) as any[])
        .map((v) => ({ ...v, arquivos: v.conteudo_arquivos ?? [], expirada: new Date(v.expira_em) < new Date() }))
        .sort((a, b) => a.numero - b.numero) as VersaoComChave[],
    }))
    .filter((c) => c.versoes.length > 0);

  const { data: postagens } = await supabase
    .from("postagens")
    .select("conteudo_id, estado, permalink, erro")
    .eq("cliente_id", cliente.id);
  const postagemDe = new Map((postagens ?? []).map((p: any) => [p.conteudo_id, p]));

  const { topo, aprovados } = separarFeed(itens as unknown as Conteudo[]);
  const porId = new Map(itens.map((c) => [c.id, c]));

  async function paraItem(c: Conteudo): Promise<ItemFeed> {
    const original = porId.get(c.id)!;
    const atual = versaoAtual(original) as VersaoComChave;
    const slides =
      c.tipo === "carrossel" && !atual.expirada ? await montarSlides(atual.arquivos, c.titulo) : undefined;
    const partes = estadoPartes(original as unknown as Conteudo);
    const ultimaLegenda = [...(original.legendas ?? [])].sort((a, b) => b.numero - a.numero)[0];
    const ultimaData = [...(original.datas ?? [])].sort((a, b) => b.numero - a.numero)[0];
    return {
      id: c.id,
      titulo: c.titulo,
      tipo: c.tipo,
      estado: estadoGeral(partes),
      partes,
      legenda: ultimaLegenda?.texto,
      agendadoPara: ultimaData?.agendado_para,
      motivoLegenda: ultimaLegenda?.decisao === "reprovado" ? ultimaLegenda.motivo : null,
      sugestaoData:
        ultimaData?.decisao === "reprovado" && ultimaData.sugerida_para
          ? { para: ultimaData.sugerida_para, recado: ultimaData.motivo }
          : null,
      postagem: postagemDe.get(c.id)
        ? { estado: postagemDe.get(c.id).estado, permalink: postagemDe.get(c.id).permalink, erro: postagemDe.get(c.id).erro }
        : null,
      versaoId: atual.id,
      numero: atual.numero,
      slides,
      url: atual.expirada
        ? null
        : c.tipo === "carrossel"
          ? (slides?.[0]?.url ?? null)
          : await urlLeitura(c.tipo === "video" && atual.previa_ok ? chavePrevia(atual.r2_key) : atual.r2_key),
      expirada: atual.expirada,
      historico: original.versoes
        .filter((v) => v.decisao === "reprovado" && v.motivo)
        .map((v) => ({ numero: v.numero, motivo: v.motivo as string })),
    };
  }

  const [itensTopo, itensAprovados] = await Promise.all([
    Promise.all(topo.map(paraItem)),
    Promise.all(aprovados.map(paraItem)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/conteudos" className="text-xs text-slate-500 hover:underline">
          ← Conteúdos
        </Link>
        <h1 className="text-xl font-semibold text-navy-900">{cliente.empresa}</h1>
      </div>

      <LinkCliente clienteId={cliente.id} token={cliente.link_token} />
      <GrupoCliente
        clienteId={cliente.id}
        atualId={cliente.whatsapp_grupo_id}
        atualNome={cliente.whatsapp_grupo_nome}
      />
      <ConectarInstagram
        clienteId={cliente.id}
        conta={contaIg}
        podeConectar={admin}
        resultado={searchParams.ig ? { ok: searchParams.ig === "ok", msg: searchParams.msg } : null}
      />
      <ConteudoUpload clienteId={cliente.id} />

      <ConteudosGrade clienteId={cliente.id} topo={itensTopo} aprovados={itensAprovados} />
    </div>
  );
}
