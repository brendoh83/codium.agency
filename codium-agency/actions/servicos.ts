"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarServico(formData: FormData) {
  const supabase = createClient();
  const nome = (formData.get("nome") ?? "").toString().trim();
  if (!nome) return;
  await supabase.from("servicos").insert({ nome });
  revalidatePath("/configuracoes");
  revalidatePath("/clientes/novo");
}

export async function alternarServico(servicoId: string, ativo: boolean) {
  const supabase = createClient();
  await supabase.from("servicos").update({ ativo }).eq("id", servicoId);
  revalidatePath("/configuracoes");
  revalidatePath("/clientes/novo");
}
