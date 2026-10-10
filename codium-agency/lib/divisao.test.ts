import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoExcedente, avisoMovimentacao, rotuloSocio, socioValido } from "./divisao.ts";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

test("rotuloSocio e socioValido", () => {
  assert.equal(rotuloSocio("brendo"), "Brendo");
  assert.equal(rotuloSocio("victor"), "Victor");
  assert.equal(socioValido("brendo"), true);
  assert.equal(socioValido("victor"), true);
  assert.equal(socioValido("terceiro"), false);
  assert.equal(socioValido(""), false);
});

test("avisoExcedente: nota informativa quando o sócio recebe além da parte", () => {
  const t = avisoExcedente("brendo", 500, "Outubro de 2026");
  assert.ok(t.includes("Brendo"));
  assert.ok(t.includes(brl(500)));
  assert.ok(t.includes("caixa"));
  assert.ok(t.includes("Outubro de 2026"));
});

test("avisoExcedente: sem excedente não há aviso", () => {
  assert.equal(avisoExcedente("victor", 0, "Outubro de 2026"), null);
  assert.equal(avisoExcedente("victor", -3, "Outubro de 2026"), null);
});

test("avisoMovimentacao: repasses acima do faturamento pedem para achar o buraco", () => {
  const t = avisoMovimentacao({ repassado: 21000, faturamento: 20000, diferenca: 1000, mes: "Outubro de 2026" });
  assert.ok(t);
  assert.ok(t!.includes(brl(21000)));
  assert.ok(t!.includes(brl(20000)));
  assert.ok(t!.includes(brl(1000)));
  assert.match(t!, /ficou de fora/i);
});

test("avisoMovimentacao: sem diferença não há aviso", () => {
  assert.equal(avisoMovimentacao({ repassado: 9000, faturamento: 20000, diferenca: 0, mes: "x" }), null);
});
