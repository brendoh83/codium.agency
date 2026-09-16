import { createClient } from "@/lib/supabase/server";
import { criarTarefa } from "@/actions/tarefas";
import TarefasLista from "@/components/TarefasLista";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const supabase = createClient();
  const [{ data: tarefas }, { data: clientes }] = await Promise.all([
    supabase.from("tarefas").select("*, clientes(empresa)").order("data"),
    supabase.from("clientes").select("id, empresa").eq("status", "ativo").order("empresa"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Tarefas</h1>
        <p className="text-sm text-slate-500">Agenda interna da agência</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-navy-900">Nova tarefa</h2>
        <form action={criarTarefa} className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input name="titulo" placeholder="Título" required className="input md:col-span-2" />
          <select name="cliente_id" className="input">
            <option value="">Sem cliente</option>
            {(clientes ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.empresa}
              </option>
            ))}
          </select>
          <select name="tipo" className="input" defaultValue="outros">
            <option value="reuniao">Reunião</option>
            <option value="entrega">Entrega</option>
            <option value="criativo">Criativo pendente</option>
            <option value="campanha">Campanha para revisar</option>
            <option value="gravacao">Gravação de conteúdo</option>
            <option value="relatorio">Relatório</option>
            <option value="cobranca">Cobrança</option>
            <option value="outros">Outros</option>
          </select>
          <input type="date" name="data" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
          <input name="responsavel" placeholder="Responsável" className="input" />
          <button className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950 md:col-span-6">
            Adicionar tarefa
          </button>
        </form>
      </div>

      <TarefasLista tarefas={tarefas ?? []} />
    </div>
  );
}
