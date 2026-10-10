import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/publico";
import { urlLeitura } from "@/lib/r2";
import { estadoConteudo, separarFeed, versaoAtual, type Conteudo, type Versao } from "@/lib/conteudos";
import FeedCliente, { type ItemFeed } from "@/components/FeedCliente";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conteúdos para aprovação", robots: { index: false, follow: false } };

type VersaoComChave = Versao & { r2_key: string };

export default async function FeedPage({ params }: { params: { token: string } }) {
  const { data } = await createPublicClient().rpc("feed_cliente", { p_token: params.token });
  if (!data) notFound();

  const conteudos = (data.conteudos ?? []) as (Omit<Conteudo, "versoes"> & { versoes: VersaoComChave[] })[];
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
    <main className="mx-auto min-h-screen max-w-xl bg-slate-100 p-4 pb-16">
      <header className="py-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Codium · Conteúdos</div>
        <h1 className="text-xl font-semibold text-navy-900">{data.empresa}</h1>
      </header>
      <FeedCliente token={params.token} topo={itensTopo} aprovados={itensAprovados} />
    </main>
  );
}
