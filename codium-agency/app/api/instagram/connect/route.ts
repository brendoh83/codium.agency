import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assinarState, urlAutorizacao } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const origem = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://codium-agency.vercel.app").replace(/\/$/, "");

/** Começa a conexão do Instagram de um cliente: manda para a tela de login da Meta. */
export async function GET(req: Request) {
  const clienteId = new URL(req.url).searchParams.get("cliente");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origem()}/login`);
  if (!clienteId) return NextResponse.redirect(`${origem()}/conteudos`);

  const voltar = (msg: string) =>
    NextResponse.redirect(`${origem()}/conteudos/${clienteId}?ig=erro&msg=${encodeURIComponent(msg)}`);

  const appId = process.env.IG_APP_ID;
  const segredo = process.env.IG_APP_SECRET;
  if (!appId || !segredo) return voltar("A conexão do Instagram ainda não está configurada.");

  const { data: cliente } = await supabase.from("clientes").select("id").eq("id", clienteId).maybeSingle();
  if (!cliente) return NextResponse.redirect(`${origem()}/conteudos`);

  const state = assinarState({ clienteId, segredo, agora: Date.now() });
  return NextResponse.redirect(
    urlAutorizacao({ appId, redirectUri: `${origem()}/api/instagram/callback`, state })
  );
}
