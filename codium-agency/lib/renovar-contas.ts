export interface ContaRenovavel {
  id: string;
  token_cifrado: string;
  token_expira_em: string;
  status: string;
}

export const RENOVAR_COM_ATE_DIAS = 10;

/** Renova as chaves do Instagram que vencem em até 10 dias; se a Meta recusar, marca a conta como "reconectar". */
export async function renovarContas(deps: {
  listar: () => Promise<ContaRenovavel[]>;
  renovar: (token: string) => Promise<{ token: string; expiraEm: string }>;
  salvar: (id: string, p: { token_cifrado?: string; token_expira_em?: string; status?: string }) => Promise<void>;
  decifrar: (cifrado: string) => string;
  cifrar: (texto: string) => string;
  agora: () => Date;
}): Promise<{ renovadas: number; falhas: number }> {
  const limite = deps.agora().getTime() + RENOVAR_COM_ATE_DIAS * 86_400_000;
  let renovadas = 0;
  let falhas = 0;
  for (const conta of await deps.listar()) {
    if (conta.status !== "ativa") continue;
    if (new Date(conta.token_expira_em).getTime() > limite) continue;
    try {
      const novo = await deps.renovar(deps.decifrar(conta.token_cifrado));
      await deps.salvar(conta.id, { token_cifrado: deps.cifrar(novo.token), token_expira_em: novo.expiraEm });
      renovadas++;
    } catch (e) {
      falhas++;
      // falha passageira (rede, limite) tenta de novo na próxima rodada; só pede reconexão se for definitiva
      const definitiva = /reconecte|permiss/i.test(e instanceof Error ? e.message : "");
      const vencida = new Date(conta.token_expira_em).getTime() <= deps.agora().getTime();
      if (definitiva || vencida) await deps.salvar(conta.id, { status: "reconectar" });
    }
  }
  return { renovadas, falhas };
}
