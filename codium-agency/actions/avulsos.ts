"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { competenciaDe, validarParcelas } from "@/lib/avulsos";

type Resultado = { erro?: string };

function aposTrocar() {
  revalidatePath("/avulsos");
  revalidatePath("/dashboard");
  revalidatePath("/alertas");
  revalidatePath("/historico");
}

export async function criarServicoAvulso(i: {
  clienteId: string | null;
  empresaExterna: string;
  descricao: string;
  forma: "avista" | "parcelado";
  valorTotal: number;
  parcelas: { valor: number; vencimento: string }[];
}): Promise<Resultado> {
  const descricao = i.descricao.trim();
  const empresa = i.empresaExterna.trim();
  if (!descricao) return { erro: "Descreva o serviço." };
  if (!i.clienteId && !empresa) return { erro: "Escolha um cliente ou informe a empresa." };
  if (i.forma !== "avista" && i.forma !== "parcelado") return { erro: "Forma de pagamento inválida." };
  if (!(i.valorTotal > 0)) return { erro: "Informe o valor total." };
  if (i.forma === "avista" && i.parcelas.length !== 1) return { erro: "À vista tem uma única data." };
  const problema = validarParcelas(i.valorTotal, i.parcelas);
  if (problema) return { erro: problema };

  const supabase = createClient();
  const { data: servico, error } = await supabase
    .from("servicos_avulsos")
    .insert({
      cliente_id: i.clienteId || null,
      empresa_externa: i.clienteId ? null : empresa,
      descricao,
      forma: i.forma,
      valor_total: i.valorTotal,
    })
    .select("id")
    .single();
  if (error || !servico) return { erro: "Não foi possível criar o serviço." };

  const { error: erroParcelas } = await supabase.from("servico_parcelas").insert(
    i.parcelas.map((p, idx) => ({
      servico_id: servico.id,
      numero: idx + 1,
      valor: p.valor,
      vencimento: p.vencimento,
      competencia: competenciaDe(p.vencimento),
    }))
  );
  if (erroParcelas) {
    await supabase.from("servicos_avulsos").delete().eq("id", servico.id);
    return { erro: "Não foi possível criar as parcelas." };
  }
  aposTrocar();
  return {};
}

export async function marcarParcelaRecebida(parcelaId: string, dataPagamento?: string): Promise<Resultado> {
  const hoje = new Date().toISOString().slice(0, 10);
  const data =
    dataPagamento && /^\d{4}-\d{2}-\d{2}$/.test(dataPagamento) && dataPagamento <= hoje ? dataPagamento : hoje;
  const supabase = createClient();
  const { error } = await supabase
    .from("servico_parcelas")
    .update({ status: "pago", data_pagamento: data })
    .eq("id", parcelaId);
  if (error) return { erro: "Não foi possível marcar como recebida." };
  aposTrocar();
  return {};
}

export async function desfazerParcela(parcelaId: string): Promise<Resultado> {
  const supabase = createClient();
  const { error } = await supabase
    .from("servico_parcelas")
    .update({ status: "pendente", data_pagamento: null })
    .eq("id", parcelaId);
  if (error) return { erro: "Não foi possível desfazer." };
  aposTrocar();
  return {};
}

export async function excluirServicoAvulso(servicoId: string): Promise<Resultado> {
  const supabase = createClient();
  const { error } = await supabase.from("servicos_avulsos").delete().eq("id", servicoId);
  if (error) return { erro: "Não foi possível excluir o serviço." };
  aposTrocar();
  return {};
}
