import { test } from "node:test";
import assert from "node:assert/strict";
import { enviarTexto, estadoConexao, listarGrupos, conectar, INSTANCIA_PADRAO } from "./whatsapp.ts";

process.env.EVOLUTION_URL = "https://evo.exemplo.test/";
process.env.EVOLUTION_API_KEY = "chave-de-teste";

function stub(resposta: { status?: number; json?: unknown; texto?: string }) {
  const chamadas: Request[] = [];
  const antes = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    chamadas.push(new Request(input, init));
    const status = resposta.status ?? 200;
    return new Response(resposta.texto ?? JSON.stringify(resposta.json ?? {}), { status });
  }) as typeof fetch;
  return { chamadas, restaurar: () => { globalThis.fetch = antes; } };
}

test("instância padrão", () => assert.equal(INSTANCIA_PADRAO, "codium-agencia"));

test("enviarTexto: POST com apikey e corpo {number, text}", async () => {
  const s = stub({ json: { key: { id: "x" } } });
  try {
    await enviarTexto("codium-agencia", "1203630@g.us", "olá");
  } finally { s.restaurar(); }
  const r = s.chamadas[0];
  assert.equal(r.method, "POST");
  assert.equal(new URL(r.url).pathname, "/message/sendText/codium-agencia");
  assert.equal(r.headers.get("apikey"), "chave-de-teste");
  assert.deepEqual(await r.json(), { number: "1203630@g.us", text: "olá" });
});

test("listarGrupos: usa a lista de contatos (rápida), só grupos, nome do pushName, ordenado", async () => {
  const s = stub({ json: [
    { remoteJid: "2@g.us", pushName: "Zeta", isGroup: true },
    { remoteJid: "5511999990000@s.whatsapp.net", pushName: "Pessoa", isGroup: false },
    { remoteJid: "1@g.us", pushName: "Alecrim Store", isGroup: true },
    { remoteJid: "3@g.us", pushName: null, isGroup: true },
    { remoteJid: "1@g.us", pushName: "Alecrim Store", isGroup: true },
  ] });
  let grupos;
  try { grupos = await listarGrupos("codium-agencia"); } finally { s.restaurar(); }
  assert.deepEqual(grupos, [
    { id: "1@g.us", nome: "Alecrim Store" },
    { id: "2@g.us", nome: "Zeta" },
    { id: "3@g.us", nome: "3@g.us" },
  ]);
  const r = s.chamadas[0];
  assert.equal(r.method, "POST");
  assert.equal(new URL(r.url).pathname, "/chat/findContacts/codium-agencia");
});

test("estadoConexao lê instance.state", async () => {
  const s = stub({ json: { instance: { instanceName: "x", state: "open" } } });
  try { assert.equal(await estadoConexao("x"), "open"); } finally { s.restaurar(); }
});

test("conectar com número usa ?number=", async () => {
  const s = stub({ json: { pairingCode: "ABCD-1234" } });
  try { await conectar("x", "5549999990000"); } finally { s.restaurar(); }
  assert.equal(new URL(s.chamadas[0].url).search, "?number=5549999990000");
});

test("resposta de erro lança com status e caminho", async () => {
  const s = stub({ status: 401, texto: "Unauthorized" });
  try {
    await assert.rejects(() => enviarTexto("x", "1@g.us", "t"), /Evolution.*401/);
  } finally { s.restaurar(); }
});

test("sem variáveis lança erro claro", async () => {
  const url = process.env.EVOLUTION_URL;
  delete process.env.EVOLUTION_URL;
  try {
    await assert.rejects(() => estadoConexao("x"), /EVOLUTION_URL/);
  } finally { process.env.EVOLUTION_URL = url; }
});
