"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

export async function adicionarEmailPermitido(formData: FormData) {
  const supabase = createClient();
  const email = str(formData.get("email"))?.toLowerCase();
  if (!email) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("emails_permitidos").insert({
    email,
    apelido: str(formData.get("apelido")),
    adicionado_por: user?.id ?? null,
  });

  revalidatePath("/configuracoes");
}

export async function removerEmailPermitido(email: string) {
  const supabase = createClient();
  await supabase.from("emails_permitidos").delete().eq("email", email);
  revalidatePath("/configuracoes");
}
