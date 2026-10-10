"use server";

import { createPublicClient } from "@/lib/supabase/publico";
import { mensagemErro } from "@/lib/conteudos";
import { textoDecisao } from "@/lib/avisos";
import { enviarTexto } from "@/lib/whatsapp";

async function avisarEquipe(
  supabase: ReturnType<typeof createPublicClient>,
  token: string,
  versaoId: string,
  decisao: "aprovado" | "reprovado",
  motivo: string | null
) {
  try {
    const { data } = await supabase.rpc("dados_aviso_decisao", { p_token: token, p_versao_id: versaoId });
    if (!data || !data.grupo_equipe_id) return;
    const texto = textoDecisao({ empresa: data.empresa, titulo: data.titulo, decisao, motivo });
    let ok = true;
    let erro: string | null = null;
    try {
      await enviarTexto(data.instancia, data.grupo_equipe_id, texto);
    } catch (e) {
      ok = false;
      erro = e instanceof Error ? e.message : String(e);
    }
    await supabase.rpc("registrar_aviso", {
      p_token: token,
      p_versao_id: versaoId,
      p_destino: data.grupo_equipe_id,
      p_texto: texto,
      p_ok: ok,
      p_erro: erro,
    });
  } catch {
    /* aviso é melhor esforço: a decisão do cliente já foi gravada */
  }
}

export async function responderVersao(
  token: string,
  versaoId: string,
  decisao: "aprovado" | "reprovado",
  motivo: string | null
): Promise<{ erro?: string }> {
  const supabase = createPublicClient();
  const { error } = await supabase.rpc("responder_versao", {
    p_token: token,
    p_versao_id: versaoId,
    p_decisao: decisao,
    p_motivo: motivo,
  });
  if (error) return { erro: mensagemErro(error.message) };
  await avisarEquipe(supabase, token, versaoId, decisao, motivo);
  return {};
}
