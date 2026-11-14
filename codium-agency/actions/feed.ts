"use server";

import { createPublicClient } from "@/lib/supabase/publico";
import { mensagemErro } from "@/lib/conteudos";
import { textoAprovouPartes, textoConfirmacaoCliente, textoDecisao, textoDecisaoParte } from "@/lib/avisos";
import type { Parte } from "@/lib/conteudos";
import { enviarTexto } from "@/lib/whatsapp";

type DadosAviso = { empresa: string; titulo: string; agendadoPara: string | null };

/**
 * Avisa o grupo da equipe e confirma no grupo do cliente (assim ele não precisa escrever "aprovado" no grupo).
 * Melhor esforço: a decisão do cliente já foi gravada, falha de WhatsApp não desfaz nada.
 */
async function avisarDecisao(
  supabase: ReturnType<typeof createPublicClient>,
  token: string,
  versaoId: string,
  montar: (d: DadosAviso) => { equipe: string; cliente: string }
) {
  try {
    const { data } = await supabase.rpc("dados_aviso_decisao", { p_token: token, p_versao_id: versaoId });
    if (!data) return;
    const textos = montar({ empresa: data.empresa, titulo: data.titulo, agendadoPara: data.agendado_para ?? null });
    const envios: { destino: string | null; texto: string; registrar: boolean }[] = [
      { destino: data.grupo_equipe_id, texto: textos.equipe, registrar: true },
      { destino: data.grupo_cliente_id, texto: textos.cliente, registrar: false },
    ];
    for (const e of envios) {
      if (!e.destino) continue;
      let ok = true;
      let erro: string | null = null;
      try {
        await enviarTexto(data.instancia, e.destino, e.texto);
      } catch (err) {
        ok = false;
        erro = err instanceof Error ? err.message : String(err);
      }
      if (e.registrar) {
        await supabase
          .rpc("registrar_aviso", {
            p_token: token,
            p_versao_id: versaoId,
            p_destino: e.destino,
            p_texto: e.texto,
            p_ok: ok,
            p_erro: erro,
          })
          .then(undefined, () => undefined);
      }
    }
  } catch {
    /* aviso é melhor esforço */
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
  await avisarDecisao(supabase, token, versaoId, (d) => ({
    equipe: textoDecisao({ ...d, decisao, motivo }),
    cliente: textoConfirmacaoCliente({ ...d, tipo: decisao === "aprovado" ? "aprovou" : "reprovou" }),
  }));
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
  await avisarDecisao(supabase, token, versaoId, (d) => ({
    equipe: textoDecisaoParte({ ...d, parte, decisao, motivo, sugeridaPara }),
    cliente: textoConfirmacaoCliente({
      ...d,
      tipo: decisao === "aprovado" ? "aprovou" : parte === "data" ? "sugeriu" : "reprovou",
    }),
  }));
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
  await avisarDecisao(supabase, token, versaoId, (d) => ({
    equipe: textoAprovouPartes({ ...d, partes }),
    cliente: textoConfirmacaoCliente({ ...d, tipo: "aprovou" }),
  }));
  return {};
}
