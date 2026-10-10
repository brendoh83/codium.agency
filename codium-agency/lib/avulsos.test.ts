import { test } from "node:test";
import assert from "node:assert/strict";
import { competenciaDe, gerarParcelas, validarParcelas } from "./avulsos.ts";

test("competenciaDe: primeiro dia do mês da data", () => {
  assert.equal(competenciaDe("2026-10-15"), "2026-10-01");
  assert.equal(competenciaDe("2027-01-31"), "2027-01-01");
});

test("gerarParcelas: à vista é uma parcela com o valor inteiro", () => {
  assert.deepEqual(gerarParcelas(1000, 1, "2026-10-15"), [{ numero: 1, valor: 1000, vencimento: "2026-10-15" }]);
});

test("gerarParcelas: divide em meses seguidos e a última absorve os centavos", () => {
  const p = gerarParcelas(100, 3, "2026-10-10");
  assert.deepEqual(p.map((x) => x.vencimento), ["2026-10-10", "2026-11-10", "2026-12-10"]);
  assert.deepEqual(p.map((x) => x.valor), [33.33, 33.33, 33.34]);
  assert.equal(Math.round(p.reduce((s, x) => s + x.valor, 0) * 100) / 100, 100);
  assert.deepEqual(p.map((x) => x.numero), [1, 2, 3]);
});

test("gerarParcelas: dia 31 vira o último dia dos meses mais curtos e vira o ano", () => {
  const p = gerarParcelas(300, 4, "2026-12-31");
  assert.deepEqual(p.map((x) => x.vencimento), ["2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31"]);
});

test("gerarParcelas: entradas inválidas devolvem lista vazia", () => {
  assert.deepEqual(gerarParcelas(0, 3, "2026-10-10"), []);
  assert.deepEqual(gerarParcelas(100, 0, "2026-10-10"), []);
  assert.deepEqual(gerarParcelas(100, 3, "lixo"), []);
  assert.deepEqual(gerarParcelas(100, 61, "2026-10-10"), []);
});

test("validarParcelas: soma, valores e datas", () => {
  assert.equal(validarParcelas(100, [{ valor: 60, vencimento: "2026-10-10" }, { valor: 40, vencimento: "2026-11-10" }]), null);
  assert.match(validarParcelas(100, [{ valor: 60, vencimento: "2026-10-10" }])!, /soma/i);
  assert.match(validarParcelas(100, [{ valor: 0, vencimento: "2026-10-10" }, { valor: 100, vencimento: "2026-11-10" }])!, /valor/i);
  assert.match(validarParcelas(100, [{ valor: 100, vencimento: "10/10/2026" }])!, /data/i);
  assert.match(validarParcelas(100, [])!, /parcela/i);
});
