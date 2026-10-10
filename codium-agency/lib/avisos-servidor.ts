// somente servidor
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarTexto, INSTANCIA_PADRAO } from "@/lib/whatsapp";
import {
  deveAgrupar,
  linkDoCliente,
  textoConteudoNovo,
  textoNovaVersao,
  type TipoAviso,
} from "@/lib/avisos";
import { estadoConteudo, type Versao } from "@/lib/conteudos";

export const origemDoSite = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://codium-agency.vercel.app";

type Resultado = { enviado: boolean; motivo?: "sem_grupo" | "agrupado" | "erro"; erro?: string };

async function instanciaConfigurada(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", "whatsapp_instancia")
    .maybeSingle();
  return data?.valor || INSTANCIA_PADRAO;
}

async function registrar(
  supabase: SupabaseClient,
  linha: { tipo: TipoAviso; cliente_id: string; destino: string; texto: string; ok: boolean; erro?: string | null }
) {
  try {
    await supabase.from("avisos_whatsapp").insert({ ...linha, erro: linha.erro?.slice(0, 500) ?? null });
  } catch {
    /* o log é melhor esforço */
  }
}

async function contarPendentes(supabase: SupabaseClient, clienteId: string): Promise<number> {
  const { data } = await supabase
    .from("conteudos")
    .select("id, conteudo_versoes(numero, decisao, expira_em)")
    .eq("cliente_id", clienteId);
  const agora = new Date();
  return (data ?? []).filter((c: any) => {
    const versoes = ((c.conteudo_versoes ?? []) as any[]).map(
      (v) => ({ ...v, expirada: new Date(v.expira_em) < agora }) as Versao
    );
    const atual = versoes.reduce<Versao | undefined>(
      (m, v) => (!m || v.numero > m.numero ? v : m),
      undefined
    );
    return atual && !atual.expirada && estadoConteudo({ versoes }) === "pendente";
  }).length;
}

/** Avisa o grupo do cliente. Nunca lança: falhas voltam no resultado e vão para o log. */
export async function avisarClienteConteudo(i: {
  supabase: SupabaseClient;
  clienteId: string;
  tipo: "conteudo_novo" | "nova_versao";
  titulo: string;
  forcar?: boolean;
}): Promise<Resultado> {
  try {
    const { supabase, clienteId } = i;
    const { data: cliente } = await supabase
      .from("clientes")
      .select("empresa, link_token, whatsapp_grupo_id")
      .eq("id", clienteId)
      .maybeSingle();
    if (!cliente?.whatsapp_grupo_id) return { enviado: false, motivo: "sem_grupo" };

    if (!i.forcar) {
      const { data: ultimo } = await supabase
        .from("avisos_whatsapp")
        .select("created_at")
        .eq("cliente_id", clienteId)
        .in("tipo", ["conteudo_novo", "nova_versao"])
        .eq("ok", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (deveAgrupar(ultimo?.created_at, new Date())) return { enviado: false, motivo: "agrupado" };
    }

    const link = linkDoCliente(origemDoSite(), cliente.link_token);
    const texto =
      i.tipo === "nova_versao"
        ? textoNovaVersao({ empresa: cliente.empresa, titulo: i.titulo, link })
        : textoConteudoNovo({
            empresa: cliente.empresa,
            titulo: i.titulo,
            pendentes: await contarPendentes(supabase, clienteId),
            link,
          });

    const instancia = await instanciaConfigurada(supabase);
    try {
      await enviarTexto(instancia, cliente.whatsapp_grupo_id, texto);
      await registrar(supabase, {
        tipo: i.tipo, cliente_id: clienteId, destino: cliente.whatsapp_grupo_id, texto, ok: true,
      });
      return { enviado: true };
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      await registrar(supabase, {
        tipo: i.tipo, cliente_id: clienteId, destino: cliente.whatsapp_grupo_id, texto, ok: false, erro,
      });
      return { enviado: false, motivo: "erro", erro };
    }
  } catch (e) {
    return { enviado: false, motivo: "erro", erro: e instanceof Error ? e.message : String(e) };
  }
}
