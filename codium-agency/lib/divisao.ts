export type Socio = "brendo" | "victor";

const ROTULO: Record<Socio, string> = { brendo: "Brendo", victor: "Victor" };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function socioValido(s: string): s is Socio {
  return s === "brendo" || s === "victor";
}

export function rotuloSocio(s: Socio): string {
  return ROTULO[s];
}

/** Nota informativa (não é erro): sócio recebeu além da própria parte; o excedente sai do caixa. */
export function avisoExcedente(socio: Socio, excesso: number, mes: string): string | null {
  if (!(excesso > 0)) return null;
  return `${ROTULO[socio]} recebeu ${brl(excesso)} além da parte dele; esse valor saiu do caixa de ${mes}.`;
}

/** Aviso de atenção: repasses somam mais que o faturamento do mês. */
export function avisoMovimentacao(i: {
  repassado: number;
  faturamento: number;
  diferenca: number;
  mes: string;
}): string | null {
  if (!(i.diferenca > 0)) return null;
  return (
    `Movimentação maior que o faturamento: os repasses somam ${brl(i.repassado)}, ` +
    `mas ${i.mes} faturou ${brl(i.faturamento)} (diferença de ${brl(i.diferenca)}). ` +
    `Algum serviço ou pagamento ficou de fora do cadastro?`
  );
}
