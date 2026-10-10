import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { estadoConteudo } from "@/lib/conteudos";

export const dynamic = "force-dynamic";

export default async function ConteudosPage() {
  const supabase = createClient();
  const [{ data: clientes }, { data: conteudos }] = await Promise.all([
    supabase.from("clientes").select("id, empresa, status").order("empresa"),
    supabase.from("conteudos").select("id, cliente_id, conteudo_versoes(numero, decisao)"),
  ]);

  const abertosPorCliente = new Map<string, number>();
  for (const c of conteudos ?? []) {
    const versoes = ((c as any).conteudo_versoes ?? []) as any[];
    if (estadoConteudo({ versoes }) !== "aprovado") {
      abertosPorCliente.set(c.cliente_id, (abertosPorCliente.get(c.cliente_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Conteúdos</h1>
        <p className="text-sm text-slate-500">Escolha um cliente para enviar e acompanhar conteúdos.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(clientes ?? []).map((c: any) => (
          <Link
            key={c.id}
            href={`/conteudos/${c.id}`}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-card hover:bg-slate-50"
          >
            <span className="font-medium text-navy-900">{c.empresa}</span>
            {(abertosPorCliente.get(c.id) ?? 0) > 0 && (
              <span className="rounded-full bg-warn/10 px-2 py-1 text-xs font-medium text-warn">
                {abertosPorCliente.get(c.id)} aguardando
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
