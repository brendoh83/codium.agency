// somente servidor
export const INSTANCIA_PADRAO = "codium-agencia";

const TIMEOUT_MS = 8000;
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
    `/instance/connect/${instancia}${numero ? `?number=${numero}` : ""}`
  );

export const estadoConexao = (instancia: string) =>
  evo<{ instance?: { state?: string } }>(`/instance/connectionState/${instancia}`).then(
    (r) => r.instance?.state ?? "close"
  );

export async function listarGrupos(instancia: string): Promise<{ id: string; nome: string }[]> {
  const r = await evo<{ id?: string; subject?: string }[]>(
    `/group/fetchAllGroups/${instancia}?getParticipants=false`,
    {},
    TIMEOUT_GRUPOS_MS
  );
  return (Array.isArray(r) ? r : [])
    .filter((g) => typeof g.id === "string" && g.id.endsWith("@g.us"))
    .map((g) => ({ id: g.id as string, nome: g.subject?.trim() || (g.id as string) }))
    .sort((a, b) => {
      // grupos sem nome (nome = id) vão para o fim da lista
      const semNomeA = a.nome === a.id ? 1 : 0;
      const semNomeB = b.nome === b.id ? 1 : 0;
      return semNomeA - semNomeB || a.nome.localeCompare(b.nome, "pt-BR");
    });
}

export const enviarTexto = (instancia: string, jid: string, texto: string) =>
  evo(`/message/sendText/${instancia}`, {
    method: "POST",
    body: JSON.stringify({ number: jid, text: texto }),
  });
