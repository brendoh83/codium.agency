"use server";

import { revalidatePath } from "next/cache";
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

export async function criarDespesa(formData: FormData) {
  const supabase = createClient();

  const data = str(formData.get("data")) ?? new Date().toISOString().slice(0, 10);
  const mesInformado = str(formData.get("mes_referencia"));
  const mesReferencia = mesInformado ? `${mesInformado}-01` : `${data.slice(0, 7)}-01`;

  await supabase.from("despesas").insert({
    descricao: str(formData.get("descricao")),
    valor: num(formData.get("valor")),
    categoria: str(formData.get("categoria")),
    tipo: str(formData.get("tipo")) ?? "variavel",
    data,
    mes_referencia: mesReferencia,
    observacao: str(formData.get("observacao")),
  });

  revalidatePath("/despesas");
  revalidatePath("/dashboard");
  revalidatePath("/historico");
}

export async function excluirDespesa(despesaId: string) {
  const supabase = createClient();
  await supabase.from("despesas").delete().eq("id", despesaId);
  revalidatePath("/despesas");
  revalidatePath("/dashboard");
  revalidatePath("/historico");
}
