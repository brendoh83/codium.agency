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

export function textoConteudoNovo(i: {
  empresa: string;
  titulo: string;
  pendentes: number;
  link: string;
}): string {
  if (i.pendentes <= 1) {
    return `📌 ${i.empresa}: novo conteúdo para aprovar: «${i.titulo}». Veja aqui: ${i.link}`;
  }
  return `📌 ${i.empresa}: ${i.pendentes} conteúdos aguardando aprovação. Veja aqui: ${i.link}`;
}

export function textoNovaVersao(i: { empresa: string; titulo: string; link: string }): string {
  return `🔄 ${i.empresa}: nova versão de «${i.titulo}» para aprovar. Veja aqui: ${i.link}`;
}

export function textoDecisao(i: {
  empresa: string;
  titulo: string;
  decisao: "aprovado" | "reprovado";
  motivo?: string | null;
}): string {
  if (i.decisao === "aprovado") return `✅ ${i.empresa} aprovou «${i.titulo}»`;
  const motivo = cortar(limpar(i.motivo ?? ""), MOTIVO_MAX);
  return `❌ ${i.empresa} reprovou «${i.titulo}»${motivo ? `: ${motivo}` : ""}`;
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
