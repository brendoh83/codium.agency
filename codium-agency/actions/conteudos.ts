"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { podeNovaVersao, tipoPorMime, validarArquivo } from "@/lib/conteudos";

type Resultado = { erro?: string };

function chaveValida(key: string, clienteId: string) {
  return key.startsWith(`clientes/${clienteId}/`) && !key.includes("..");
}

export async function registrarConteudo(i: {
  clienteId: string;
  titulo: string;
  key: string;
  mime: string;
  tamanho: number;
}): Promise<Resultado> {
  const titulo = i.titulo.trim();
  if (!titulo) return { erro: "Informe um título." };
  const erro = validarArquivo(i.mime, i.tamanho);
  const tipo = tipoPorMime(i.mime);
  if (erro || !tipo) return { erro: erro ?? "Tipo de arquivo inválido." };
  if (!chaveValida(i.key, i.clienteId)) return { erro: "Arquivo inválido." };

  const supabase = createClient();
  const { data: conteudo, error } = await supabase
    .from("conteudos")
    .insert({ cliente_id: i.clienteId, titulo, tipo })
    .select("id")
    .single();
  if (error || !conteudo) return { erro: "Não foi possível criar o conteúdo." };

  const { error: erroVersao } = await supabase.from("conteudo_versoes").insert({
    conteudo_id: conteudo.id,
    numero: 1,
    r2_key: i.key,
    mime: i.mime,
    tamanho: i.tamanho,
  });
  if (erroVersao) {
    await supabase.from("conteudos").delete().eq("id", conteudo.id);
    return { erro: "Não foi possível registrar o arquivo." };
  }
  revalidatePath(`/conteudos/${i.clienteId}`);
  revalidatePath("/conteudos");
  return {};
}

export async function registrarNovaVersao(i: {
  clienteId: string;
  conteudoId: string;
  key: string;
  mime: string;
  tamanho: number;
}): Promise<Resultado> {
  const erro = validarArquivo(i.mime, i.tamanho);
  if (erro) return { erro };
  if (!chaveValida(i.key, i.clienteId)) return { erro: "Arquivo inválido." };

  const supabase = createClient();
  const { data: conteudo } = await supabase
    .from("conteudos")
    .select("id, tipo, cliente_id")
    .eq("id", i.conteudoId)
    .eq("cliente_id", i.clienteId)
    .maybeSingle();
  if (!conteudo) return { erro: "Conteúdo não encontrado." };
  if (tipoPorMime(i.mime) !== conteudo.tipo) {
    return { erro: `A nova versão precisa ser ${conteudo.tipo === "video" ? "um vídeo" : "uma imagem"}.` };
  }

  const { data: ultima } = await supabase
    .from("conteudo_versoes")
    .select("numero, decisao, expira_em")
    .eq("conteudo_id", i.conteudoId)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ultima) return { erro: "Conteúdo sem versão anterior." };
  const expirada = new Date(ultima.expira_em) < new Date();
  if (!podeNovaVersao({ decisao: ultima.decisao, expirada })) {
    return { erro: "Só é possível subir nova versão de um conteúdo reprovado ou com arquivo expirado." };
  }

  const { error } = await supabase.from("conteudo_versoes").insert({
    conteudo_id: i.conteudoId,
    numero: ultima.numero + 1,
    r2_key: i.key,
    mime: i.mime,
    tamanho: i.tamanho,
  });
  if (error) return { erro: "Não foi possível registrar a nova versão." };
  revalidatePath(`/conteudos/${i.clienteId}`);
  revalidatePath("/conteudos");
  return {};
}

export async function regerarLink(clienteId: string): Promise<{ erro?: string; token?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("regerar_link_cliente", { p_cliente_id: clienteId });
  if (error || typeof data !== "string") return { erro: "Não foi possível gerar o link novo." };
  revalidatePath(`/conteudos/${clienteId}`);
  return { token: data };
}
