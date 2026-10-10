"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { faltaNoCaixa, mesesDaSerie, validarCobertura, vencimentoDoMes } from "@/lib/despesas";
import { firstDayOfMonth, shiftMonth } from "@/lib/format";
import type { Socio } from "@/lib/divisao";

type Resultado = { erro?: string };
const HORIZONTE_MESES = 6;

function aposTrocar() {
  revalidatePath("/despesas");
  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
  revalidatePath("/historico");
  revalidatePath("/alertas");
}

/** Gera as ocorrências mensais que faltam para os modelos (fixa: até o horizonte; variável: seu período). */
export async function garantirDespesasRecorrentes(horizonte = HORIZONTE_MESES) {
  const supabase = createClient();
  const { data: modelos } = await supabase.from("despesa_modelos").select("*");
  if (!modelos?.length) return;

  const ate = shiftMonth(firstDayOfMonth(), horizonte);
  const { data: existentes } = await supabase
    .from("despesas")
    .select("modelo_id, mes_referencia")
    .in("modelo_id", modelos.map((m: any) => m.id));
  const jaTem = new Set((existentes ?? []).map((e: any) => `${e.modelo_id}|${e.mes_referencia}`));

  const novas: any[] = [];
  for (const m of modelos as any[]) {
    for (const mes of mesesDaSerie({ inicio: m.mes_inicio, tipo: m.tipo, meses: m.meses, ate })) {
      if (jaTem.has(`${m.id}|${mes}`)) continue;
      const venc = vencimentoDoMes(mes, m.dia_vencimento);
      novas.push({
        modelo_id: m.id,
        descricao: m.descricao,
        categoria: m.categoria,
        tipo: m.tipo,
        valor: m.valor,
        data: venc,
        mes_referencia: mes,
        vencimento: venc,
        pago: false,
      });
    }
  }
  if (novas.length) await supabase.from("despesas").insert(novas);
}

export async function criarDespesa(i: {
  descricao: string;
  valor: number;
  categoria: string;
  tipo: "fixa" | "variavel";
  diaVencimento: number;
  mesInicio: string; // YYYY-MM
  meses: number | null; // só variável
}): Promise<Resultado> {
  const descricao = i.descricao.trim();
  if (!descricao) return { erro: "Informe a descrição." };
  if (!(i.valor > 0)) return { erro: "Informe um valor maior que zero." };
  if (i.tipo !== "fixa" && i.tipo !== "variavel") return { erro: "Tipo inválido." };
  if (!Number.isInteger(i.diaVencimento) || i.diaVencimento < 1 || i.diaVencimento > 31) {
    return { erro: "O dia de vencimento deve ser de 1 a 31." };
  }
  if (!/^\d{4}-\d{2}$/.test(i.mesInicio)) return { erro: "Informe o mês de início." };
  const meses = i.tipo === "variavel" ? Math.floor(i.meses ?? 0) : null;
  if (i.tipo === "variavel" && (!meses || meses < 1 || meses > 60)) {
    return { erro: "Informe por quantos meses (de 1 a 60)." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("despesa_modelos").insert({
    descricao,
    categoria: i.categoria.trim() || null,
    tipo: i.tipo,
    valor: Math.round(i.valor * 100) / 100,
    dia_vencimento: i.diaVencimento,
    mes_inicio: `${i.mesInicio}-01`,
    meses,
  });
  if (error) return { erro: "Não foi possível cadastrar a despesa." };

  // variável cadastrada para vários meses à frente precisa do horizonte inteiro
  await garantirDespesasRecorrentes(Math.max(HORIZONTE_MESES, meses ?? 0, 12));
  aposTrocar();
  return {};
}

export async function alterarValorDaqueParaFrente(modeloId: string, novoValor: number): Promise<Resultado> {
  if (!(novoValor > 0)) return { erro: "Informe um valor maior que zero." };
  const valor = Math.round(novoValor * 100) / 100;
  const supabase = createClient();
  const { error } = await supabase.from("despesa_modelos").update({ valor }).eq("id", modeloId);
  if (error) return { erro: "Não foi possível alterar o valor." };
  await supabase
    .from("despesas")
    .update({ valor })
    .eq("modelo_id", modeloId)
    .eq("pago", false)
    .gte("mes_referencia", firstDayOfMonth());
  aposTrocar();
  return {};
}

export async function excluirDaquiParaFrente(modeloId: string): Promise<Resultado> {
  const supabase = createClient();
  await supabase
    .from("despesas")
    .delete()
    .eq("modelo_id", modeloId)
    .eq("pago", false)
    .gte("mes_referencia", firstDayOfMonth());
  const { error } = await supabase.from("despesa_modelos").delete().eq("id", modeloId);
  if (error) return { erro: "Não foi possível excluir a despesa." };
  aposTrocar();
  return {};
}

export async function excluirOcorrencia(despesaId: string): Promise<Resultado> {
  const supabase = createClient();
  const { error } = await supabase.from("despesas").delete().eq("id", despesaId);
  if (error) return { erro: "Não foi possível excluir." };
  aposTrocar();
  return {};
}

export async function marcarDespesaPaga(i: {
  despesaId: string;
  data?: string;
  coberturas?: { socio: Socio; valor: number }[];
}): Promise<Resultado & { precisaCobertura?: { falta: number; disponivel: number } }> {
  const supabase = createClient();
  const { data: d } = await supabase
    .from("despesas")
    .select("id, valor, mes_referencia, pago")
    .eq("id", i.despesaId)
    .maybeSingle();
  if (!d) return { erro: "Despesa não encontrada." };
  if (d.pago) return { erro: "Esta despesa já está paga." };

  const { data: caixa } = await supabase
    .from("v_caixa_mes")
    .select("saldo_final")
    .eq("mes", d.mes_referencia)
    .maybeSingle();
  const disponivel = Number(caixa?.saldo_final ?? 0);
  const valor = Number(d.valor);
  const falta = faltaNoCaixa(valor, disponivel);

  const coberturas = (i.coberturas ?? []).filter((c) => c.valor > 0);
  if (falta > 0) {
    if (coberturas.length === 0) return { precisaCobertura: { falta, disponivel } };
    const problema = validarCobertura(falta, coberturas);
    if (problema) return { erro: problema };
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const data = i.data && /^\d{4}-\d{2}-\d{2}$/.test(i.data) && i.data <= hoje ? i.data : hoje;

  const { error } = await supabase
    .from("despesas")
    .update({ pago: true, data_pagamento: data })
    .eq("id", d.id)
    .eq("pago", false);
  if (error) return { erro: "Não foi possível marcar como paga." };

  if (falta > 0) {
    const { error: erroCob } = await supabase
      .from("despesa_coberturas")
      .insert(coberturas.map((c) => ({ despesa_id: d.id, socio: c.socio, valor: c.valor })));
    if (erroCob) {
      await supabase.from("despesas").update({ pago: false, data_pagamento: null }).eq("id", d.id);
      return { erro: "Não foi possível gravar quem cobriu a diferença." };
    }
  }
  aposTrocar();
  return {};
}

export async function desfazerDespesaPaga(despesaId: string): Promise<Resultado> {
  const supabase = createClient();
  await supabase.from("despesa_coberturas").delete().eq("despesa_id", despesaId);
  const { error } = await supabase
    .from("despesas")
    .update({ pago: false, data_pagamento: null })
    .eq("id", despesaId);
  if (error) return { erro: "Não foi possível desfazer." };
  aposTrocar();
  return {};
}

