import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { chaveR2, validarArquivo, validarCarrossel } from "@/lib/conteudos";
import { urlUpload } from "@/lib/r2";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clienteId = typeof body?.clienteId === "string" ? body.clienteId : "";
  const mime = typeof body?.mime === "string" ? body.mime : "";
  const tamanho = Number(body?.tamanho);

  if (!UUID.test(clienteId)) return NextResponse.json({ erro: "Cliente inválido." }, { status: 400 });

  // carrossel: várias imagens de uma vez
  if (Array.isArray(body?.arquivos)) {
    const arquivos = (body.arquivos as { mime?: unknown; tamanho?: unknown }[]).map((a) => ({
      mime: typeof a?.mime === "string" ? a.mime : "",
      tamanho: Number(a?.tamanho),
    }));
    const erroCarrossel = validarCarrossel(arquivos);
    if (erroCarrossel) return NextResponse.json({ erro: erroCarrossel }, { status: 400 });
    const itens = await Promise.all(
      arquivos.map(async (a) => {
        const k = chaveR2(clienteId, randomUUID(), a.mime);
        return { key: k, url: await urlUpload(k) };
      })
    );
    return NextResponse.json({ itens });
  }

  const erro = validarArquivo(mime, tamanho);
  if (erro) return NextResponse.json({ erro }, { status: 400 });

  const key = chaveR2(clienteId, randomUUID(), mime);
  return NextResponse.json({ key, url: await urlUpload(key) });
}
