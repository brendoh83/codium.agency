type Conta = {
  username: string | null;
  token_expira_em: string;
  status: string;
  autodm_workspace_id: string | null;
} | null;

const dias = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

export default function ConectarInstagram({
  clienteId,
  conta,
  podeConectar,
  resultado,
}: {
  clienteId: string;
  conta: Conta;
  podeConectar: boolean;
  resultado?: { ok: boolean; msg?: string } | null;
}) {
  const href = `/api/instagram/connect?cliente=${clienteId}`;
  const botao = "inline-block rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-950";
  const reconectar = conta?.status === "reconectar";

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Instagram</h2>
        {conta && !reconectar && (
          <span className="rounded bg-ok px-1.5 py-0.5 text-[11px] font-semibold text-white">Conectado</span>
        )}
        {reconectar && (
          <span className="rounded bg-danger px-1.5 py-0.5 text-[11px] font-semibold text-white">Reconectar</span>
        )}
      </div>

      {!conta && (
        <>
          <p className="text-sm text-slate-500">Nenhuma conta conectada.</p>
          {podeConectar ? (
            <a href={href} className={botao}>
              Conectar Instagram
            </a>
          ) : (
            <p className="text-xs text-slate-400">Só o administrador conecta.</p>
          )}
        </>
      )}

      {conta && !reconectar && (
        <p className="text-sm text-slate-600">
          @{conta.username} · chave vence em {dias(conta.token_expira_em)} dias (renova sozinha)
          {conta.autodm_workspace_id ? " · AutoDM ligado" : ""}
        </p>
      )}

      {reconectar && (
        <>
          <p className="text-sm text-slate-600">
            A Meta pediu um novo login. Posts agendados não saem até reconectar.
          </p>
          {podeConectar ? (
            <a href={href} className={botao}>
              Reconectar
            </a>
          ) : (
            <p className="text-xs text-slate-400">Só o administrador reconecta.</p>
          )}
        </>
      )}

      {resultado && (
        <p className={`text-sm ${resultado.ok ? "text-ok" : "text-danger"}`}>
          {resultado.ok ? "Instagram conectado." : resultado.msg ?? "Não foi possível conectar."}
        </p>
      )}
    </div>
  );
}
