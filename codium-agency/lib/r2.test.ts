import { test } from "node:test";
import assert from "node:assert/strict";

process.env.R2_ACCOUNT_ID = "acc123";
process.env.R2_ACCESS_KEY_ID = "AKIATESTE";
process.env.R2_SECRET_ACCESS_KEY = "segredo-de-teste";
process.env.R2_BUCKET = "bkt";

const { urlUpload, urlLeitura, apagarObjeto } = await import("./r2.ts");

test("urlUpload assina PUT com expiração de 900s", async () => {
  const u = new URL(await urlUpload("clientes/c1/arquivo.mp4"));
  assert.equal(u.host, "acc123.r2.cloudflarestorage.com");
  assert.equal(u.pathname, "/bkt/clientes/c1/arquivo.mp4");
  assert.equal(u.searchParams.get("X-Amz-Expires"), "900");
  assert.ok(u.searchParams.get("X-Amz-Signature"));
});

test("urlLeitura assina GET com expiração de 3600s", async () => {
  const u = new URL(await urlLeitura("clientes/c1/arquivo.mp4"));
  assert.equal(u.searchParams.get("X-Amz-Expires"), "3600");
  assert.ok(u.searchParams.get("X-Amz-Signature"));
});

test("sem variáveis de ambiente lança erro claro", async () => {
  const guardado = process.env.R2_BUCKET;
  delete process.env.R2_BUCKET;
  await assert.rejects(() => urlLeitura("k"), /R2/);
  process.env.R2_BUCKET = guardado;
});

test("apagarObjeto envia DELETE assinado para a chave", async () => {
  const antes = globalThis.fetch;
  let req: Request | undefined;
  globalThis.fetch = (async (input: any, init?: any) => {
    req = new Request(input, init);
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    await apagarObjeto("clientes/c1/a.png");
  } finally {
    globalThis.fetch = antes;
  }
  assert.equal(req?.method, "DELETE");
  assert.equal(new URL(req!.url).pathname, "/bkt/clientes/c1/a.png");
  assert.ok(req!.headers.get("authorization"));
});

test("apagarObjeto lança erro quando o R2 recusa", async () => {
  const antes = globalThis.fetch;
  globalThis.fetch = (async () => new Response("negado", { status: 403 })) as typeof fetch;
  try {
    await assert.rejects(() => apagarObjeto("clientes/c1/a.png"), /R2/);
  } finally {
    globalThis.fetch = antes;
  }
});
