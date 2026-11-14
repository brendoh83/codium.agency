import { test } from "node:test";
import assert from "node:assert/strict";
import { lerWorkspaces, workspacesAutodm } from "./autodm.ts";

test("lerWorkspaces: aceita só itens com id e nome em texto", () => {
  const r = lerWorkspaces({
    workspaces: [{ id: "w1", name: "Codium" }, { id: 2, name: "x" }, { id: "w3" }, null, { id: "w4", name: "  J'adore  " }],
  });
  assert.deepEqual(r, [
    { id: "w1", nome: "Codium" },
    { id: "w4", nome: "J'adore" },
  ]);
});

test("lerWorkspaces: resposta fora do formato vira lista vazia", () => {
  assert.deepEqual(lerWorkspaces(null), []);
  assert.deepEqual(lerWorkspaces({ workspaces: "x" }), []);
  assert.deepEqual(lerWorkspaces([]), []);
});

test("workspacesAutodm: sem configuração explica o que falta", async () => {
  await assert.rejects(workspacesAutodm({ url: "", segredo: "" }, async () => new Response("{}")), /AUTODM_URL e AUTODM_SECRET/);
});

test("workspacesAutodm: manda o segredo no Bearer e lê a lista", async () => {
  let pedido: { url: string; auth: string | null } | null = null;
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
    pedido = { url: String(url), auth: new Headers(init?.headers).get("authorization") };
    return new Response(JSON.stringify({ workspaces: [{ id: "w1", name: "Codium" }] }), { status: 200 });
  };
  const r = await workspacesAutodm({ url: "https://autodm.exemplo/", segredo: "s3" }, fakeFetch);
  assert.deepEqual(r, [{ id: "w1", nome: "Codium" }]);
  assert.deepEqual(pedido, { url: "https://autodm.exemplo/api/painel/workspaces", auth: "Bearer s3" });
});

test("workspacesAutodm: resposta de erro vira erro legível", async () => {
  await assert.rejects(
    workspacesAutodm({ url: "https://autodm.exemplo", segredo: "s3" }, async () => new Response("no", { status: 401 })),
    /AutoDM respondeu 401/
  );
});
