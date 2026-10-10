"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { conectar, criarInstancia, estadoConexao, listarGrupos, INSTANCIA_PADRAO } from "@/lib/whatsapp";
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
  if (configurado) {
    try {
      estado = await estadoConexao(instancia);
    } catch {
      estado = "sem_instancia";
    }
  }
  const idEquipe = mapa.get("whatsapp_grupo_equipe_id");
  return {
    instancia,
    estado,
    grupoEquipe: idEquipe ? { id: idEquipe, nome: mapa.get("whatsapp_grupo_equipe_nome") ?? idEquipe } : null,
    configurado,
  };
}

export async function iniciarConexao(
  numero?: string
): Promise<{ erro?: string; qr?: string; codigo?: string }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  try {
    const instancia = await instanciaAtual(supabase);
    try {
      await estadoConexao(instancia);
    } catch {
      await criarInstancia(instancia);
    }
    await supabase.from("app_config").upsert({ chave: "whatsapp_instancia", valor: instancia });
    const r = await conectar(instancia, numero?.replace(/\D/g, "") || undefined);
    return { qr: r.base64, codigo: r.pairingCode ?? undefined };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao conectar." };
  }
}

export async function gruposDisponiveis(): Promise<{
  erro?: string;
  grupos?: { id: string; nome: string }[];
}> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
  try {
    return { grupos: await listarGrupos(await instanciaAtual(supabase)) };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falha ao listar grupos." };
  }
}

export async function salvarGrupoEquipe(id: string, nome: string): Promise<{ erro?: string }> {
  const { supabase, user } = await usuario();
  if (!user) return { erro: "Não autenticado." };
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
