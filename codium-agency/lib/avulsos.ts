export interface Parcela {
  numero: number;
  valor: number;
  vencimento: string; // YYYY-MM-DD
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_PARCELAS = 60;

function dataValida(iso: string): boolean {
  if (!ISO.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Primeiro dia do mês da data (a competência da parcela). */
export function competenciaDe(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Divide o total em parcelas mensais; a última absorve a diferença de centavos. */
export function gerarParcelas(total: number, n: number, primeira: string): Parcela[] {
  if (!(total > 0) || !Number.isInteger(n) || n < 1 || n > MAX_PARCELAS || !dataValida(primeira)) return [];
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / n);
  const [y, m, d] = primeira.split("-").map(Number);
  const saida: Parcela[] = [];
  for (let i = 0; i < n; i++) {
    const ultimoDia = new Date(Date.UTC(y, m - 1 + i + 1, 0)).getUTCDate();
    const dt = new Date(Date.UTC(y, m - 1 + i, Math.min(d, ultimoDia)));
    const valorCent = i === n - 1 ? centavos - base * (n - 1) : base;
    saida.push({
      numero: i + 1,
      valor: valorCent / 100,
      vencimento: dt.toISOString().slice(0, 10),
    });
  }
  return saida;
}

/** Devolve a mensagem do primeiro problema, ou null se as parcelas estão corretas. */
export function validarParcelas(
  total: number,
  parcelas: { valor: number; vencimento: string }[]
): string | null {
  if (parcelas.length === 0) return "Informe ao menos uma parcela.";
  if (parcelas.length > MAX_PARCELAS) return `No máximo ${MAX_PARCELAS} parcelas.`;
  for (const p of parcelas) {
    if (!(p.valor > 0)) return "Cada parcela precisa ter valor maior que zero.";
    if (!dataValida(p.vencimento)) return "Informe a data de cada parcela.";
  }
  const soma = Math.round(parcelas.reduce((s, p) => s + p.valor, 0) * 100);
  if (soma !== Math.round(total * 100)) return "A soma das parcelas precisa ser igual ao valor total.";
  return null;
}
