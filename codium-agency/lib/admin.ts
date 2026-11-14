// somente servidor
import type { SupabaseClient } from "@supabase/supabase-js";

/** Só quem tem papel "administrador" conecta contas (Instagram, WhatsApp). */
export async function ehAdministrador(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from("profiles").select("papel").eq("id", userId).maybeSingle();
  return data?.papel === "administrador";
}
