import { test } from "node:test";
import assert from "node:assert/strict";
import { rotaPermitida } from "./acesso.ts";

test("administrador acessa tudo", () => {
  for (const p of ["/dashboard", "/financeiro", "/configuracoes", "/conteudos/abc"]) {
    assert.equal(rotaPermitida("administrador", p), true);
  }
});

test("equipe só acessa conteúdos", () => {
  assert.equal(rotaPermitida("equipe", "/conteudos"), true);
  assert.equal(rotaPermitida("equipe", "/conteudos/abc"), true);
  assert.equal(rotaPermitida("equipe", "/api/conteudos/upload-url"), true);
  for (const p of ["/dashboard", "/financeiro", "/clientes", "/configuracoes", "/conteudos-x", "/"]) {
    assert.equal(rotaPermitida("equipe", p), false);
  }
});

test("perfil ausente ou desconhecido = restrito", () => {
  assert.equal(rotaPermitida(null, "/financeiro"), false);
  assert.equal(rotaPermitida(undefined, "/dashboard"), false);
  assert.equal(rotaPermitida("outro", "/dashboard"), false);
  assert.equal(rotaPermitida(null, "/conteudos"), true);
});
