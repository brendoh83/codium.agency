"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function num(v: FormDataEntryValue | null): number {
  if (!v) return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}
function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

function pctDivisao(formData: FormData): { pct_brendo: number; pct_victor: number } {
  const pctBrendo = num(formData.get("pct_brendo"));
  const pctVictorInformado = formData.get("pct_victor");
  // Se só o % do Brendo vier preenchido, o do Victor completa os 100%.
  const pctVictor = pctVictorInformado ? num(pctVictorInformado) : 100 - pctBrendo;
  return { pct_brendo: pctBrendo, pct_victor: pctVictor };
}

export async function criarCliente(formData: FormData) {
  const supabase = createClient();

  const valorMensal = num(formData.get("valor_mensal"));
  const servicoIds = formData.getAll("servicos") as string[];
  const { pct_brendo, pct_victor } = pctDivisao(formData);

  const { data: cliente, error } = await supabase
    .from("clientes")
    .insert({
      empresa: str(formData.get("empresa")),
      responsavel: str(formData.get("responsavel")),
      whatsapp: str(formData.get("whatsapp")),
      instagram: str(formData.get("instagram")),
      cidade: str(formData.get("cidade")),
      nicho: str(formData.get("nicho")),
      data_inicio: str(formData.get("data_inicio")) ?? new Date().toISOString().slice(0, 10),
      status: str(formData.get("status")) ?? "ativo",
      observacoes: str(formData.get("observacoes")),
      plano: str(formData.get("plano")),
      valor_mensal: valorMensal,
      dia_pagamento: formData.get("dia_pagamento") ? Number(formData.get("dia_pagamento")) : 10,
      satisfacao_atual: formData.get("satisfacao_atual")
        ? num(formData.get("satisfacao_atual"))
        : null,
      pct_brendo,
      pct_victor,
    })
    .select("id")
    .single();

  if (error || !cliente) {
    throw new Error(error?.message ?? "Erro ao criar cliente");
  }

  if (servicoIds.length > 0) {
    const somaInformada = servicoIds.reduce(
      (acc, id) => acc + num(formData.get(`valor_servico_${id}`)),
      0
    );
    const usarInformado = somaInformada > 0;
    const valorPorServico = valorMensal / servicoIds.length;

    await supabase.from("cliente_servicos").insert(
      servicoIds.map((servico_id) => ({
        cliente_id: cliente.id,
        servico_id,
        valor_composicao: usarInformado
          ? num(formData.get(`valor_servico_${servico_id}`))
          : Math.round(valorPorServico * 100) / 100,
      }))
    );
  }

  // Contrato inicial
  const duracao = str(formData.get("duracao")) ?? "recorrente";
  const dataFim = str(formData.get("data_fim"));
  await supabase.from("contratos").insert({
    cliente_id: cliente.id,
    tipo: str(formData.get("plano")) ?? "Contrato de prestação de serviços",
    data_inicio: str(formData.get("data_inicio")) ?? new Date().toISOString().slice(0, 10),
    data_fim: duracao === "recorrente" ? null : dataFim,
    duracao: duracao as any,
    valor: valorMensal,
    status: "ativo",
  });

  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  redirect(`/clientes/${cliente.id}`);
}

export async function atualizarCliente(clienteId: string, formData: FormData) {
  const supabase = createClient();
  const valorMensal = num(formData.get("valor_mensal"));
  const { pct_brendo, pct_victor } = pctDivisao(formData);

  await supabase
    .from("clientes")
    .update({
      empresa: str(formData.get("empresa")),
      responsavel: str(formData.get("responsavel")),
      whatsapp: str(formData.get("whatsapp")),
      instagram: str(formData.get("instagram")),
      cidade: str(formData.get("cidade")),
      nicho: str(formData.get("nicho")),
      status: str(formData.get("status")) ?? "ativo",
      observacoes: str(formData.get("observacoes")),
      plano: str(formData.get("plano")),
      valor_mensal: valorMensal,
      dia_pagamento: formData.get("dia_pagamento") ? Number(formData.get("dia_pagamento")) : 10,
      pct_brendo,
      pct_victor,
    })
    .eq("id", clienteId);

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
}

export async function atualizarRelacionamento(clienteId: string, formData: FormData) {
  const supabase = createClient();
  await supabase
    .from("clientes")
    .update({
      satisfacao_atual: formData.get("satisfacao_atual")
        ? num(formData.get("satisfacao_atual"))
        : null,
      ultimo_contato: str(formData.get("ultimo_contato")),
      ultima_reuniao: str(formData.get("ultima_reuniao")),
      proxima_reuniao: str(formData.get("proxima_reuniao")),
      temperatura: str(formData.get("temperatura")) ?? "saudavel",
      observacoes_relacionamento: str(formData.get("observacoes_relacionamento")),
      resultado_campanha_nota: formData.get("resultado_campanha_nota")
        ? num(formData.get("resultado_campanha_nota"))
        : null,
    })
    .eq("id", clienteId);

  const satisfacao = formData.get("satisfacao_atual");
  if (satisfacao) {
    const competencia = new Date();
    const comp = `${competencia.getFullYear()}-${String(competencia.getMonth() + 1).padStart(
      2,
      "0"
    )}-01`;
    await supabase
      .from("satisfacao_historico")
      .upsert(
        { cliente_id: clienteId, competencia: comp, nota: num(satisfacao) },
        { onConflict: "cliente_id,competencia" }
      );
  }

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/dashboard");
}

export async function atualizarServicosCliente(clienteId: string, formData: FormData) {
  const supabase = createClient();
  const { data: servicos } = await supabase.from("servicos").select("id");
  const servicoIds = formData.getAll("servicos") as string[];

  await supabase.from("cliente_servicos").delete().eq("cliente_id", clienteId);

  if (servicoIds.length > 0) {
    await supabase.from("cliente_servicos").insert(
      servicoIds.map((servico_id) => ({
        cliente_id: clienteId,
        servico_id,
        valor_composicao: num(formData.get(`valor_servico_${servico_id}`)),
      }))
    );
  }

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/metricas");
  revalidatePath("/dashboard");
}

export async function excluirCliente(clienteId: string) {
  const supabase = createClient();
  await supabase.from("clientes").delete().eq("id", clienteId);
  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function registrarEventoSaude(clienteId: string, formData: FormData) {
  const supabase = createClient();
  await supabase.from("saude_eventos").insert({
    cliente_id: clienteId,
    tipo: str(formData.get("tipo")) ?? "outro",
    descricao: str(formData.get("descricao")),
    data: str(formData.get("data")) ?? new Date().toISOString().slice(0, 10),
  });
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/dashboard");
}

export async function resolverEventoSaude(clienteId: string, eventoId: string) {
  const supabase = createClient();
  await supabase.from("saude_eventos").update({ resolvido: true }).eq("id", eventoId);
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/dashboard");
}
