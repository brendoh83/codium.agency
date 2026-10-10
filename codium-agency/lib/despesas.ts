import type { Socio } from "./divisao";

const socioValido = (s: string): s is Socio => s === "brendo" || s === "victor";

const ISO_MES = /^\d{4}-\d{2}-01$/;

/** Vencimento no mês informado (YYYY-MM-01); dia 29–31 em mês curto vira o último dia. */
export function vencimentoDoMes(mesISO: string, dia: number): string {
  const [y, m] = mesISO.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = Math.min(Math.max(1, Math.floor(dia)), ultimo);
  return `${mesISO.slice(0, 7)}-${String(d).padStart(2, "0")}`;
}

/** Meses (YYYY-MM-01) que uma despesa recorrente ocupa até o horizonte `ate`. */
export function mesesDaSerie(i: {
  inicio: string;
  tipo: "fixa" | "variavel";
  meses: number | null;
  ate: string;
}): string[] {
  if (!ISO_MES.test(i.inicio) || !ISO_MES.test(i.ate)) return [];
  const [y, m] = i.inicio.split("-").map(Number);
  const limiteMeses = i.tipo === "variavel" ? Math.max(0, Math.floor(i.meses ?? 0)) : Infinity;
  const saida: string[] = [];
  for (let k = 0; k < Math.min(limiteMeses, 600); k++) {
    const d = new Date(Date.UTC(y, m - 1 + k, 1));
    const iso = d.toISOString().slice(0, 10);
    if (iso > i.ate) break;
    saida.push(iso);
  }
  return saida;
}

/** Quanto da despesa não cabe no caixa disponível. */
export function faltaNoCaixa(valor: number, disponivel: number): number {
  const cent = Math.round(valor * 100) - Math.round(Math.max(0, disponivel) * 100);
  return Math.max(0, cent) / 100;
}

/** Divide a falta meio a meio; o centavo que sobra fica com o Brendo. */
export function dividirIgual(falta: number): { brendo: number; victor: number } {
  const c = Math.round(falta * 100);
  const victor = Math.floor(c / 2);
  return { brendo: (c - victor) / 100, victor: victor / 100 };
}

/** null se a cobertura fecha exatamente a falta; senão, a mensagem do problema. */
export function validarCobertura(falta: number, partes: { socio: Socio; valor: number }[]): string | null {
  for (const p of partes) {
    if (!socioValido(p.socio)) return "Escolha o sócio de cada parte.";
    if (!(p.valor > 0)) return "Cada parte precisa ter valor maior que zero.";
  }
  const soma = partes.reduce((s, p) => s + Math.round(p.valor * 100), 0);
  if (soma !== Math.round(falta * 100)) return "A soma das partes precisa ser igual à diferença do caixa.";
  return null;
}

export function situacaoDespesa(
  d: { pago: boolean; vencimento: string | null },
  hoje: Date = new Date()
): "paga" | "atrasada" | "a_pagar" {
  if (d.pago) return "paga";
  if (d.vencimento && d.vencimento < hoje.toISOString().slice(0, 10)) return "atrasada";
  return "a_pagar";
}
