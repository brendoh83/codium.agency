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
  despesa_atrasada: "Despesa atrasada",
  despesa_proxima: "Despesa próxima do vencimento",
  avulso_atrasado: "Parcela de avulso atrasada",
  avulso_proximo: "Parcela de avulso próxima",
  postagem_falhou: "Postagem falhou",
  postagem_perdeu_horario: "Postagem perdeu o horário",
  instagram_reconectar: "Instagram desconectado",
  instagram_vence: "Instagram vence em breve",
};

export default async function AlertasPage() {
  const supabase = createClient();
  const { data: alertas } = await supabase.from("v_alertas").select("*").order("nivel");

  // Instagram: postagens com problema e contas que precisam reconectar (não passam pela view financeira)
  const { data: postProblema } = await supabase
    .from("postagens")
    .select("cliente_id, estado, clientes(empresa), conteudos(titulo)")
    .in("estado", ["falhou", "perdeu_horario"]);
  const { data: contasIg } = await supabase
    .from("instagram_contas")
    .select("cliente_id, status, token_expira_em, clientes(empresa)");
  const em10dias = Date.now() + 10 * 86_400_000;
  const extras: any[] = [
    ...(postProblema ?? []).map((p: any) => ({
      nivel: "critico",
      tipo: p.estado === "falhou" ? "postagem_falhou" : "postagem_perdeu_horario",
      cliente_id: p.cliente_id,
      href: `/conteudos/${p.cliente_id}`,
      mensagem:
        p.estado === "falhou"
          ? `${p.clientes?.empresa}: falhou ao postar «${p.conteudos?.titulo}»`
          : `${p.clientes?.empresa}: «${p.conteudos?.titulo}» perdeu o horário`,
    })),
    ...(contasIg ?? [])
      .filter((c: any) => c.status === "reconectar" || new Date(c.token_expira_em).getTime() < em10dias)
      .map((c: any) => ({
        nivel: c.status === "reconectar" ? "critico" : "atencao",
        tipo: c.status === "reconectar" ? "instagram_reconectar" : "instagram_vence",
        cliente_id: c.cliente_id,
        href: `/conteudos/${c.cliente_id}`,
        mensagem:
          c.status === "reconectar"
            ? `${c.clientes?.empresa}: reconecte o Instagram`
            : `${c.clientes?.empresa}: conexão do Instagram vence em breve`,
      })),
  ];
  const todos = [...(alertas ?? []), ...extras];

  const criticos = todos.filter((a: any) => a.nivel === "critico");
  const atencao = todos.filter((a: any) => a.nivel === "atencao");
  const positivos = todos.filter((a: any) => a.nivel === "positivo");

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
            href={a.href ?? (a.cliente_id ? `/clientes/${a.cliente_id}` : String(a.tipo).startsWith("despesa") ? "/despesas" : String(a.tipo).startsWith("avulso") ? "/avulsos" : "#")}
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
        {todos.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
            Nenhum alerta no momento. Tudo sob controle. 🎉
          </p>
        )}
      </div>
    </div>
  );
}
