import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NIVEL_STYLE: Record<string, string> = {
  critico: "border-danger/30 bg-danger/5",
  atencao: "border-warn/30 bg-warn/5",
  positivo: "border-ok/30 bg-ok/5",
};
const NIVEL_DOT: Record<string, string> = {
  critico: "bg-danger",
  atencao: "bg-warn",
  positivo: "bg-ok",
};
const TIPO_LABEL: Record<string, string> = {
  pagamento_atrasado: "Pagamento atrasado",
  pagamento_proximo: "Pagamento próximo",
  pagamento_recebido: "Pagamento recebido",
  satisfacao_baixa: "Satisfação baixa",
  saude_atencao: "Saúde em atenção",
  saude_risco: "Saúde em risco",
  contrato_vencendo: "Contrato vencendo",
  contrato_vencido: "Contrato vencido",
  tarefa_atrasada: "Tarefa atrasada",
};

export default async function AlertasPage() {
  const supabase = createClient();
  const { data: alertas } = await supabase.from("v_alertas").select("*").order("nivel");

  const criticos = (alertas ?? []).filter((a: any) => a.nivel === "critico");
  const atencao = (alertas ?? []).filter((a: any) => a.nivel === "atencao");
  const positivos = (alertas ?? []).filter((a: any) => a.nivel === "positivo");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-900">Central de Alertas</h1>
        <p className="text-sm text-slate-500">
          {criticos.length} crítico(s) · {atencao.length} em atenção · {positivos.length} recentes
        </p>
      </div>

      <div className="space-y-2">
        {[...criticos, ...atencao, ...positivos].map((a: any, i: number) => (
          <Link
            key={i}
            href={a.cliente_id ? `/clientes/${a.cliente_id}` : "#"}
            className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-sm hover:brightness-95 ${NIVEL_STYLE[a.nivel]}`}
          >
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${NIVEL_DOT[a.nivel]}`} />
              <div>
                <div className="font-medium text-navy-900">{a.mensagem}</div>
                <div className="text-xs text-slate-400">{TIPO_LABEL[a.tipo] ?? a.tipo}</div>
              </div>
            </div>
          </Link>
        ))}
        {(alertas ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            Nenhum alerta no momento. Tudo sob controle. 🎉
          </p>
        )}
      </div>
    </div>
  );
}
