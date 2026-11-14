"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehAdministrador } from "@/lib/admin";
import { workspacesAutodm, type WorkspaceAutodm } from "@/lib/autodm";

async function admin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ok = Boolean(user && (await ehAdministrador(supabase, user.id)));
  return { supabase, ok };
}

export async function contasAutodm(): Promise<{ erro?: string; contas?: WorkspaceAutodm[] }> {
  const { ok } = await admin();
  if (!ok) return { erro: "Só o administrador liga o AutoDM." };
  try {
    return { contas: await workspacesAutodm() };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível falar com o AutoDM." };
  }
}

/** Liga (ou desliga, com null) a conta do AutoDM ao Instagram conectado deste cliente. */
export async function ligarAutodm(clienteId: string, workspaceId: string | null): Promise<{ erro?: string }> {
  const { supabase, ok } = await admin();
  if (!ok) return { erro: "Só o administrador liga o AutoDM." };
  if (workspaceId) {
    // só aceita uma conta que o AutoDM realmente tem
    try {
      if (!(await workspacesAutodm()).some((w) => w.id === workspaceId)) return { erro: "Conta do AutoDM não encontrada." };
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Não foi possível falar com o AutoDM." };
    }
  }
  const { data, error } = await supabase
    .from("instagram_contas")
    .update({ autodm_workspace_id: workspaceId })
    .eq("cliente_id", clienteId)
    .select("id");
  if (error) return { erro: "Não foi possível salvar." };
  if (!data?.length) return { erro: "Conecte o Instagram deste cliente primeiro." };
  revalidatePath(`/conteudos/${clienteId}`);
  return {};
}
