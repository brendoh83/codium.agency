import { test } from "node:test";
import assert from "node:assert/strict";

process.env.R2_ACCOUNT_ID = "acc123";
process.env.R2_ACCESS_KEY_ID = "AKIATESTE";
process.env.R2_SECRET_ACCESS_KEY = "segredo-de-teste";
process.env.R2_BUCKET = "bkt";

const { urlUpload, urlLeitura } = await import("./r2.ts");

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
