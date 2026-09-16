"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}
function num(v: FormDataEntryValue | null): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function criarLead(formData: FormData) {
  const supabase = createClient();
  await supabase.from("leads").insert({
    nome: str(formData.get("nome")),
    empresa: str(formData.get("empresa")),
    responsavel: str(formData.get("responsavel")),
    whatsapp: str(formData.get("whatsapp")),
    instagram: str(formData.get("instagram")),
    cidade: str(formData.get("cidade")),
    nicho: str(formData.get("nicho")),
    servico_interesse: str(formData.get("servico_interesse")),
    valor_potencial: num(formData.get("valor_potencial")),
    observacoes: str(formData.get("observacoes")),
    status: "novo",
  });
  revalidatePath("/leads");
}

export async function atualizarStatusLead(leadId: string, status: string) {
  const supabase = createClient();
  await supabase.from("leads").update({ status }).eq("id", leadId);
  revalidatePath("/leads");
}

export async function converterLeadEmCliente(leadId: string) {
  const supabase = createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (!lead) throw new Error("Lead não encontrado");

  const { data: cliente, error } = await supabase
    .from("clientes")
    .insert({
      empresa: lead.empresa ?? lead.nome,
      responsavel: lead.responsavel ?? lead.nome,
      whatsapp: lead.whatsapp,
      instagram: lead.instagram,
      cidade: lead.cidade,
      nicho: lead.nicho,
      data_inicio: new Date().toISOString().slice(0, 10),
      status: "ativo",
      valor_mensal: lead.valor_potencial ?? 0,
      dia_pagamento: 10,
      observacoes: lead.observacoes,
    })
    .select("id")
    .single();

  if (error || !cliente) throw new Error(error?.message ?? "Erro ao converter lead");

  await supabase.from("leads").update({ status: "fechado", cliente_id: cliente.id }).eq("id", leadId);

  revalidatePath("/leads");
  revalidatePath("/clientes");
  redirect(`/clientes/${cliente.id}`);
}

export async function excluirLead(leadId: string) {
  const supabase = createClient();
  await supabase.from("leads").delete().eq("id", leadId);
  revalidatePath("/leads");
}
