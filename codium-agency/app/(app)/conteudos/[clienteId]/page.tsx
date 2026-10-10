import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { urlLeitura } from "@/lib/r2";
import { estadoConteudo, separarFeed, versaoAtual, type Conteudo, type Versao } from "@/lib/conteudos";
import ConteudoUpload from "@/components/ConteudoUpload";
import ConteudosGrade from "@/components/ConteudosGrade";
import LinkCliente from "@/components/LinkCliente";
import GrupoCliente from "@/components/GrupoCliente";
import type { ItemFeed } from "@/components/FeedCliente";

export const dynamic = "force-dynamic";

type VersaoComChave = Versao & { r2_key: string };
type Item = Omit<Conteudo, "versoes"> & { versoes: VersaoComChave[] };

export default async function ConteudosClientePage({ params }: { params: { clienteId: string } }) {
  const supabase = createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, empresa, link_token, whatsapp_grupo_id, whatsapp_grupo_nome")
    .eq("id", params.clienteId)
    .maybeSingle();
  if (!cliente) notFound();

  const { data: conteudos } = await supabase
    .from("conteudos")
    .select(
      "id, titulo, tipo, created_at, conteudo_versoes(id, numero, r2_key, mime, created_at, expira_em, decisao, motivo, decidido_em)"
    )
    .eq("cliente_id", cliente.id)
    .order("created_at", { ascending: false });

  const itens: Item[] = (conteudos ?? [])
    .map((c: any) => ({
      id: c.id,
      titulo: c.titulo,
      tipo: c.tipo,
      created_at: c.created_at,
      versoes: ((c.conteudo_versoes ?? []) as any[])
        .map((v) => ({ ...v, expirada: new Date(v.expira_em) < new Date() }))
        .sort((a, b) => a.numero - b.numero) as VersaoComChave[],
    }))
    .filter((c) => c.versoes.length > 0);

  const { topo, aprovados } = separarFeed(itens as unknown as Conteudo[]);
  const porId = new Map(itens.map((c) => [c.id, c]));

  async function paraItem(c: Conteudo): Promise<ItemFeed> {
    const original = porId.get(c.id)!;
    const atual = versaoAtual(original) as VersaoComChave;
    return {
      id: c.id,
      titulo: c.titulo,
      tipo: c.tipo,
      estado: estadoConteudo(original),
      versaoId: atual.id,
      numero: atual.numero,
      url: !atual.expirada ? await urlLeitura(atual.r2_key) : null,
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
      <ConteudoUpload clienteId={cliente.id} />

      <ConteudosGrade clienteId={cliente.id} topo={itensTopo} aprovados={itensAprovados} />
    </div>
  );
}
