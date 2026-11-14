"use server";

import { createPublicClient } from "@/lib/supabase/publico";
import { mensagemErro } from "@/lib/conteudos";
import { textoAprovouPartes, textoDecisao, textoDecisaoParte } from "@/lib/avisos";
import type { Parte } from "@/lib/conteudos";
import { enviarTexto } from "@/lib/whatsapp";

async function avisarEquipe(
  supabase: ReturnType<typeof createPublicClient>,
  token: string,
  versaoId: string,
  montarTexto: (d: { empresa: string; titulo: string }) => string
) {
  try {
    const { data } = await supabase.rpc("dados_aviso_decisao", { p_token: token, p_versao_id: versaoId });
    if (!data || !data.grupo_equipe_id) return;
    const texto = montarTexto({ empresa: data.empresa, titulo: data.titulo });
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
  await avisarEquipe(supabase, token, versaoId, (d) => textoDecisao({ ...d, decisao, motivo }));
  return {};
}

/** Resposta por parte (mídia, legenda ou data). `versaoId` só serve para achar o grupo e registrar o aviso. */
export async function responderParte(
  token: string,
  conteudoId: string,
  versaoId: string,
  parte: Parte,
  decisao: "aprovado" | "reprovado",
  motivo: string | null,
  sugeridaPara?: string | null
): Promise<{ erro?: string }> {
  const supabase = createPublicClient();
  const { error } = await supabase.rpc("responder_parte", {
    p_token: token,
    p_conteudo_id: conteudoId,
    p_parte: parte,
    p_decisao: decisao,
    p_motivo: motivo,
    p_sugerida_para: sugeridaPara ?? null,
  });
  if (error) return { erro: mensagemErro(error.message) };
  await avisarEquipe(supabase, token, versaoId, (d) =>
    textoDecisaoParte({ ...d, parte, decisao, motivo, sugeridaPara })
  );
  return {};
}

/** "Aprovar tudo": aprova várias partes e manda UMA mensagem só para a equipe. */
export async function aprovarPartes(
  token: string,
  conteudoId: string,
  versaoId: string,
  partes: Parte[]
): Promise<{ erro?: string }> {
  if (partes.length === 0) return {};
  const supabase = createPublicClient();
  for (const parte of partes) {
    const { error } = await supabase.rpc("responder_parte", {
      p_token: token,
      p_conteudo_id: conteudoId,
      p_parte: parte,
      p_decisao: "aprovado",
      p_motivo: null,
      p_sugerida_para: null,
    });
    if (error) return { erro: mensagemErro(error.message) };
  }
  await avisarEquipe(supabase, token, versaoId, (d) => textoAprovouPartes({ ...d, partes }));
  return {};
}
