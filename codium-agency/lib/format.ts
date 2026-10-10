export function formatBRL(valor: number | null | undefined): string {
  const v = valor ?? 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.slice(0, 10) + "T00:00:00");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function monthLabel(iso: string): string {
  const date = new Date(iso.slice(0, 10) + "T00:00:00");
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso.slice(0, 10) + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function firstDayOfMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function shiftMonth(iso: string, delta: number): string {
  const [y, m] = iso.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return firstDayOfMonth(date);
}

/** Dias entre o vencimento e a data em que foi pago (0 se em dia, antecipado ou sem data). */
export function diasDeAtraso(vencimento: string, dataPagamento: string | null | undefined): number {
  if (!dataPagamento) return 0;
  const ms = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const v = ms(vencimento);
  const p = ms(dataPagamento);
  if (!Number.isFinite(v) || !Number.isFinite(p)) return 0;
  return Math.max(0, Math.round((p - v) / 86400000));
}
