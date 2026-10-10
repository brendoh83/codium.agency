export type Decisao = "aprovado" | "reprovado" | null;

export interface Versao {
  id: string;
  numero: number;
  mime: string;
  created_at: string;
  expirada: boolean;
  decisao: Decisao;
  motivo: string | null;
  decidido_em: string | null;
}

export interface Conteudo {
  id: string;
  titulo: string;
  tipo: "video" | "imagem";
  created_at: string;
  versoes: Versao[];
}

export type Estado = "pendente" | "reprovado" | "aprovado";

export const MAX_BYTES = 500 * 1024 * 1024;

const MIMES: Record<string, { tipo: "video" | "imagem"; ext: string }> = {
  "video/mp4": { tipo: "video", ext: "mp4" },
  "video/quicktime": { tipo: "video", ext: "mov" },
  "video/webm": { tipo: "video", ext: "webm" },
  "image/jpeg": { tipo: "imagem", ext: "jpg" },
  "image/png": { tipo: "imagem", ext: "png" },
  "image/webp": { tipo: "imagem", ext: "webp" },
};

export function versaoAtual(c: { versoes: Versao[] }): Versao | undefined {
  return c.versoes.reduce<Versao | undefined>(
    (maior, v) => (!maior || v.numero > maior.numero ? v : maior),
    undefined
  );
}

export function estadoConteudo(c: { versoes: Versao[] }): Estado {
  const d = versaoAtual(c)?.decisao;
  return d === "aprovado" ? "aprovado" : d === "reprovado" ? "reprovado" : "pendente";
}

export function podeNovaVersao(v: { decisao: Decisao; expirada: boolean }): boolean {
  return v.decisao === "reprovado" || (v.decisao === null && v.expirada);
}

export function comVersoes<T extends { versoes: unknown[] }>(cs: T[]): T[] {
  return cs.filter((c) => c.versoes.length > 0);
}

export function separarFeed<T extends Conteudo>(cs: T[]): { topo: T[]; aprovados: T[] } {
  const porDataDesc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);
  const topo = cs
    .filter((c) => estadoConteudo(c) !== "aprovado")
    .sort((a, b) => porDataDesc(a.created_at, b.created_at));
  const aprovados = cs
    .filter((c) => estadoConteudo(c) === "aprovado")
    .sort((a, b) =>
      porDataDesc(versaoAtual(a)?.decidido_em ?? "", versaoAtual(b)?.decidido_em ?? "")
    );
  return { topo, aprovados };
}

export function tipoPorMime(mime: string): "video" | "imagem" | null {
  return MIMES[mime]?.tipo ?? null;
}

export function validarArquivo(mime: string, tamanho: number): string | null {
  if (!MIMES[mime]) return "Tipo de arquivo não permitido. Use MP4, MOV, WEBM, JPG, PNG ou WEBP.";
  if (!Number.isFinite(tamanho) || tamanho <= 0) return "Arquivo vazio.";
  if (tamanho > MAX_BYTES) return "Arquivo maior que 500 MB.";
  return null;
}

export function chaveR2(clienteId: string, uuid: string, mime: string): string {
  const ext = MIMES[mime]?.ext ?? "bin";
  return `clientes/${clienteId}/${uuid}.${ext}`;
}

export function mensagemErro(msg: string): string {
  if (msg.includes("motivo obrigatorio")) return "Escreva o motivo da reprovação.";
  if (msg.includes("ja respondida")) return "Este conteúdo já foi respondido.";
  if (msg.includes("arquivo expirado")) return "O arquivo expirou. Peça uma nova versão.";
  if (msg.includes("versao antiga")) return "Existe uma versão mais nova deste conteúdo.";
  return "Não foi possível enviar. Tente de novo.";
}
