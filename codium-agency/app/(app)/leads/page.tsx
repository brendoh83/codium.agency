import { createClient } from "@/lib/supabase/server";
import { criarLead } from "@/actions/leads";
import LeadsLista from "@/components/LeadsLista";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = createClient();
  const { data: leads } = await supabase.from("leads").select("*").order("data_entrada", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Leads</h1>
        <p className="text-sm text-slate-500">Potenciais clientes em prospecção</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="mb-3 text-sm font-semibold text-navy-900">Novo lead</h2>
        <form action={criarLead} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input name="nome" placeholder="Nome" required className="input" />
          <input name="empresa" placeholder="Empresa" className="input" />
          <input name="responsavel" placeholder="Responsável" className="input" />
          <input name="whatsapp" placeholder="WhatsApp" className="input" />
          <input name="instagram" placeholder="Instagram" className="input" />
          <input name="cidade" placeholder="Cidade" className="input" />
          <input name="nicho" placeholder="Nicho" className="input" />
          <input name="servico_interesse" placeholder="Serviço de interesse" className="input" />
          <input name="valor_potencial" placeholder="Valor potencial (R$)" className="input" />
          <input name="observacoes" placeholder="Observações" className="input md:col-span-2" />
          <button className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950 md:col-span-4">
            Adicionar lead
          </button>
        </form>
      </div>

      <LeadsLista leads={leads ?? []} />
    </div>
  );
}
