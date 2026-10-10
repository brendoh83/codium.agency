import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { chaveR2, validarArquivo } from "@/lib/conteudos";
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
  const erro = validarArquivo(mime, tamanho);
  if (erro) return NextResponse.json({ erro }, { status: 400 });

  const key = chaveR2(clienteId, randomUUID(), mime);
  return NextResponse.json({ key, url: await urlUpload(key) });
}
