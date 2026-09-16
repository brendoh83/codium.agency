"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  const duracao = str(formData.get("duracao")) ?? "recorrente";
  await supabase.from("contratos").insert({
    cliente_id: clienteId,
    tipo: str(formData.get("tipo")),
    data_inicio: str(formData.get("data_inicio")) ?? new Date().toISOString().slice(0, 10),
    data_fim: duracao === "recorrente" ? null : str(formData.get("data_fim")),
    duracao,
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
