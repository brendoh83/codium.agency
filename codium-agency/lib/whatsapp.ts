// somente servidor
export const INSTANCIA_PADRAO = "codium-agencia";

const TIMEOUT_MS = 8000;

/** Nome da instância na URL: só letras, números, _ e -; qualquer outra coisa é recusada (evita ../ e afins). */
function inst(instancia: string): string {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(instancia)) throw new Error("Nome de instância inválido.");
  return encodeURIComponent(instancia);
}
// listar grupos pode demorar: o WhatsApp sincroniza todos os grupos da conta
const TIMEOUT_GRUPOS_MS = 50_000;

function config() {
  const url = process.env.EVOLUTION_URL;
  const key = process.env.EVOLUTION_API_KEY;
  if (!url || !key) {
    throw new Error("Evolution não configurado: faltam EVOLUTION_URL e EVOLUTION_API_KEY");
  }
  return { url: url.replace(/\/$/, ""), key };
}

async function evo<T>(path: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<T> {
  const { url, key } = config();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${url}${path}`, {
      ...init,
      headers: { apikey: key, "Content-Type": "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`Evolution ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const criarInstancia = (instancia: string) =>
  evo("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: instancia,
      integration: "WHATSAPP-BAILEYS",
      qrcode: false,
      groupsIgnore: false,
      syncFullHistory: false,
      rejectCall: false,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
    }),
  });

export const conectar = (instancia: string, numero?: string) =>
  evo<{ pairingCode?: string | null; code?: string; base64?: string }>(
    `/instance/connect/${inst(instancia)}${numero ? `?number=${encodeURIComponent(numero)}` : ""}`
  );

export const estadoConexao = (instancia: string) =>
  evo<{ instance?: { state?: string } }>(`/instance/connectionState/${inst(instancia)}`).then(
    (r) => r.instance?.state ?? "close"
  );

/** Número (ownerJid) atualmente autenticado na instância. Null se não achar. */
export async function numeroConectado(instancia: string): Promise<string | null> {
  const r = await evo<{ instance?: { owner?: string } }[]>(
    `/instance/fetchInstances?instanceName=${inst(instancia)}`
  );
  const dono = Array.isArray(r) ? r[0]?.instance?.owner : undefined;
  return dono ? dono.replace(/@.*$/, "").replace(/:\d+$/, "") : null;
}

/**
 * Lista os grupos a partir dos contatos já sincronizados no servidor.
 * O endpoint /group/fetchAllGroups consulta o WhatsApp ao vivo e trava em contas com muitos grupos.
 */
export async function listarGrupos(instancia: string): Promise<{ id: string; nome: string }[]> {
  const porId = new Map<string, { id: string; nome: string }>();
  // 1) consulta ao vivo no WhatsApp do número conectado: nunca devolve grupos de número anterior
  try {
    const vivo = await evo<{ id?: string; subject?: string }[]>(
      `/group/fetchAllGroups/${inst(instancia)}?getParticipants=false`,
      {},
      TIMEOUT_GRUPOS_MS
    );
    for (const g of Array.isArray(vivo) ? vivo : []) {
      if (typeof g.id === "string" && g.id.endsWith("@g.us") && !porId.has(g.id)) {
        porId.set(g.id, { id: g.id, nome: g.subject?.trim() || g.id });
      }
    }
  } catch {
    // 2) demorou ou falhou: cai na lista de contatos já sincronizados no servidor (pode estar velha)
    const r = await evo<{ remoteJid?: string; pushName?: string | null; isGroup?: boolean }[]>(
      `/chat/findContacts/${inst(instancia)}`,
      { method: "POST", body: "{}" },
      TIMEOUT_GRUPOS_MS
    );
    for (const c of Array.isArray(r) ? r : []) {
      const id = c.remoteJid;
      if (typeof id !== "string" || !id.endsWith("@g.us") || porId.has(id)) continue;
      porId.set(id, { id, nome: c.pushName?.trim() || id });
    }
  }
  return [...porId.values()].sort((a, b) => {
    // grupos sem nome (nome = id) vão para o fim da lista
    const semNomeA = a.nome === a.id ? 1 : 0;
    const semNomeB = b.nome === b.id ? 1 : 0;
    return semNomeA - semNomeB || a.nome.localeCompare(b.nome, "pt-BR");
  });
}

/** Derruba a sessão autenticada. Necessário antes de trocar de número: reconectar sem isso mantém a sessão velha presa no servidor. */
export async function desconectar(instancia: string): Promise<void> {
  // logout e apagar: cada um pode falhar se a instância já está desconectada/inexistente; o que importa é sumir com a sessão e os contatos velhos
  await evo(`/instance/logout/${inst(instancia)}`, { method: "DELETE" }).catch(() => null);
  await evo(`/instance/delete/${inst(instancia)}`, { method: "DELETE" }).catch(() => null);
}

export const enviarTexto = (instancia: string, jid: string, texto: string) =>
  evo(`/message/sendText/${inst(instancia)}`, {
    method: "POST",
    body: JSON.stringify({ number: jid, text: texto }),
  });
