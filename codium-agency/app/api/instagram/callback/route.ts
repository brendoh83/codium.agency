import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehAdministrador } from "@/lib/admin";
import { cifrar } from "@/lib/cripto";
import { lerState, perfil, tornarLongo, trocarCodigo } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const origem = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://codium-agency.vercel.app").replace(/\/$/, "");

/** Retorno da Meta: troca o código pela chave, confere a conta, guarda cifrado e volta para a aba do cliente. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origem()}/login`);

  const appId = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  const chave = process.env.IG_TOKEN_KEY;
  const lido = lerState(url.searchParams.get("state") ?? "", appSecret ?? "", Date.now());
  if (!lido) return NextResponse.redirect(`${origem()}/conteudos?ig=erro&msg=${encodeURIComponent("Link de conexão inválido ou vencido. Comece de novo.")}`);

  const voltar = (ok: boolean, msg?: string) =>
    NextResponse.redirect(
      `${origem()}/conteudos/${lido.clienteId}?ig=${ok ? "ok" : "erro"}${msg ? `&msg=${encodeURIComponent(msg)}` : ""}`
    );

  if (!(await ehAdministrador(supabase, user.id))) return voltar(false, "Só o administrador pode conectar o Instagram.");
  if (url.searchParams.get("error")) return voltar(false, "A conexão foi cancelada no Instagram.");
  const codigo = url.searchParams.get("code");
  if (!codigo || !appId || !appSecret || !chave) return voltar(false, "Não foi possível concluir a conexão.");

  try {
    const redirectUri = `${origem()}/api/instagram/callback`;
    const deps = { fetch };
    const curto = await trocarCodigo(deps, { appId, appSecret, redirectUri, codigo });
    const longo = await tornarLongo(deps, { appSecret, token: curto.token });
    const p = await perfil(deps, longo.token);

    const { error } = await supabase.from("instagram_contas").upsert(
      {
        cliente_id: lido.clienteId,
        ig_user_id: p.igUserId,
        username: p.username,
        token_cifrado: cifrar(longo.token, chave),
        token_expira_em: longo.expiraEm,
        status: "ativa",
      },
      { onConflict: "cliente_id" }
    );
    if (error) return voltar(false, "Não foi possível salvar a conexão.");
    return voltar(true);
  } catch (e) {
    return voltar(false, e instanceof Error ? e.message : "Não foi possível concluir a conexão.");
  }
}
