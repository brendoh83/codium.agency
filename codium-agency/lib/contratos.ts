/** Competências (YYYY-MM-01) de um contrato dentro da janela [desde, ate].
 *  `meses` null = recorrente (sem fim); senão exatamente `meses` competências a partir do mês de início. */
export function competenciasDoContrato(i: {
  inicio: string;
  meses: number | null;
  desde: string;
  ate: string;
}): string[] {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(i.inicio);
  if (!m) return [];
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const limite = i.meses === null ? 600 : Math.min(Math.max(0, Math.floor(i.meses)), 600);
  const saida: string[] = [];
  for (let k = 0; k < limite; k++) {
    const iso = new Date(Date.UTC(y, mo - 1 + k, 1)).toISOString().slice(0, 10);
    if (iso > i.ate) break;
    if (iso >= i.desde) saida.push(iso);
  }
  return saida;
}

/** Data de término de um contrato de `meses` meses iniciado em `inicio` (YYYY-MM-DD). */
export function dataFimDoContrato(inicio: string, meses: number): string {
  const [y, m, d] = inicio.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + meses, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/** Campo "meses" do formulário: inteiro 1–120, ou null (recorrente) se vazio/inválido. */
export function mesesDoForm(v: unknown): number | null {
  const n = Number(String(v ?? "").trim());
  return Number.isInteger(n) && n >= 1 && n <= 120 ? n : null;
}

/** Texto legado da coluna `duracao`. */
export function duracaoTexto(meses: number | null): string {
  return meses === null ? "recorrente" : meses === 1 ? "1_mes" : `${meses}_meses`;
}

export function rotuloDuracao(meses: number | null): string {
  return meses === null ? "Recorrente" : meses === 1 ? "1 mês" : `${meses} meses`;
}
