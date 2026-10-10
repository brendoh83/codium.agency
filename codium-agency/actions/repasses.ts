"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { socioValido } from "@/lib/divisao";

type Resultado = { erro?: string };

function numero(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? "").trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function aposTrocar() {
  revalidatePath("/dashboard");
  revalidatePath("/historico");
}

export async function registrarRepasse(formData: FormData): Promise<Resultado> {
  const socio = String(formData.get("socio") ?? "");
  if (!socioValido(socio)) return { erro: "Escolha o sócio." };

  const valor = Math.round(numero(formData.get("valor")) * 100) / 100;
  if (!(valor > 0)) return { erro: "Informe um valor maior que zero." };

  const mes = String(formData.get("mes_referencia") ?? "");
  if (!/^\d{4}-\d{2}$/.test(mes)) return { erro: "Informe o mês de referência." };

  const dataStr = String(formData.get("data") ?? "");
  const hoje = new Date().toISOString().slice(0, 10);
  const data = /^\d{4}-\d{2}-\d{2}$/.test(dataStr) ? dataStr : hoje;

  const observacao = String(formData.get("observacao") ?? "").trim().slice(0, 300) || null;

  const supabase = createClient();
  const { error } = await supabase
    .from("repasses")
    .insert({ socio, mes_referencia: `${mes}-01`, valor, data, observacao });
  if (error) return { erro: "Não foi possível registrar o repasse." };
  aposTrocar();
  return {};
}

export async function excluirRepasse(repasseId: string): Promise<Resultado> {
  const supabase = createClient();
  const { error } = await supabase.from("repasses").delete().eq("id", repasseId);
  if (error) return { erro: "Não foi possível excluir o repasse." };
  aposTrocar();
  return {};
}
