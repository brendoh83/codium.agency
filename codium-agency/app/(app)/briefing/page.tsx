import { createClient } from "@/lib/supabase/server";
import BriefingLista from "@/components/BriefingLista";

export const dynamic = "force-dynamic";

export default async function BriefingPage() {
  const supabase = createClient();
  const { data: briefings } = await supabase.rpc("listar_briefings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Briefing Clientes</h1>
        <p className="text-sm text-slate-500">
          Respostas do formulário de briefing enviado aos clientes, atualizado automaticamente.
        </p>
      </div>
      <BriefingLista briefings={briefings ?? []} />
    </div>
  );
}
