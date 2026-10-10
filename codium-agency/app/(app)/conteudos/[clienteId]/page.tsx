import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { urlLeitura } from "@/lib/r2";
import { estadoConteudo, versaoAtual, type Versao } from "@/lib/conteudos";
import ConteudoUpload from "@/components/ConteudoUpload";
import LinkCliente from "@/components/LinkCliente";

export const dynamic = "force-dynamic";

const ESTADO = {
  pendente: { texto: "Aguardando aprovação", cls: "bg-warn/10 text-warn" },
  reprovado: { texto: "Reprovado", cls: "bg-danger/10 text-danger" },
  aprovado: { texto: "Aprovado", cls: "bg-ok/10 text-ok" },
} as const;

type VersaoComChave = Versao & { r2_key: string };

export default async function ConteudosClientePage({ params }: { params: { clienteId: string } }) {
  const supabase = createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, empresa, link_token")
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

  const itens = await Promise.all(
    (conteudos ?? []).map(async (c: any) => {
      const versoes: VersaoComChave[] = (c.conteudo_versoes ?? [])
        .map((v: any) => ({ ...v, expirada: new Date(v.expira_em) < new Date() }))
        .sort((a: any, b: any) => a.numero - b.numero);
      const atual = versaoAtual({ versoes }) as VersaoComChave | undefined;
      const url = atual && !atual.expirada ? await urlLeitura(atual.r2_key) : null;
      return { ...c, versoes, atual, url, estado: estadoConteudo({ versoes }) };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/conteudos" className="text-xs text-slate-500 hover:underline">
          ← Conteúdos
        </Link>
        <h1 className="text-xl font-semibold text-navy-900">{cliente.empresa}</h1>
      </div>

      <LinkCliente clienteId={cliente.id} token={cliente.link_token} />
      <ConteudoUpload clienteId={cliente.id} />

      <div className="space-y-4">
        {itens.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            Nenhum conteúdo enviado ainda.
          </p>
        )}
        {itens.map((c) => (
          <div key={c.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-navy-900">{c.titulo}</div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO[c.estado as keyof typeof ESTADO].cls}`}>
                {ESTADO[c.estado as keyof typeof ESTADO].texto} · v{c.atual?.numero}
              </span>
            </div>

            {c.url ? (
              c.tipo === "imagem" ? (
                <img src={c.url} alt={c.titulo} className="max-h-96 rounded-lg" />
              ) : (
                <video src={c.url} controls playsInline preload="metadata" className="max-h-96 w-full rounded-lg bg-black" />
              )
            ) : (
              <p className="rounded-lg bg-slate-100 p-6 text-center text-sm text-slate-500">Arquivo expirado</p>
            )}

            {c.versoes.some((v: Versao) => v.decisao === "reprovado") && (
              <ul className="space-y-1 text-sm text-slate-600">
                {c.versoes
                  .filter((v: Versao) => v.decisao === "reprovado")
                  .map((v: Versao) => (
                    <li key={v.id}>
                      <span className="font-medium">v{v.numero} reprovada:</span> {v.motivo}
                    </li>
                  ))}
              </ul>
            )}

            {c.estado === "reprovado" && <ConteudoUpload clienteId={cliente.id} conteudoId={c.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}
