"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehAdministrador } from "@/lib/admin";
import { conectar, criarInstancia, desconectar, estadoConexao, listarGrupos, numeroConectado, INSTANCIA_PADRAO } from "@/lib/whatsapp";
import { avisarClienteConteudo, pendentesDoCliente } from "@/lib/avisos-servidor";

async function usuario() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function instanciaAtual(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", "whatsapp_instancia")
    .maybeSingle();
  return data?.valor || INSTANCIA_PADRAO;
}

export async function statusWhatsapp() {
  const { supabase, user } = await usuario();
  if (!user) {
    return { instancia: INSTANCIA_PADRAO, estado: "sem_login", grupoEquipe: null, configurado: false };
  }
  const instancia = await instanciaAtual(supabase);
  const { data: cfg } = await supabase
    .from("app_config")
    .select("chave, valor")
    .in("chave", ["whatsapp_grupo_equipe_id", "whatsapp_grupo_equipe_nome"]);
  const mapa = new Map((cfg ?? []).map((c: any) => [c.chave, c.valor]));
  const configurado = Boolean(process.env.EVOLUTION_URL && process.env.EVOLUTION_API_KEY);
  let estado = "nao_configurado";
  let numero: string | null = null;
  if (configurado) {
    try {
      estado = await estadoConexao(instancia);
      if (estado === "open") numero = await numeroConectado(instancia).catch(() => null);
    } catch {
      estado = "sem_instancia";
    }
  }
  const idEquipe = mapa.get("whatsapp_grupo_equipe_id");
  return {
    instancia,
    estado,
    numero,
    grupoEquipe: idEquipe ? { id: idEquipe, nome: mapa.get("whatsapp_grupo_equipe_nome") ?? idEquipe } : null,
    configurado,
  };
}

export async function iniciarConexao(
  numero?: string
): Promise<{ erro?: string; qr?: string; codigo?: string }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  if (!(await ehAdministrador(supabase, user.id))) return { erro: "Só o administrador pode conectar o WhatsApp." };
  try {
    const instancia = await instanciaAtual(supabase);
    try {
      await estadoConexao(instancia);
    } catch {
      await criarInstancia(instancia);
    }
    await supabase.from("app_config").upsert({ chave: "whatsapp_instancia", valor: instancia });
    const num = numero?.replace(/\D/g, "") || undefined;
    let r = await conectar(instancia, num);
    if (!r.base64 && !r.pairingCode) {
      // instância num estado torto (sem QR): apaga e recria do zero
      await desconectar(instancia);
      await criarInstancia(instancia);
      r = await conectar(instancia, num);
    }
    if (!r.base64 && !r.pairingCode) return { erro: "O servidor não devolveu o QR. Tente de novo em alguns segundos." };
    return { qr: r.base64, codigo: r.pairingCode ?? undefined };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao conectar." };
  }
}

/** Derruba a sessão antes de trocar número: sem isso o servidor fica com a sessão antiga presa e nunca atualiza grupos/contatos. */
export async function desconectarWhatsapp(): Promise<{ erro?: string }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  if (!(await ehAdministrador(supabase, user.id))) return { erro: "Só o administrador pode desconectar." };
  try {
    await desconectar(await instanciaAtual(supabase));
    await supabase.from("app_config").delete().eq("chave", "whatsapp_grupos_cache");
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao desconectar." };
  }
  revalidatePath("/configuracoes");
  return {};
}

const CACHE_GRUPOS_MS = 10 * 60 * 1000;

export async function gruposDisponiveis(forcar = false): Promise<{
  erro?: string;
  grupos?: { id: string; nome: string }[];
}> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  try {
    if (!forcar) {
      const { data } = await supabase
        .from("app_config")
        .select("valor")
        .eq("chave", "whatsapp_grupos_cache")
        .maybeSingle();
      if (data?.valor) {
        try {
          const c = JSON.parse(data.valor) as { em: number; grupos: { id: string; nome: string }[] };
          if (Array.isArray(c.grupos) && c.grupos.length > 0 && Date.now() - c.em < CACHE_GRUPOS_MS) {
            return { grupos: c.grupos };
          }
        } catch {
          /* cache inválido: busca de novo */
        }
      }
    }
    const grupos = await listarGrupos(await instanciaAtual(supabase));
    if (grupos.length > 0) {
      await supabase
        .from("app_config")
        .upsert({ chave: "whatsapp_grupos_cache", valor: JSON.stringify({ em: Date.now(), grupos }) });
    }
    return { grupos };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao listar grupos.";
    return {
      erro: /abort/i.test(msg)
        ? "O WhatsApp demorou demais para listar os grupos. Tente de novo em alguns segundos."
        : msg,
    };
  }
}

export async function salvarGrupoEquipe(id: string, nome: string): Promise<{ erro?: string }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  if (!(await ehAdministrador(supabase, user.id))) return { erro: "Só o administrador pode trocar o grupo da equipe." };
  if (!id.endsWith("@g.us")) return { erro: "Grupo inválido." };
  const { error } = await supabase.from("app_config").upsert([
    { chave: "whatsapp_grupo_equipe_id", valor: id },
    { chave: "whatsapp_grupo_equipe_nome", valor: nome },
  ]);
  if (error) return { erro: "Não foi possível salvar o grupo." };
  revalidatePath("/configuracoes");
  return {};
}

export async function salvarGrupoCliente(
  clienteId: string,
  id: string | null,
  nome: string | null
): Promise<{ erro?: string }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  if (id && !id.endsWith("@g.us")) return { erro: "Grupo inválido." };
  const { error } = await supabase
    .from("clientes")
    .update({ whatsapp_grupo_id: id, whatsapp_grupo_nome: id ? nome : null })
    .eq("id", clienteId);
  if (error) return { erro: "Não foi possível salvar o grupo do cliente." };
  revalidatePath(`/conteudos/${clienteId}`);
  return {};
}

export async function reenviarAviso(clienteId: string): Promise<{ erro?: string; enviado?: boolean }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  const pendentes = await pendentesDoCliente(supabase, clienteId);
  if (pendentes.length === 0) return { erro: "Nenhum conteúdo aguardando aprovação deste cliente." };
  const titulo = pendentes[0].titulo;
  const r = await avisarClienteConteudo({ supabase, clienteId, tipo: "conteudo_novo", titulo, forcar: true });
  if (r.motivo === "sem_grupo") return { erro: "Este cliente ainda não tem grupo de WhatsApp escolhido." };
  if (!r.enviado) return { erro: r.erro ?? "Não foi possível enviar o aviso." };
  return { enviado: true };
}
