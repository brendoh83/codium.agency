import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/publico";
import { urlLeitura } from "@/lib/r2";
import { comVersoes, estadoConteudo, separarFeed, versaoAtual, type Conteudo, type Versao } from "@/lib/conteudos";
import FeedCliente, { type ItemFeed } from "@/components/FeedCliente";
import { AberturaCliente } from "@/components/AberturaCliente";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conteúdos para aprovação", robots: { index: false, follow: false } };

type VersaoComChave = Versao & { r2_key: string };

export default async function FeedPage({ params }: { params: { token: string } }) {
  const { data } = await createPublicClient().rpc("feed_cliente", { p_token: params.token });
  if (!data) notFound();

  const conteudos = comVersoes(
    (data.conteudos ?? []) as (Omit<Conteudo, "versoes"> & { versoes: VersaoComChave[] })[]
  );
  const { topo, aprovados } = separarFeed(conteudos as unknown as Conteudo[]);
  const porId = new Map(conteudos.map((c) => [c.id, c]));

  async function paraItem(c: Conteudo): Promise<ItemFeed> {
    const original = porId.get(c.id)!;
    const atual = versaoAtual(original) as VersaoComChave;
    const url = atual && !atual.expirada ? await urlLeitura(atual.r2_key) : null;
    return {
      id: c.id,
      titulo: c.titulo,
      tipo: c.tipo,
      estado: estadoConteudo(original),
      versaoId: atual.id,
      numero: atual.numero,
      url,
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
    <main className="mx-auto max-w-xl overflow-x-clip px-4 pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <AberturaCliente
        empresa={data.empresa}
        aguardando={itensTopo.filter((i) => i.estado === "pendente").length}
        aprovados={itensAprovados.length}
      />
      <FeedCliente token={params.token} topo={itensTopo} aprovados={itensAprovados} />
    </main>
  );
}
