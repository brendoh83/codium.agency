import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { rodarCron } from "@/lib/fila-servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function segredoOk(recebido: string | null): boolean {
  const esperado = process.env.CRON_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Chamada a cada minuto pelo banco (pg_cron + pg_net) com o cabeçalho x-cron-secret. */
export async function POST(req: Request) {
  if (!segredoOk(req.headers.get("x-cron-secret"))) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const resumo = await rodarCron();
  return NextResponse.json(resumo);
}
