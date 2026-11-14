import { createHmac, timingSafeEqual } from "node:crypto";

export const SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
] as const;

const GRAPH = "https://graph.instagram.com";
const STATE_VALIDADE_MS = 10 * 60_000;

type Deps = { fetch: typeof globalThis.fetch; agora?: () => number };

export function urlAutorizacao(i: { appId: string; redirectUri: string; state: string }): string {
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", i.appId);
  u.searchParams.set("redirect_uri", i.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES.join(","));
  u.searchParams.set("state", i.state);
  return u.toString();
}

const assinar = (dados: string, segredo: string) =>
  createHmac("sha256", segredo).update(dados).digest("base64url");

/** state assinado: clienteId.agora.assinatura (impede forjar o retorno e vale 10 min). */
export function assinarState(i: { clienteId: string; segredo: string; agora: number }): string {
  const dados = `${i.clienteId}.${i.agora}`;
  return `${dados}.${assinar(dados, i.segredo)}`;
}

export function lerState(state: string, segredo: string, agora: number): { clienteId: string } | null {
  const partes = state.split(".");
  if (partes.length < 3) return null;
  const assinatura = partes.pop()!;
  const tempo = Number(partes.pop());
  const clienteId = partes.join(".");
  const esperado = assinar(`${clienteId}.${tempo}`, segredo);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!Number.isFinite(tempo) || agora - tempo > STATE_VALIDADE_MS || agora < tempo) return null;
  return { clienteId };
}

/** Mensagem em português para erros da Meta; nunca repete texto da resposta (pode conter segredos). */
function erroMeta(corpo: any): Error {
  const codigo = corpo?.error?.code ?? corpo?.code;
  if (codigo === 190) return new Error("A chave do Instagram expirou ou foi revogada. Reconecte o Instagram.");
  if (codigo === 10 || codigo === 200 || codigo === 3) return new Error("A Meta negou a permissão. Reconecte o Instagram e aceite todas as permissões.");
  if (codigo === 4 || codigo === 17 || codigo === 32 || codigo === 613) return new Error("A Meta limitou as chamadas. Tente de novo em alguns minutos.");
  return new Error("A Meta recusou o pedido. Tente de novo ou reconecte o Instagram.");
}

async function pedir(deps: Deps, url: string, init?: RequestInit): Promise<any> {
  const r = await deps.fetch(url, init);
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok || corpo?.error || corpo?.error_type) throw erroMeta(corpo);
  return corpo;
}

export async function trocarCodigo(
  deps: Deps,
  i: { appId: string; appSecret: string; redirectUri: string; codigo: string }
): Promise<{ token: string; igUserId: string }> {
  const corpo = new URLSearchParams({
    client_id: i.appId,
    client_secret: i.appSecret,
    grant_type: "authorization_code",
    redirect_uri: i.redirectUri,
    code: i.codigo,
  });
  const r = await pedir(deps, "https://api.instagram.com/oauth/access_token", { method: "POST", body: corpo });
  return { token: String(r.access_token), igUserId: String(r.user_id) };
}

const venceEm = (deps: Deps, segundos: number) =>
  new Date((deps.agora ?? Date.now)() + segundos * 1000).toISOString();

export async function tornarLongo(
  deps: Deps,
  i: { appSecret: string; token: string }
): Promise<{ token: string; expiraEm: string }> {
  const u = new URL(`${GRAPH}/access_token`);
  u.searchParams.set("grant_type", "ig_exchange_token");
  u.searchParams.set("client_secret", i.appSecret);
  u.searchParams.set("access_token", i.token);
  const r = await pedir(deps, u.toString());
  return { token: String(r.access_token), expiraEm: venceEm(deps, Number(r.expires_in)) };
}

export async function renovar(deps: Deps, token: string): Promise<{ token: string; expiraEm: string }> {
  const u = new URL(`${GRAPH}/refresh_access_token`);
  u.searchParams.set("grant_type", "ig_refresh_token");
  u.searchParams.set("access_token", token);
  const r = await pedir(deps, u.toString());
  return { token: String(r.access_token), expiraEm: venceEm(deps, Number(r.expires_in)) };
}

export async function perfil(
  deps: Deps,
  token: string
): Promise<{ igUserId: string; username: string; tipoConta: string }> {
  const u = new URL(`${GRAPH}/v23.0/me`);
  u.searchParams.set("fields", "user_id,username,account_type");
  u.searchParams.set("access_token", token);
  const r = await pedir(deps, u.toString());
  const tipo = String(r.account_type ?? "");
  if (tipo !== "BUSINESS" && tipo !== "MEDIA_CREATOR") {
    throw new Error("Esta conta é pessoal. Mude para conta Profissional (Comercial ou Criador de conteúdo) no Instagram e conecte de novo.");
  }
  return { igUserId: String(r.user_id), username: String(r.username), tipoConta: tipo };
}

// ---------- publicar ----------

async function postar(deps: Deps, caminho: string, token: string, campos: Record<string, string | undefined>): Promise<any> {
  const corpo = new URLSearchParams({ access_token: token });
  for (const [k, v] of Object.entries(campos)) if (v !== undefined) corpo.set(k, v);
  return pedir(deps, `${GRAPH}/v23.0${caminho}`, { method: "POST", body: corpo });
}

export type TipoContainer = "imagem" | "reels" | "item_carrossel" | "carrossel";

export async function criarContainer(
  deps: Deps,
  token: string,
  i: { igUserId: string; tipo: TipoContainer; url?: string; legenda?: string; filhos?: string[] }
): Promise<{ id: string }> {
  const campos: Record<string, string | undefined> =
    i.tipo === "imagem"
      ? { image_url: i.url, caption: i.legenda }
      : i.tipo === "item_carrossel"
        ? { image_url: i.url, is_carousel_item: "true" }
        : i.tipo === "carrossel"
          ? { media_type: "CAROUSEL", children: i.filhos?.join(","), caption: i.legenda }
          : { media_type: "REELS", video_url: i.url, caption: i.legenda };
  const r = await postar(deps, `/${i.igUserId}/media`, token, campos);
  return { id: String(r.id) };
}

export async function statusContainer(
  deps: Deps,
  token: string,
  id: string
): Promise<"em_andamento" | "pronto" | "erro"> {
  const u = new URL(`${GRAPH}/v23.0/${id}`);
  u.searchParams.set("fields", "status_code");
  u.searchParams.set("access_token", token);
  const r = await pedir(deps, u.toString());
  const s = String(r.status_code);
  if (s === "FINISHED" || s === "PUBLISHED") return "pronto";
  if (s === "ERROR" || s === "EXPIRED") return "erro";
  return "em_andamento";
}

export async function publicarContainer(
  deps: Deps,
  token: string,
  i: { igUserId: string; creationId: string }
): Promise<{ id: string }> {
  const r = await postar(deps, `/${i.igUserId}/media_publish`, token, { creation_id: i.creationId });
  return { id: String(r.id) };
}

export async function permalink(deps: Deps, token: string, mediaId: string): Promise<string | null> {
  try {
    const u = new URL(`${GRAPH}/v23.0/${mediaId}`);
    u.searchParams.set("fields", "permalink");
    u.searchParams.set("access_token", token);
    const r = await pedir(deps, u.toString());
    return r.permalink ? String(r.permalink) : null;
  } catch {
    return null;
  }
}
