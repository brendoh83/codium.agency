import { createClient } from "@/lib/supabase/server";
import { criarCliente } from "@/actions/clientes";
import ClienteForm from "@/components/ClienteForm";

export default async function NovoClientePage() {
  const supabase = createClient();
  const { data: servicos } = await supabase.from("servicos").select("*").eq("ativo", true).order("nome");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Novo Cliente</h1>
        <p className="text-sm text-slate-500">Cadastre um novo cliente da agência</p>
      </div>
      <ClienteForm servicos={servicos ?? []} action={criarCliente} />
    </div>
  );
}
