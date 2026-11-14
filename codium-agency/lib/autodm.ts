// somente servidor: lista as contas (workspaces) do AutoDM para ligar a um cliente do dashboard.
export type WorkspaceAutodm = { id: string; nome: string };

export function lerWorkspaces(json: unknown): WorkspaceAutodm[] {
  const lista = (json as { workspaces?: unknown } | null)?.workspaces;
  if (!Array.isArray(lista)) return [];
  return lista.flatMap((w) => {
    const { id, name } = (w ?? {}) as { id?: unknown; name?: unknown };
    return typeof id === "string" && typeof name === "string" ? [{ id, nome: name.trim() }] : [];
  });
}

type Config = { url: string | undefined; segredo: string | undefined };
const configPadrao = (): Config => ({ url: process.env.AUTODM_URL, segredo: process.env.AUTODM_SECRET });

export async function workspacesAutodm(
  cfg: Config = configPadrao(),
  f: (url: string, init?: RequestInit) => Promise<Response> = fetch
): Promise<WorkspaceAutodm[]> {
  if (!cfg.url || !cfg.segredo) throw new Error("AutoDM não configurado: faltam AUTODM_URL e AUTODM_SECRET.");
  const r = await f(`${cfg.url.replace(/\/$/, "")}/api/painel/workspaces`, {
    headers: { authorization: `Bearer ${cfg.segredo}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`AutoDM respondeu ${r.status}.`);
  return lerWorkspaces(await r.json());
}
