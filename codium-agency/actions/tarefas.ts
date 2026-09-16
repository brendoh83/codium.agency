"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

export async function criarTarefa(formData: FormData) {
  const supabase = createClient();
  await supabase.from("tarefas").insert({
    cliente_id: str(formData.get("cliente_id")),
    titulo: str(formData.get("titulo")),
    descricao: str(formData.get("descricao")),
    tipo: str(formData.get("tipo")) ?? "outros",
    data: str(formData.get("data")) ?? new Date().toISOString().slice(0, 10),
    responsavel: str(formData.get("responsavel")),
    status: "a_fazer",
  });
  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  revalidatePath("/alertas");
  if (formData.get("cliente_id")) revalidatePath(`/clientes/${formData.get("cliente_id")}`);
}

export async function atualizarStatusTarefa(tarefaId: string, status: string) {
  const supabase = createClient();
  await supabase.from("tarefas").update({ status }).eq("id", tarefaId);
  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  revalidatePath("/alertas");
}

export async function excluirTarefa(tarefaId: string) {
  const supabase = createClient();
  await supabase.from("tarefas").delete().eq("id", tarefaId);
  revalidatePath("/tarefas");
}
