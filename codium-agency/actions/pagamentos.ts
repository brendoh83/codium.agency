"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Garante que cada cliente ativo tenha pagamento gerado para os próximos `meses` meses. */
export async function garantirPagamentosFuturos(meses = 3) {
  const supabase = createClient();
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, valor_mensal, dia_pagamento, data_inicio")
    .eq("status", "ativo");

  if (!clientes?.length) return;

  const linhas: any[] = [];
  const hoje = new Date();

  for (const cliente of clientes) {
    const dia = Math.min(Math.max(cliente.dia_pagamento ?? 10, 1), 28);
    for (let i = 0; i < meses; i++) {
      const ref = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const competencia = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-01`;
      const vencimento = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-${String(
        dia
      ).padStart(2, "0")}`;
      linhas.push({
        cliente_id: cliente.id,
        competencia,
        vencimento,
        valor: cliente.valor_mensal,
        status: "pendente",
      });
    }
  }

  if (linhas.length) {
    await supabase
      .from("pagamentos")
      .upsert(linhas, { onConflict: "cliente_id,competencia", ignoreDuplicates: true });
  }
}

/** Calcula a divisão de ganhos (bruto, corte de 10% pro caixa, líquido) para um valor recebido. */
function calcularDivisao(valor: number, pctBrendo: number, pctVictor: number) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const brutoBrendo = round2((valor * pctBrendo) / 100);
  const brutoVictor = round2((valor * pctVictor) / 100);
  const caixaBrendo = round2(brutoBrendo * 0.1);
  const caixaVictor = round2(brutoVictor * 0.1);
  return {
    pct_brendo_aplicado: pctBrendo,
    pct_victor_aplicado: pctVictor,
    bruto_brendo: brutoBrendo,
    bruto_victor: brutoVictor,
    caixa_corte_brendo: caixaBrendo,
    caixa_corte_victor: caixaVictor,
    liquido_brendo: round2(brutoBrendo - caixaBrendo),
    liquido_victor: round2(brutoVictor - caixaVictor),
    caixa_total: round2(caixaBrendo + caixaVictor),
  };
}

export async function marcarPagamentoRecebido(pagamentoId: string, clienteId: string) {
  const supabase = createClient();

  const [{ data: pagamento }, { data: cliente }] = await Promise.all([
    supabase.from("pagamentos").select("valor").eq("id", pagamentoId).single(),
    supabase.from("clientes").select("pct_brendo, pct_victor").eq("id", clienteId).single(),
  ]);

  const divisao = calcularDivisao(
    pagamento?.valor ?? 0,
    cliente?.pct_brendo ?? 50,
    cliente?.pct_victor ?? 50
  );

  await supabase
    .from("pagamentos")
    .update({
      status: "pago",
      data_pagamento: new Date().toISOString().slice(0, 10),
      ...divisao,
    })
    .eq("id", pagamentoId);

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
  revalidatePath("/alertas");
  revalidatePath("/historico");
}

export async function desfazerPagamento(pagamentoId: string, clienteId: string) {
  const supabase = createClient();
  await supabase
    .from("pagamentos")
    .update({
      status: "pendente",
      data_pagamento: null,
      pct_brendo_aplicado: null,
      pct_victor_aplicado: null,
      bruto_brendo: null,
      bruto_victor: null,
      caixa_corte_brendo: null,
      caixa_corte_victor: null,
      liquido_brendo: null,
      liquido_victor: null,
      caixa_total: null,
    })
    .eq("id", pagamentoId);

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
  revalidatePath("/historico");
}
