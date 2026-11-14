export type TipoAviso = "conteudo_novo" | "nova_versao" | "decisao";

export const JANELA_MIN = 10;
const MOTIVO_MAX = 500;

function limpar(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

function cortar(t: string, max: number): string {
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

export function linkDoCliente(origem: string, token: string): string {
  return `${origem.replace(/\/$/, "")}/c/${token}`;
}

/** "sáb, 14/11 às 08:00" no fuso de São Paulo. */
export function quandoPostar(iso: string): string {
  const p = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const v = (t: string) => (p.find((x) => x.type === t)?.value ?? "").replace(".", "");
  return `${v("weekday")}, ${v("day")}/${v("month")} às ${v("hour")}:${v("minute")}`;
}

const linhaPosta = (iso?: string | null) => (iso ? `\n📅 Posta ${quandoPostar(iso)}` : "");

// ---------- grupo do cliente ----------

export function textoConteudoNovo(i: {
  empresa: string;
  titulo: string;
  pendentes: number;
  link: string;
  /** Títulos dos conteúdos pendentes (usado quando há mais de um). */
  titulos?: string[];
  agendadoPara?: string | null;
}): string {
  if (i.pendentes <= 1) {
    return `Olá, ${i.empresa}! 👋 Tem conteúdo novo para você aprovar:\n\n*«${i.titulo}»*${linhaPosta(i.agendadoPara)}\n\nAprove por aqui:\n${i.link}`;
  }
  const lista = (i.titulos ?? []).slice(0, 8).map((t) => `• «${t}»`).join("\n");
  return `Olá, ${i.empresa}! 👋 Você tem *${i.pendentes} conteúdos* para aprovar:${lista ? `\n\n${lista}` : ""}\n\nAprove por aqui:\n${i.link}`;
}

export function textoNovaVersao(i: { empresa: string; titulo: string; link: string }): string {
  return `🔄 Olá, ${i.empresa}! Ajustamos *«${i.titulo}»* e ele está pronto para você revisar.\n\nAprove por aqui:\n${i.link}`;
}

/** Confirmação para o grupo do cliente depois que ele responde no site (ele não precisa escrever "aprovado" no grupo). */
export function textoConfirmacaoCliente(i: {
  empresa: string;
  titulo: string;
  tipo: "aprovou" | "reprovou" | "sugeriu";
  agendadoPara?: string | null;
}): string {
  if (i.tipo === "aprovou") {
    return `✅ Recebemos a sua aprovação, ${i.empresa}! Obrigado. 🙌\n\n«${i.titulo}»${linhaPosta(i.agendadoPara)}`;
  }
  if (i.tipo === "reprovou") {
    return `Recebemos o seu pedido de ajuste, ${i.empresa}. 👍\n\n«${i.titulo}»\n\nJá vamos corrigir e avisamos por aqui.`;
  }
  return `📅 Recebemos a sua sugestão de data, ${i.empresa}.\n\n«${i.titulo}»\n\nJá confirmamos por aqui.`;
}

// ---------- grupo da equipe ----------

const NOME_PARTE = { midia: "a mídia", legenda: "a legenda", data: "a data" } as const;

export function textoDecisao(i: {
  empresa: string;
  titulo: string;
  decisao: "aprovado" | "reprovado";
  motivo?: string | null;
}): string {
  if (i.decisao === "aprovado") return `✅ *${i.empresa} aprovou*\n«${i.titulo}»`;
  const motivo = cortar(limpar(i.motivo ?? ""), MOTIVO_MAX);
  return `❌ *${i.empresa} reprovou*\n«${i.titulo}»${motivo ? `\n\n_${motivo}_` : ""}`;
}

export function textoDecisaoParte(i: {
  empresa: string;
  titulo: string;
  parte: "midia" | "legenda" | "data";
  decisao: "aprovado" | "reprovado";
  motivo?: string | null;
  sugeridaPara?: string | null;
  /** Data de postagem atual (para mostrar "Agora" ao sugerir outra). */
  agendadoPara?: string | null;
}): string {
  if (i.decisao === "aprovado") return `✅ *${i.empresa} aprovou ${NOME_PARTE[i.parte]}*\n«${i.titulo}»${linhaPosta(i.agendadoPara)}`;
  const motivo = cortar(limpar(i.motivo ?? ""), MOTIVO_MAX);
  if (i.parte === "data") {
    const agora = i.agendadoPara ? `\n\nAgora: ${quandoPostar(i.agendadoPara)}` : "\n";
    const sugerida = i.sugeridaPara ? `\nSugerida: ${quandoPostar(i.sugeridaPara)}` : "";
    return `📅 *${i.empresa} sugeriu outra data*\n«${i.titulo}»${agora}${sugerida}${motivo ? `\n_${motivo}_` : ""}\n\nConfirme no dashboard.`;
  }
  return `❌ *${i.empresa} reprovou ${NOME_PARTE[i.parte]}*\n«${i.titulo}»${motivo ? `\n\n_${motivo}_` : ""}`;
}

/** Uma mensagem para várias partes aprovadas de uma vez ("Aprovar tudo"). */
export function textoAprovouPartes(i: {
  empresa: string;
  titulo: string;
  partes: ("midia" | "legenda" | "data")[];
  agendadoPara?: string | null;
}): string {
  if (i.partes.length >= 3) {
    return `✅ *${i.empresa} aprovou tudo*\n«${i.titulo}»\n\nMídia, legenda e data${linhaPosta(i.agendadoPara)}`;
  }
  const lista = i.partes.map((p) => NOME_PARTE[p]).join(" e ");
  return `✅ *${i.empresa} aprovou ${lista}*\n«${i.titulo}»${linhaPosta(i.agendadoPara)}`;
}

export function deveAgrupar(
  ultimoOk: string | Date | null | undefined,
  agora: Date,
  janelaMin: number = JANELA_MIN
): boolean {
  if (!ultimoOk) return false;
  const t = new Date(ultimoOk).getTime();
  if (!Number.isFinite(t)) return false;
  const dif = agora.getTime() - t;
  return dif >= 0 && dif < janelaMin * 60_000;
}
