// somente servidor
import { urlDownload, urlLeitura } from "@/lib/r2";

export interface Slide {
  url: string;
  urlBaixar: string;
}

/** Links de leitura e de download das imagens de um carrossel, na ordem. */
export async function montarSlides(
  arquivos: { r2_key: string; ordem: number }[] | undefined,
  titulo: string
): Promise<Slide[]> {
  const nomeBase = titulo.replace(/[\\/:*?"<>|]+/g, " ").trim() || "carrossel";
  const ordenados = [...(arquivos ?? [])].sort((a, b) => a.ordem - b.ordem);
  return Promise.all(
    ordenados.map(async (a, idx) => {
      const ext = a.r2_key.includes(".") ? a.r2_key.split(".").pop() : "jpg";
      return {
        url: await urlLeitura(a.r2_key),
        urlBaixar: await urlDownload(a.r2_key, `${nomeBase} ${idx + 1}.${ext}`),
      };
    })
  );
}
