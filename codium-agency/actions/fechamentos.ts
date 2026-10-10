"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { firstDayOfMonth } from "@/lib/format";

/** Fecha (ou refaz o fechamento de) um mês, congelando os números de v_financeiro_mes em fechamentos_mensais. */
export async function fecharMes(mes: string) {
  const supabase = createClient();
  const mesData = mes.length === 7 ? `${mes}-01` : mes;

  // mês em andamento (ou futuro) ainda não pode ser fechado
  if (mesData >= firstDayOfMonth()) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: resumo } = await supabase
    .from("v_financeiro_mes")
    .select("*")
    .eq("mes", mesData)
    .maybeSingle();

  const [{ data: divisao }, { data: caixa }] = await Promise.all([
    supabase.from("v_divisao_mes").select("*").eq("mes", mesData).maybeSingle(),
    supabase.from("v_caixa_mes").select("*").eq("mes", mesData).maybeSingle(),
  ]);

  const zerado = {
    faturamento_total: 0,
    total_recebido: 0,
    total_brendo: 0,
    total_victor: 0,
    total_caixa: 0,
    despesas_fixas: 0,
    despesas_variaveis: 0,
    despesas_totais: 0,
    saldo_caixa: 0,
  };

  await supabase.from("fechamentos_mensais").upsert(
    {
      mes: mesData,
      faturamento_total: resumo?.faturamento_total ?? zerado.faturamento_total,
      total_recebido: resumo?.total_recebido ?? zerado.total_recebido,
      total_brendo: resumo?.total_brendo ?? zerado.total_brendo,
      total_victor: resumo?.total_victor ?? zerado.total_victor,
      total_caixa: resumo?.total_caixa ?? zerado.total_caixa,
      despesas_fixas: resumo?.despesas_fixas ?? zerado.despesas_fixas,
      despesas_variaveis: resumo?.despesas_variaveis ?? zerado.despesas_variaveis,
      despesas_totais: resumo?.despesas_totais ?? zerado.despesas_totais,
      saldo_caixa: resumo?.saldo_caixa ?? zerado.saldo_caixa,
      devido_brendo: divisao?.devido_brendo ?? 0,
      devido_victor: divisao?.devido_victor ?? 0,
      devido_caixa: divisao?.devido_caixa ?? 0,
      repassado_brendo: divisao?.repassado_brendo ?? 0,
      repassado_victor: divisao?.repassado_victor ?? 0,
      caixa_saldo_final: caixa?.saldo_final ?? 0,
      fechado_em: new Date().toISOString(),
      fechado_por: user?.id ?? null,
    },
    { onConflict: "mes" }
  );

  revalidatePath("/historico");
  revalidatePath("/dashboard");
}

export async function reabrirMes(mes: string) {
  const supabase = createClient();
  await supabase.from("fechamentos_mensais").delete().eq("mes", mes);
  revalidatePath("/historico");
}
