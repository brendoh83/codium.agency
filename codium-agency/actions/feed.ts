"use server";

import { createPublicClient } from "@/lib/supabase/publico";
import { mensagemErro } from "@/lib/conteudos";

export async function responderVersao(
  token: string,
  versaoId: string,
  decisao: "aprovado" | "reprovado",
  motivo: string | null
): Promise<{ erro?: string }> {
  const { error } = await createPublicClient().rpc("responder_versao", {
    p_token: token,
    p_versao_id: versaoId,
    p_decisao: decisao,
    p_motivo: motivo,
  });
  return error ? { erro: mensagemErro(error.message) } : {};
}
