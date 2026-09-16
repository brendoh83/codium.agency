import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClienteDetalhe from "@/components/ClienteDetalhe";

export const dynamic = "force-dynamic";

export default async function ClientePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [
    { data: cliente },
    { data: servicos },
    { data: clienteServicos },
    { data: contratos },
    { data: pagamentos },
    { data: saudeEventos },
    { data: saude },
    { data: satisfacaoHistorico },
    { data: tarefas },
  ] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", params.id).single(),
    supabase.from("servicos").select("*").eq("ativo", true).order("nome"),
    supabase.from("cliente_servicos").select("*, servicos(nome)").eq("cliente_id", params.id),
    supabase
      .from("contratos")
      .select("*")
      .eq("cliente_id", params.id)
      .order("data_inicio", { ascending: false }),
    supabase
      .from("v_pagamentos")
      .select("*")
      .eq("cliente_id", params.id)
      .order("competencia", { ascending: false }),
    supabase
      .from("saude_eventos")
      .select("*")
      .eq("cliente_id", params.id)
      .order("data", { ascending: false }),
    supabase.from("v_saude_cliente").select("*").eq("cliente_id", params.id).single(),
    supabase
      .from("satisfacao_historico")
      .select("*")
      .eq("cliente_id", params.id)
      .order("competencia", { ascending: false }),
    supabase
      .from("tarefas")
      .select("*")
      .eq("cliente_id", params.id)
      .order("data", { ascending: false }),
  ]);

  if (!cliente) notFound();

  return (
    <ClienteDetalhe
      cliente={cliente}
      servicos={servicos ?? []}
      clienteServicos={clienteServicos ?? []}
      contratos={contratos ?? []}
      pagamentos={pagamentos ?? []}
      saudeEventos={saudeEventos ?? []}
      saude={saude ?? null}
      satisfacaoHistorico={satisfacaoHistorico ?? []}
      tarefas={tarefas ?? []}
    />
  );
}
