"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dataFimDoContrato, duracaoTexto, mesesDoForm } from "@/lib/contratos";

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export async function criarContrato(clienteId: string, formData: FormData) {
  const supabase = createClient();
  const meses = mesesDoForm(formData.get("meses"));
  const inicio = str(formData.get("data_inicio")) ?? new Date().toISOString().slice(0, 10);
  await supabase.from("contratos").insert({
    cliente_id: clienteId,
    tipo: str(formData.get("tipo")),
    data_inicio: inicio,
    data_fim: meses ? dataFimDoContrato(inicio, meses) : null,
    duracao: duracaoTexto(meses),
    meses,
    valor: num(formData.get("valor")),
    status: "ativo",
  });
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/contratos");
  revalidatePath("/alertas");
}

export async function encerrarContrato(contratoId: string, clienteId: string) {
  const supabase = createClient();
  await supabase.from("contratos").update({ status: "encerrado" }).eq("id", contratoId);
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/contratos");
}
