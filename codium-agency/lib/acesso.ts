export type Papel = "administrador" | "equipe";

// Rotas liberadas para o papel "equipe". Qualquer outro papel (ou perfil ausente) cai aqui também.
const ROTAS_EQUIPE = ["/conteudos", "/api/conteudos", "/login"];

export function rotaPermitida(papel: string | null | undefined, path: string): boolean {
  if (papel === "administrador") return true;
  return ROTAS_EQUIPE.some((r) => path === r || path.startsWith(r + "/"));
}
